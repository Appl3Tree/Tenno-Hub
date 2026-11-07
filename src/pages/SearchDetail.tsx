import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import blueprintTemplateUrl from "../assets/templates/Blueprint.webp";
import blueprintChassisUrl from "../assets/templates/240px-Chassis.png";
import blueprintNeuropticsUrl from "../assets/templates/240px-Neuroptics.png";
import blueprintSystemsUrl from "../assets/templates/240px-Systems.png";
import { WorkspaceAction, WorkspaceHero, WorkspaceSection, WorkspaceStat } from "../components/workspace/WorkspaceChrome";
import {
    GroupedSourceList,
    classifySourceFamilyFromCatalog,
    classifySourceFamilyFromDropLocation,
    extractInlinePriceMeta,
    type GroupedSourceEntry,
} from "../components/sources/GroupedSourceList";
import { getAcquisitionByCatalogId } from "../catalog/items/itemAcquisition";
import { resolveItemRequirementGraph, type ItemRequirementEdge } from "../catalog/items/itemRequirements";
import { SOURCE_INDEX } from "../catalog/sources/sourceCatalog";
import { getSyndicateVendorPrice, parseSyndicateVendorLabel } from "../catalog/sources/syndicateVendorPricing";
import { FULL_CATALOG } from "../domain/catalog/loadFullCatalog";
import { getWeaponCatalog, type WeaponAttack, type WeaponDamage, type WeaponEntry } from "../domain/catalog/weaponCatalog";
import { useTrackerStore } from "../store/store";
import { formatSourceDisplayLabel } from "../utils/sourceLabels";
import { getHighestOwnedArcaneRankWithFallback } from "../domain/logic/arcaneInventory";
import {
    buildSearchDetailHash,
    getCatalogIdForPath,
    getSearchDetailRefForCatalogId,
    getSearchEntity,
    getSearchEntityData,
    getSearchEntityImageUrl,
    getSearchEntityWikiUrl,
    type SearchDetailRef,
    type SearchEntityRecord,
} from "../domain/search/globalSearch";

type DropEntry = {
    chance: number;
    location: string;
    rarity?: string;
    type?: string;
};

type DetailMetaStat = {
    label: string;
    value: string;
};

type WeaponStatRow = {
    label: string;
    value: string;
    hint?: string;
};

type CraftingNode = {
    catalogId: string;
    name: string;
    count: number;
    owned: number;
    acquisitionSources: Array<{ label: string; group: string }>;
    children: CraftingNode[];
};

type CraftedWithEntry = {
    catalogId: string;
    name: string;
    count: number;
};

type StepperControlProps = {
    label: string;
    value: string | number;
    onDecrease: () => void;
    onIncrease: () => void;
    decreaseDisabled?: boolean;
    increaseDisabled?: boolean;
    hint?: string;
};

const EMPTY_MOD_RANKS: Record<string, number> = {};
const EMPTY_ARCANE_RANKS: Record<string, Record<string, number>> = {};
const EMPTY_MASTERY: Record<string, boolean> = {};

const _statusImgs = import.meta.glob<string>("../assets/statuses/*.png", {
    eager: true,
    import: "default",
});
const STATUS_IMG: Record<string, string> = {};
for (const [path, url] of Object.entries(_statusImgs)) {
    const name = path.split("/").pop()!.replace(".png", "").toLowerCase();
    STATUS_IMG[name] = url;
}
const DT_TO_IMG: Record<string, string> = {
    dt_corrosive_color: "essentialcorrosiveglyph",
    dt_corrosive: "essentialcorrosiveglyph",
    dt_electricity_color: "electricmodbundleicon",
    dt_electricity: "electricmodbundleicon",
    dt_explosion_color: "essentialblastglyph",
    dt_explosion: "essentialblastglyph",
    dt_fire_color: "heatmodbundleicon",
    dt_fire: "heatmodbundleicon",
    dt_freeze_color: "coldmodbundleicon",
    dt_freeze: "coldmodbundleicon",
    dt_gas_color: "essentialgasglyph",
    dt_gas: "essentialgasglyph",
    dt_impact_color: "essentialimpactglyph",
    dt_magnetic_color: "essentialmagneticglyph",
    dt_magnetic: "essentialmagneticglyph",
    dt_poison_color: "toxinmodbundleicon",
    dt_poison: "toxinmodbundleicon",
    dt_puncture_color: "essentialpunctureglyph",
    dt_radiant_color: "essentialradiationglyph",
    dt_radiation_color: "essentialradiationglyph",
    dt_radiation: "essentialradiationglyph",
    dt_sentient_color: "essentialtauglyph",
    dt_sentient: "essentialtauglyph",
    dt_slash_color: "essentialslashglyph",
    dt_slash: "essentialslashglyph",
    dt_viral_color: "essentialviralglyph",
    dt_viral: "essentialviralglyph",
};

function titleCase(value: string): string {
    return value
        .split(/[\s/_-]+/g)
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
}

function compactLabel(value: string): string {
    return value.replace(/\s+/g, " ").trim();
}

function formatNumber(value: number | null | undefined): string {
    if (value == null || !Number.isFinite(value)) return "—";
    return value.toLocaleString();
}

function formatDecimal(value: number | null | undefined, digits = 2): string {
    if (value == null || !Number.isFinite(value)) return "—";
    return value.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: digits,
    });
}

function formatBool(value: boolean | null | undefined): string {
    if (value == null) return "—";
    return value ? "Yes" : "No";
}

function formatDate(value: unknown): string {
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : "—";
}

function formatDropPercent(value: number): string {
    return `${value.toFixed(2)}%`;
}

function formatCompactPercent(value: number | null | undefined, digits = 1): string {
    if (value == null || !Number.isFinite(value)) return "—";
    return `${(value * 100).toFixed(digits)}%`;
}

function formatPolarity(value: unknown): string {
    return typeof value === "string" && value.trim() ? titleCase(value) : "—";
}

function buildWikiUrl(name: string, anchor?: string): string {
    const slug = name.trim().replace(/\s+/g, "_");
    return `https://wiki.warframe.com/w/${encodeURIComponent(slug)}${anchor ? `#${anchor}` : ""}`;
}

function getKnownMarketMeta(entry: SearchEntityRecord | null, rawData: unknown, sourceId: string): string | null {
    if (sourceId === "data:market/credits") {
        const marketCost = typeof entry?.marketCost === "number" ? entry.marketCost : null;
        if (marketCost && Number.isFinite(marketCost) && marketCost > 0) return `${marketCost.toLocaleString()} Credits`;
    }

    if (sourceId === "data:market/platinum" && rawData && typeof rawData === "object") {
        const premium = Number((rawData as Record<string, unknown>).PremiumPrice ?? 0);
        if (Number.isFinite(premium) && premium > 0) return `${premium.toLocaleString()} Platinum`;
    }

    return null;
}

function getCatalogSourceMeta(entry: SearchEntityRecord | null, rawData: unknown, sourceId: string, label: string): string | null {
    const syndicateStanding =
        entry?.name && label.toLowerCase().startsWith("syndicate vendor:")
            ? getSyndicateVendorPrice(entry.name, label)
            : null;
    if (syndicateStanding != null) return `${syndicateStanding.toLocaleString()} Standing`;
    return getKnownMarketMeta(entry, rawData, sourceId) ?? extractInlinePriceMeta(label);
}

function displayMagazineValue(weapon: WeaponEntry, magazineSize: number): string {
    return weapon.hasExplicitMagazineSize ? formatDecimal(magazineSize, 0) : "∞";
}

function cleanCatalogSubtitle(value: string): string {
    return compactLabel(value.replace(/\s*·\s*/g, " · "));
}

function splitCatalogSubtitle(value: string): string[] {
    return cleanCatalogSubtitle(value)
        .split("·")
        .map((part) => compactLabel(part))
        .filter(Boolean);
}

function buildSupportingDescription(entitySubtitle: string, description: unknown): string {
    if (typeof description === "string" && description.trim()) return description.trim();
    const parts = splitCatalogSubtitle(entitySubtitle);
    return parts.length > 0 ? parts.join(" · ") : "Catalog entry";
}

function isBlueprintName(name: string | null | undefined): boolean {
    return typeof name === "string" && name.trim().toLowerCase().endsWith(" blueprint");
}

function getBlueprintOverlayImage(name: string | null | undefined, fallbackImageUrl: string | null): string | null {
    const normalized = typeof name === "string" ? name.trim().toLowerCase() : "";
    if (!normalized) return fallbackImageUrl;
    if (normalized.includes("chassis blueprint")) return blueprintChassisUrl;
    if (normalized.includes("systems blueprint")) return blueprintSystemsUrl;
    if (normalized.includes("neuroptics blueprint")) return blueprintNeuropticsUrl;
    return fallbackImageUrl;
}

function renderCodexText(text: string): ReactNode {
    const cleaned = text
        .replace(/\\n/g, "\n")
        .replace(/<LINE_SEPARATOR>/g, " · ")
        .replace(/<LOWER_IS_BETTER>/g, "")
        .replace(/<[A-Z_]+_SECONDARY_COLOR>/g, "")
        .replace(/<\/[A-Z_]+_SECONDARY_COLOR>/g, "")
        .replace(/<(?!DT_)[A-Z_\/]+>/g, "");

    const parts = cleaned.split(/(<DT_[A-Z_]+>|\|[A-Z_0-9]+\||\n)/);
    if (parts.length === 1) return cleaned;

    const nodes: ReactNode[] = [];
    for (let i = 0; i < parts.length; i += 1) {
        const part = parts[i];
        if (!part) continue;
        if (part === "\n") {
            nodes.push(<br key={i} />);
            continue;
        }
        if (part.startsWith("<DT_") && part.endsWith(">")) {
            const key = part.slice(1, -1).toLowerCase();
            const imgName = DT_TO_IMG[key];
            const imgUrl = imgName ? STATUS_IMG[imgName] : null;
            const alt = key.replace("dt_", "").replace(/_color$/, "").replace(/_/g, " ");
            if (imgUrl) {
                nodes.push(
                    <img
                        key={i}
                        src={imgUrl}
                        alt={alt}
                        title={titleCase(alt)}
                        className="mx-0.5 inline h-4 w-4 rounded-sm object-contain align-[-0.15em]"
                    />,
                );
                continue;
            }
            nodes.push(titleCase(alt));
            continue;
        }
        if (part.startsWith("|") && part.endsWith("|")) {
            continue;
        }
        nodes.push(part);
    }

    return <>{nodes}</>;
}

function getSourceGroup(label: string): string {
    const normalized = label.toLowerCase();
    if (normalized.includes("rotation")) return "Drop Rotation";
    if (normalized.includes("sanctuary") || normalized.includes("conclave") || normalized.includes("sortie")) return "Activity";
    if (normalized.includes("market")) return "Market";
    if (normalized.includes("vendor") || normalized.includes("syndicate")) return "Vendor";
    if (normalized.includes("relic")) return "Relic";
    return "Source";
}

function asDrops(value: unknown): DropEntry[] {
    if (!Array.isArray(value)) return [];
    const parsed = value
        .map((entry): DropEntry | null => {
            if (!entry || typeof entry !== "object") return null;
            const item = entry as Record<string, unknown>;
            const location = typeof item.location === "string" ? item.location.trim() : "";
            const chance = typeof item.chance === "number" ? item.chance : Number(item.chance);
            if (!location || !Number.isFinite(chance)) return null;
            return {
                location,
                chance,
                rarity: typeof item.rarity === "string" ? item.rarity : undefined,
                type: typeof item.type === "string" ? item.type : undefined,
            };
        })
        .filter((entry): entry is DropEntry => entry !== null);

    return parsed.sort((a, b) => b.chance - a.chance).slice(0, 12);
}

function statLinesFor(entry: SearchEntityRecord | null): string[] {
    if (!entry || !Array.isArray(entry.levelStats) || entry.levelStats.length === 0) return [];
    const lastRank = entry.levelStats[entry.levelStats.length - 1];
    if (!lastRank || typeof lastRank !== "object") return [];
    const stats = (lastRank as { stats?: unknown }).stats;
    if (!Array.isArray(stats)) return [];
    return stats.filter((line): line is string => typeof line === "string" && line.trim().length > 0).slice(0, 10);
}

const DAMAGE_TYPE_ORDER: Array<keyof WeaponDamage> = [
    "impact",
    "puncture",
    "slash",
    "heat",
    "cold",
    "electricity",
    "toxin",
    "blast",
    "radiation",
    "gas",
    "magnetic",
    "viral",
    "corrosive",
    "void",
    "tau",
    "true",
];

function getWeaponStatRows(weapon: WeaponEntry): WeaponStatRow[] {
    return [
        { label: "Category", value: weapon.category },
        { label: "Weapon Type", value: weapon.weaponType || "—" },
        { label: "Mod Family", value: weapon.modCompat },
        { label: "Trigger", value: weapon.trigger || "—" },
        { label: weapon.category === "Melee" || weapon.category === "Arch-Melee" ? "Attack Speed" : "Fire Rate", value: `${formatDecimal(weapon.fireRate)}/s` },
        { label: "Crit Chance", value: formatCompactPercent(weapon.critChance) },
        { label: "Crit Multiplier", value: `${formatDecimal(weapon.critMultiplier)}x` },
        { label: "Status Chance", value: formatCompactPercent(weapon.statusChance) },
        { label: "Multishot", value: `${formatDecimal(weapon.multishot)}x` },
        { label: "Magazine", value: displayMagazineValue(weapon, weapon.magazineSize) },
        { label: "Reload", value: `${formatDecimal(weapon.reloadTime)}s` },
        { label: "Charge Time", value: weapon.chargeTime != null ? `${formatDecimal(weapon.chargeTime)}s` : "—" },
        { label: "Disposition", value: formatDecimal(weapon.disposition, 2) },
        { label: "Polarities", value: weapon.polarities.length > 0 ? weapon.polarities.map(titleCase).join(" · ") : "—" },
        { label: "Stance Family", value: weapon.stanceClasses?.length ? weapon.stanceClasses.join(" · ") : weapon.stanceClass ?? "—" },
        { label: "Overlevel", value: formatBool(weapon.canOverLevel) },
        { label: "Progenitor", value: formatBool(weapon.isProgenitorWeapon) },
        { label: "Attack Profiles", value: formatNumber(weapon.attacks.length) },
    ].filter((row) => row.value !== "—" || row.label === "Charge Time" || row.label === "Stance Family");
}

function getWeaponDamageRows(damage: WeaponDamage): Array<{ label: string; value: number; share: number }> {
    const total = damage.total > 0 ? damage.total : DAMAGE_TYPE_ORDER.reduce((sum, key) => sum + Number(damage[key] ?? 0), 0);
    return DAMAGE_TYPE_ORDER
        .map((key) => {
            const value = Number(damage[key] ?? 0);
            if (value <= 0) return null;
            return {
                label: key === "true" ? "True" : titleCase(key),
                value,
                share: total > 0 ? value / total : 0,
            };
        })
        .filter((row): row is { label: string; value: number; share: number } => row !== null)
        .sort((a, b) => b.value - a.value);
}

function getAttackStatRows(attack: WeaponAttack): WeaponStatRow[] {
    return [
        { label: "Speed", value: `${formatDecimal(attack.speed)}/s` },
        { label: "Crit Chance", value: formatCompactPercent(attack.critChance) },
        { label: "Crit Multiplier", value: `${formatDecimal(attack.critMultiplier)}x` },
        { label: "Status Chance", value: formatCompactPercent(attack.statusChance) },
        { label: "Charge Time", value: attack.chargeTime != null ? `${formatDecimal(attack.chargeTime)}s` : "—" },
        { label: "Damage", value: formatDecimal(attack.damageTotal, 2) },
    ].filter((row) => row.value !== "—" || row.label === "Charge Time");
}

function buildOverviewStats(args: {
    kind: SearchDetailRef["kind"];
    entitySubtitle: string;
    entry: SearchEntityRecord;
}): DetailMetaStat[] {
    const subtitleParts = splitCatalogSubtitle(args.entitySubtitle);
    const category = subtitleParts[0] ?? "Item";
    const specialization = subtitleParts.slice(1).join(" · ");
    const rarity = typeof args.entry.rarity === "string" && args.entry.rarity.trim() ? titleCase(args.entry.rarity) : "—";
    const compatibility = typeof args.entry.compatName === "string" && args.entry.compatName.trim() ? compactLabel(args.entry.compatName) : "—";
    const modSet = typeof args.entry.modSet === "string" && args.entry.modSet.trim() ? compactLabel(args.entry.modSet) : "—";
    const ducats = typeof args.entry.ducats === "number" ? formatNumber(args.entry.ducats) : "—";

    return [
        { label: "Category", value: category },
        ...(specialization ? [{ label: "Profile", value: specialization }] : []),
        ...(args.kind !== "item" && compatibility !== "—" ? [{ label: "Compatibility", value: compatibility }] : []),
        ...(rarity !== "—" ? [{ label: "Rarity", value: rarity }] : []),
        { label: "Release", value: formatDate(args.entry.releaseDate) },
        { label: "Tradable", value: formatBool(typeof args.entry.tradable === "boolean" ? args.entry.tradable : null) },
        { label: "Mastery Req", value: formatNumber(typeof args.entry.masteryReq === "number" ? args.entry.masteryReq : null) },
        { label: "Polarity", value: formatPolarity(args.entry.polarity) },
        { label: "Market Cost", value: formatNumber(typeof args.entry.marketCost === "number" ? args.entry.marketCost : null) },
        ...(ducats !== "—" ? [{ label: "Ducats", value: ducats }] : []),
        ...(modSet !== "—" ? [{ label: "Set", value: modSet }] : []),
    ].filter((item) => item.value !== "—" || item.label === "Tradable");
}

function isExplicitBlueprintItem(catalogId: string, name: string): boolean {
    const cidStr = String(catalogId).toLowerCase();
    const nm = String(name ?? "").toLowerCase();
    return nm.endsWith(" blueprint") || cidStr.endsWith("blueprint");
}

function isDirectMarketPurchasableOutput(catalogId: string): boolean {
    const rec = FULL_CATALOG.recordsById[catalogId as keyof typeof FULL_CATALOG.recordsById];
    const raw: any = rec?.raw as any;
    const data = raw?.rawLotus?.data ?? raw?.data ?? null;
    if (!data || typeof data !== "object") return false;

    const regularPrice = Number((data as any).RegularPrice ?? 0);
    const premiumPrice = Number((data as any).PremiumPrice ?? 0);
    return (Number.isFinite(regularPrice) && regularPrice > 0) || (Number.isFinite(premiumPrice) && premiumPrice > 0);
}

function getDirectRequirementsForCraftingTree(catalogId: string): ItemRequirementEdge[] {
    const rec = FULL_CATALOG.recordsById[catalogId as keyof typeof FULL_CATALOG.recordsById];
    const name = rec?.displayName ?? String(catalogId);
    const resolution = resolveItemRequirementGraph(catalogId as never);

    if (!isExplicitBlueprintItem(catalogId, name)) {
        const blueprintEdge = resolution.edges.find((edge) =>
            edge.provenance === "wfcd-output-blueprint" || edge.provenance === "derived-output-blueprint",
        );
        if (isDirectMarketPurchasableOutput(catalogId) && !blueprintEdge) return [];
        if (blueprintEdge) return [blueprintEdge];
    }

    return Array.isArray(resolution.edges) ? resolution.edges : [];
}

function getDisplayName(catalogId: string): string {
    return FULL_CATALOG.recordsById[catalogId as keyof typeof FULL_CATALOG.recordsById]?.displayName ?? catalogId;
}

function getAcquisitionSourcesForCatalogId(catalogId: string): Array<{ label: string; group: string }> {
    const acquisition = getAcquisitionByCatalogId(catalogId as never);
    if (!acquisition) return [];

    const seen = new Set<string>();
    return acquisition.sources
        .slice(0, 16)
        .map((sourceId) => formatSourceDisplayLabel(SOURCE_INDEX[sourceId as keyof typeof SOURCE_INDEX]?.label ?? sourceId))
        .filter((label) => {
            if (!label || seen.has(label)) return false;
            seen.add(label);
            return true;
        })
        .slice(0, 4)
        .map((label) => ({
            label,
            group: getSourceGroup(label),
        }));
}

function buildCraftingTree(catalogId: string, counts: Record<string, number>, depth = 0, seen = new Set<string>()): CraftingNode[] {
    if (depth > 4 || seen.has(catalogId)) return [];

    const nextSeen = new Set(seen);
    nextSeen.add(catalogId);

    const edges = getDirectRequirementsForCraftingTree(catalogId);
    return edges.map((edge) => ({
        catalogId: edge.catalogId,
        name: getDisplayName(edge.catalogId),
        count: edge.count,
        owned: Number(counts[edge.catalogId] ?? 0),
        acquisitionSources: getAcquisitionSourcesForCatalogId(edge.catalogId),
        children: buildCraftingTree(edge.catalogId, counts, depth + 1, nextSeen),
    }));
}

const CRAFTED_WITH_CACHE = new Map<string, CraftedWithEntry[]>();

function computeCraftedWithEntries(catalogId: string): CraftedWithEntry[] {
    const cached = CRAFTED_WITH_CACHE.get(catalogId);
    if (cached) return cached;

    const entries: CraftedWithEntry[] = [];

    for (const candidateId of FULL_CATALOG.displayableInventoryItemIds ?? []) {
        const rawCandidateId = String(candidateId);
        const edges = getDirectRequirementsForCraftingTree(rawCandidateId);
        if (edges.length === 0) continue;

        for (const edge of edges) {
            if (String(edge.catalogId) !== catalogId) continue;
            entries.push({
                catalogId: rawCandidateId,
                name: getDisplayName(rawCandidateId),
                count: edge.count,
            });
        }
    }

    entries.sort((a, b) => {
        if (a.name !== b.name) return a.name.localeCompare(b.name);
        return a.catalogId.localeCompare(b.catalogId);
    });

    const deduped = entries.filter((entry, index) => index === 0 || entry.catalogId !== entries[index - 1]?.catalogId);
    CRAFTED_WITH_CACHE.set(catalogId, deduped);
    return deduped;
}

function CraftingTreeNode(props: { node: CraftingNode; depth: number; onOpenDetail?: (catalogId: string) => void }) {
    const hasChildren = props.node.children.length > 0;
    const [expanded, setExpanded] = useState(props.depth < 1);
    const canOpenDetail = Boolean(getSearchDetailRefForCatalogId(props.node.catalogId as never));
    const setCount = useTrackerStore((s) => s.setCount);

    return (
        <div className="rounded-2xl border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] px-4 py-3">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        {canOpenDetail && props.onOpenDetail ? (
                            <button
                                type="button"
                                onClick={() => props.onOpenDetail?.(props.node.catalogId)}
                                className="text-left text-sm font-medium text-[color:var(--wf-accent-strong)] underline decoration-transparent underline-offset-4 transition hover:decoration-current"
                            >
                                {props.node.name}
                            </button>
                        ) : (
                            <div className="text-sm font-medium text-[color:var(--wf-text-strong)]">{props.node.name}</div>
                        )}
                        {hasChildren ? (
                            <button
                                type="button"
                                onClick={() => setExpanded((value) => !value)}
                                className="inline-flex items-center rounded-full border border-[color:var(--wf-border-subtle)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--wf-text-dim)] transition hover:border-[color:var(--wf-border-strong)] hover:text-[color:var(--wf-text-strong)]"
                                aria-expanded={expanded}
                            >
                                {expanded ? "Hide components" : `Show components (${props.node.children.length})`}
                            </button>
                        ) : null}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                        <div className="text-xs text-[color:var(--wf-text-dim)]">
                            Need {props.node.count} · Owned {props.node.owned}
                        </div>
                        <div
                            className="flex items-center overflow-hidden rounded-xl border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface)]"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <button
                                type="button"
                                className="flex h-8 w-8 items-center justify-center text-base text-[color:var(--wf-text-dim)] transition hover:bg-white/5 hover:text-[color:var(--wf-text-strong)] disabled:cursor-not-allowed disabled:opacity-35"
                                onClick={() => setCount(props.node.catalogId, Math.max(0, props.node.owned - 1))}
                                disabled={props.node.owned <= 0}
                                aria-label={`Decrease owned ${props.node.name}`}
                            >
                                -
                            </button>
                            <div className="min-w-[3rem] px-3 text-center text-sm font-semibold text-[color:var(--wf-text-strong)]">
                                {props.node.owned}
                            </div>
                            <button
                                type="button"
                                className="flex h-8 w-8 items-center justify-center text-base text-[color:var(--wf-text-dim)] transition hover:bg-white/5 hover:text-[color:var(--wf-text-strong)]"
                                onClick={() => setCount(props.node.catalogId, props.node.owned + 1)}
                                aria-label={`Increase owned ${props.node.name}`}
                            >
                                +
                            </button>
                        </div>
                    </div>
                    {props.node.acquisitionSources.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                            {props.node.acquisitionSources.map((source) => (
                                <div
                                    key={`${props.node.catalogId}-${source.group}-${source.label}`}
                                    className="rounded-full border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface)] px-2.5 py-1 text-[10px] leading-relaxed text-[color:var(--wf-text-muted)]"
                                >
                                    <span className="font-semibold uppercase tracking-[0.12em] text-[color:var(--wf-text-dim)]">{source.group}</span>
                                    {" · "}
                                    <span>{source.label}</span>
                                </div>
                            ))}
                        </div>
                    ) : null}
                </div>
                <div
                    className={[
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]",
                        props.node.owned >= props.node.count
                            ? "bg-emerald-500/10 text-emerald-300"
                            : "bg-amber-500/10 text-amber-200",
                    ].join(" ")}
                >
                    {props.node.owned >= props.node.count ? "Ready" : "Missing"}
                </div>
            </div>
            {hasChildren && expanded ? (
                <div className="mt-3 ml-4 space-y-3 border-l border-[color:var(--wf-border-subtle)] pl-4">
                    {props.node.children.map((child) => (
                        <CraftingTreeNode key={`${child.catalogId}-${props.depth + 1}`} node={child} depth={props.depth + 1} onOpenDetail={props.onOpenDetail} />
                    ))}
                </div>
            ) : null}
        </div>
    );
}

function CraftingTreeList(props: { nodes: CraftingNode[]; depth?: number; onOpenDetail?: (catalogId: string) => void }) {
    const depth = props.depth ?? 0;
    if (props.nodes.length === 0) return null;

    return (
        <div className={depth === 0 ? "space-y-3" : "ml-4 space-y-3 border-l border-[color:var(--wf-border-subtle)] pl-4"}>
            {props.nodes.map((node) => (
                <CraftingTreeNode key={`${node.catalogId}-${depth}`} node={node} depth={depth} onOpenDetail={props.onOpenDetail} />
            ))}
        </div>
    );
}

function StepperControl(props: StepperControlProps) {
    return (
        <div className="rounded-2xl border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] px-4 py-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--wf-text-dim)]">{props.label}</div>
                    {props.hint ? <div className="mt-1 text-xs text-[color:var(--wf-text-muted)]">{props.hint}</div> : null}
                </div>
                <div className="flex items-center overflow-hidden rounded-xl border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface)]">
                    <button
                        type="button"
                        className="flex h-10 w-10 items-center justify-center text-lg text-[color:var(--wf-text-dim)] transition hover:bg-white/5 hover:text-[color:var(--wf-text-strong)] disabled:cursor-not-allowed disabled:opacity-35"
                        onClick={props.onDecrease}
                        disabled={props.decreaseDisabled}
                    >
                        −
                    </button>
                    <div className="flex min-w-[3.5rem] items-center justify-center border-x border-[color:var(--wf-border-subtle)] px-3 text-sm font-semibold text-[color:var(--wf-text-strong)]">
                        {props.value}
                    </div>
                    <button
                        type="button"
                        className="flex h-10 w-10 items-center justify-center text-lg text-[color:var(--wf-text-dim)] transition hover:bg-white/5 hover:text-[color:var(--wf-text-strong)] disabled:cursor-not-allowed disabled:opacity-35"
                        onClick={props.onIncrease}
                        disabled={props.increaseDisabled}
                    >
                        +
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function SearchDetail(props: {
    detailRef: SearchDetailRef | null;
    onClose?: () => void;
    onNavigate?: (ref: SearchDetailRef) => void;
    canGoBack?: boolean;
    onBack?: () => void;
    mode?: "page" | "panel";
}) {
    const rootRef = useRef<HTMLDivElement | null>(null);
    const setActivePage = useTrackerStore((s) => s.setActivePage);
    const addGoalCatalog = useTrackerStore((s) => s.addGoalCatalog);
    const setCount = useTrackerStore((s) => s.setCount);
    const setModRank = useTrackerStore((s) => s.setModRank);
    const setArcaneRankCount = useTrackerStore((s) => s.setArcaneRankCount);
    const counts = useTrackerStore((s) => s.state.inventory.counts);
    const modRanks = useTrackerStore((s) => s.state.inventory.modRanks ?? EMPTY_MOD_RANKS);
    const arcaneRanks = useTrackerStore((s) => s.state.inventory.arcaneRanks ?? EMPTY_ARCANE_RANKS);
    const mastered = useTrackerStore((s) => s.state.mastery.mastered ?? EMPTY_MASTERY);
    const detailRef = props.detailRef;
    const mode = props.mode ?? "page";

    const entity = useMemo(() => (detailRef ? getSearchEntity(detailRef) : null), [detailRef]);
    const entry = useMemo(() => (detailRef ? getSearchEntityData(detailRef) : null), [detailRef]);
    const rawLotusData = useMemo(() => {
        if (!entry || typeof entry !== "object") return null;
        const data = (entry as Record<string, unknown>).data;
        return data && typeof data === "object" ? (data as Record<string, unknown>) : null;
    }, [entry]);
    const weapon = useMemo(() => {
        if (!detailRef || detailRef.kind !== "item") return null;
        return getWeaponCatalog().find((candidate) => candidate.uniqueName === detailRef.id) ?? null;
    }, [detailRef]);
    const catalogId = useMemo(() => (detailRef ? getCatalogIdForPath(detailRef.id) : null), [detailRef]);
    const acquisition = useMemo(() => (catalogId ? getAcquisitionByCatalogId(catalogId) : null), [catalogId]);
    const drops = useMemo(() => asDrops(entry?.drops), [entry]);
    const sourceEntries = useMemo<GroupedSourceEntry[]>(() => {
        const catalogEntries: GroupedSourceEntry[] = (acquisition?.sources ?? [])
            .filter((sourceId) => sourceId !== "data:crafting")
            .map((sourceId) => {
                const label = formatSourceDisplayLabel(SOURCE_INDEX[sourceId as keyof typeof SOURCE_INDEX]?.label ?? sourceId);
                const syndicateVendor = parseSyndicateVendorLabel(label);
                return {
                    id: `catalog:${sourceId}`,
                    family: classifySourceFamilyFromCatalog(sourceId, label),
                    dedupeKey: syndicateVendor?.vendorName ? `vendor:${syndicateVendor.vendorName}` : undefined,
                    title: syndicateVendor?.vendorName ?? label,
                    subtitle: syndicateVendor?.rankName
                        ? `Rank ${syndicateVendor.rankNumber ?? "?"} · ${syndicateVendor.rankName}`
                        : undefined,
                    meta: getCatalogSourceMeta(entry, rawLotusData, sourceId, label) ?? undefined,
                };
            });

        const dropEntries: GroupedSourceEntry[] = drops.map((drop) => {
            const rarity = drop.rarity ?? drop.type ?? null;
            return {
                id: `drop:${drop.location}:${drop.chance}`,
                family: classifySourceFamilyFromDropLocation(drop.location),
                title: drop.location,
                meta: extractInlinePriceMeta(drop.location) ?? formatDropPercent(drop.chance),
                href: buildWikiUrl(drop.location, "Farming_Locations"),
                badges: rarity ? [{ label: rarity, tone: "neutral" }] : [],
            };
        });

        const seen = new Set<string>();
        return [...catalogEntries, ...dropEntries].filter((entry) => {
            const key = `${entry.family}:${entry.title}:${entry.meta ?? ""}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }, [acquisition?.sources, drops, entry, rawLotusData]);
    const stats = useMemo(() => statLinesFor(entry), [entry]);
    const weaponStats = useMemo(() => (weapon ? getWeaponStatRows(weapon) : []), [weapon]);
    const weaponDamageRows = useMemo(() => (weapon ? getWeaponDamageRows(weapon.damage) : []), [weapon]);
    const overviewStats = useMemo(
        () => buildOverviewStats({ kind: detailRef?.kind ?? "item", entitySubtitle: entity?.subtitle ?? "", entry: entry ?? {} }),
        [detailRef?.kind, entity?.subtitle, entry],
    );
    const descriptionNode = useMemo(
        () => renderCodexText(buildSupportingDescription(entity?.subtitle ?? "", entry?.description)),
        [entity?.subtitle, entry?.description],
    );
    const craftingTree = useMemo(
        () => (detailRef?.kind === "item" && catalogId ? buildCraftingTree(catalogId, counts) : []),
        [catalogId, counts, detailRef?.kind],
    );
    const [craftedWithEntries, setCraftedWithEntries] = useState<CraftedWithEntry[]>([]);
    const [craftedWithLoading, setCraftedWithLoading] = useState(false);
    const [showAllCraftedWith, setShowAllCraftedWith] = useState(false);

    const imageUrl = getSearchEntityImageUrl(entry);
    const isBlueprint = isBlueprintName(entity?.name ?? null) || (catalogId ? String(catalogId).toLowerCase().endsWith("blueprint") : false);
    const blueprintOverlayUrl = useMemo(
        () => getBlueprintOverlayImage(entity?.name ?? null, imageUrl),
        [entity?.name, imageUrl],
    );
    const wikiUrl = getSearchEntityWikiUrl(entry, entity?.name);
    const countKey = detailRef?.kind === "item" ? catalogId : detailRef?.kind === "mod" ? `mods:${detailRef.id}` : null;
    const maxRank = useMemo(() => {
        if (typeof entry?.fusionLimit === "number") return entry.fusionLimit;
        if (detailRef?.kind === "arcane") {
            if (Array.isArray(entry?.levelStats) && entry.levelStats.length > 0) {
                return Math.max(0, entry.levelStats.length - 1);
            }
            const raw = catalogId ? (FULL_CATALOG.recordsById[catalogId]?.raw as { rawLotus?: { levelStats?: unknown[] } } | undefined) : undefined;
            if (Array.isArray(raw?.rawLotus?.levelStats) && raw.rawLotus.levelStats.length > 0) {
                return Math.max(0, raw.rawLotus.levelStats.length - 1);
            }
            return 5;
        }
        return 0;
    }, [catalogId, detailRef?.kind, entry?.fusionLimit, entry?.levelStats]);
    const ownedCount = countKey ? Number(counts[countKey] ?? 0) : 0;
    const ownedRank = detailRef?.kind === "mod" ? Number(modRanks[detailRef.id] ?? 0) : null;
    const ownedArcaneRanks = detailRef?.kind === "arcane" ? arcaneRanks[detailRef.id] ?? {} : {};
    const fallbackArcaneCount = detailRef?.kind === "arcane" ? Number(counts[`mods:${detailRef.id}`] ?? counts[detailRef.id] ?? 0) : 0;
    const highestOwnedArcaneRank = detailRef?.kind === "arcane" ? getHighestOwnedArcaneRankWithFallback(ownedArcaneRanks, fallbackArcaneCount) : null;
    const isMastered = catalogId ? Boolean(mastered[catalogId]) : null;
    const isOwned = detailRef?.kind === "arcane" ? highestOwnedArcaneRank !== null : ownedCount > 0;

    useEffect(() => {
        setShowAllCraftedWith(false);

        if (detailRef?.kind !== "item" || !catalogId) {
            setCraftedWithEntries([]);
            setCraftedWithLoading(false);
            return;
        }

        const cached = CRAFTED_WITH_CACHE.get(catalogId);
        if (cached) {
            setCraftedWithEntries(cached.filter((entry) => entry.catalogId !== catalogId));
            setCraftedWithLoading(false);
            return;
        }

        setCraftedWithEntries([]);
        setCraftedWithLoading(true);

        const timer = window.setTimeout(() => {
            const nextEntries = computeCraftedWithEntries(catalogId).filter((entry) => entry.catalogId !== catalogId);
            startTransition(() => {
                setCraftedWithEntries(nextEntries);
                setCraftedWithLoading(false);
            });
        }, 0);

        return () => window.clearTimeout(timer);
    }, [catalogId, detailRef?.kind]);

    useEffect(() => {
        const root = rootRef.current;
        if (!root || !detailRef) return;

        const frame = window.requestAnimationFrame(() => {
            if (mode === "page") {
                window.scrollTo({ top: 0, behavior: "auto" });
                return;
            }

            let current: HTMLElement | null = root.parentElement;
            while (current) {
                const isScrollable = current.scrollHeight > current.clientHeight && /(auto|scroll)/.test(window.getComputedStyle(current).overflowY);
                if (isScrollable) {
                    current.scrollTo({ top: 0, behavior: "auto" });
                    return;
                }
                current = current.parentElement;
            }

            root.scrollIntoView({ block: "start" });
        });

        return () => window.cancelAnimationFrame(frame);
    }, [detailRef, mode]);

    function closePanel() {
        if (props.onClose) {
            props.onClose();
            return;
        }
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }

    function clearDetailAndGo(page: "dashboard" | "inventory" | "mods" | "arcanes") {
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
        setActivePage(page);
    }

    function openCatalogDetail(catalogId: string) {
        const nextRef = getSearchDetailRefForCatalogId(catalogId as never);
        if (!nextRef) return;

        if (props.onNavigate) {
            props.onNavigate(nextRef);
            return;
        }

        window.location.hash = buildSearchDetailHash(nextRef);
    }

    function toggleOwnedState() {
        if (!detailRef) return;
        if (detailRef.kind === "arcane") {
            if (!isOwned) {
                setArcaneRankCount(detailRef.id, 0, 1);
            } else {
                setArcaneRankCount(detailRef.id, 0, 0);
            }
            return;
        }

        if (!countKey) return;
        if (isOwned) {
            setCount(countKey, 0);
            if (detailRef.kind === "mod") setModRank(detailRef.id, 0);
            return;
        }

        setCount(countKey, 1);
        if (detailRef.kind === "mod") {
            setModRank(detailRef.id, maxRank > 0 ? maxRank : 0);
        }
    }

    if (!detailRef || !entity || !entry) {
        return (
            <div className="space-y-4">
                <WorkspaceHero
                    eyebrow="Search Detail"
                    title="Dossier not found"
                    description="This detail link is missing or no longer matches a catalog entry."
                    actions={<WorkspaceAction onClick={() => (mode === "panel" ? closePanel() : clearDetailAndGo("dashboard"))}>{mode === "panel" ? "Close Panel" : "Return to Dashboard"}</WorkspaceAction>}
                />
            </div>
        );
    }

    return (
        <div ref={rootRef} className="space-y-5">
            <WorkspaceHero
                eyebrow={detailRef.kind === "item" ? "Item Dossier" : detailRef.kind === "mod" ? "Mod Dossier" : "Arcane Dossier"}
                title={entity.name}
                description=""
                actions={
                    <>
                        {catalogId ? (
                            <WorkspaceAction onClick={() => addGoalCatalog(catalogId, 1, detailRef.kind === "item" ? "item" : detailRef.kind)}>
                                Add Goal
                            </WorkspaceAction>
                        ) : null}
                        {mode === "panel" && props.canGoBack ? (
                            <WorkspaceAction onClick={props.onBack}>Back</WorkspaceAction>
                        ) : null}
                        <WorkspaceAction onClick={toggleOwnedState}>
                            {isOwned ? "Mark Unowned" : "Mark Owned"}
                        </WorkspaceAction>
                        {wikiUrl ? (
                            <WorkspaceAction onClick={() => window.open(wikiUrl, "_blank", "noopener,noreferrer")}>Wiki</WorkspaceAction>
                        ) : null}
                        <WorkspaceAction onClick={() => (mode === "panel" ? closePanel() : clearDetailAndGo("dashboard"))}>
                            {mode === "panel" ? "Close Panel" : "Close View"}
                        </WorkspaceAction>
                    </>
                }
                stats={
                    <>
                        <WorkspaceStat label="Owned" value={detailRef.kind === "arcane" ? formatBool(isOwned) : ownedCount} hint={cleanCatalogSubtitle(entity.subtitle)} />
                        <WorkspaceStat label="Mastered" value={formatBool(isMastered)} hint="Progress tracker" />
                        <WorkspaceStat label="Max Rank" value={formatNumber(maxRank > 0 || detailRef.kind === "arcane" ? maxRank : (typeof entry.fusionLimit === "number" ? entry.fusionLimit : null))} hint={detailRef.kind === "item" ? "Upgradeable entries only" : "Catalog max rank"} />
                        <WorkspaceStat
                            label="Tracked Rank"
                            value={detailRef.kind === "arcane" ? (highestOwnedArcaneRank === null ? "—" : `R${highestOwnedArcaneRank}`) : formatNumber(ownedRank)}
                            hint="Highest owned rank"
                        />
                    </>
                }
                className="overflow-hidden"
            />
            <div className="-mt-1 px-1 text-sm leading-7 text-[color:var(--wf-text-muted)]">
                {descriptionNode}
            </div>

            <WorkspaceSection
                title="Collection"
                subtitle={detailRef.kind === "arcane" ? "Track the highest owned arcane rank directly from the inspector." : "Update owned state and collection progress without leaving the panel."}
            >
                {detailRef.kind === "arcane" ? (
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] px-4 py-4">
                            <div>
                                <div className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--wf-text-dim)]">Ownership</div>
                                <div className="mt-2 text-lg font-medium text-[color:var(--wf-text-strong)]">{isOwned ? "Owned" : "Not owned"}</div>
                                <div className="mt-1 text-sm text-[color:var(--wf-text-muted)]">
                                    {highestOwnedArcaneRank === null ? "No owned rank tracked yet." : `Highest owned rank: R${highestOwnedArcaneRank}`}
                                </div>
                            </div>
                            <WorkspaceAction onClick={toggleOwnedState}>{isOwned ? "Mark Unowned" : "Mark Owned at Rank 0"}</WorkspaceAction>
                        </div>
                        <div className="flex items-center gap-1.5 overflow-x-auto pr-1">
                            {Array.from({ length: maxRank + 1 }, (_, rank) => {
                                const isSelected = highestOwnedArcaneRank === rank;
                                return (
                                    <button
                                        key={rank}
                                        className={[
                                            "w-[68px] shrink-0 rounded-xl border px-2 py-2 text-[11px] font-semibold transition-colors",
                                            isSelected
                                                ? "border-emerald-700/60 bg-emerald-950/35 text-emerald-200"
                                                : "border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] text-[color:var(--wf-text-muted)] hover:border-[color:var(--wf-border-strong)] hover:text-[color:var(--wf-text-strong)]",
                                        ].join(" ")}
                                        onClick={() => setArcaneRankCount(detailRef.id, rank, isSelected ? 0 : 1)}
                                    >
                                        <span className="block text-[10px] uppercase tracking-[0.14em] text-[color:var(--wf-text-dim)]">
                                            R{rank}
                                        </span>
                                    </button>
                                );
                            })}
                            <button
                                className="shrink-0 rounded-xl border border-[color:var(--wf-border-subtle)] bg-transparent px-3 py-2 text-[11px] font-semibold text-[color:var(--wf-text-dim)] transition-colors hover:border-[color:var(--wf-border-strong)] hover:text-[color:var(--wf-text-strong)]"
                                onClick={() => setArcaneRankCount(detailRef.id, 0, 0)}
                            >
                                Clear
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="grid gap-3 lg:grid-cols-2">
                        <StepperControl
                            label="Owned Copies"
                            value={ownedCount}
                            hint={detailRef.kind === "mod" ? "Collection count for this mod" : "Collection count for this item"}
                            onDecrease={() => {
                                if (!countKey) return;
                                const nextCount = Math.max(0, ownedCount - 1);
                                setCount(countKey, nextCount);
                                if (detailRef.kind === "mod" && nextCount === 0) setModRank(detailRef.id, 0);
                            }}
                            onIncrease={() => {
                                if (!countKey) return;
                                const wasUnowned = ownedCount <= 0;
                                setCount(countKey, ownedCount + 1);
                                if (detailRef.kind === "mod" && wasUnowned && maxRank > 0) setModRank(detailRef.id, maxRank);
                            }}
                            decreaseDisabled={ownedCount <= 0}
                        />
                        {detailRef.kind === "mod" ? (
                            <StepperControl
                                label="Tracked Rank"
                                value={`R${ownedRank ?? 0}`}
                                hint={maxRank > 0 ? `Highest owned rank, up to R${maxRank}` : "Highest owned rank"}
                                onDecrease={() => setModRank(detailRef.id, Math.max(0, Number(ownedRank ?? 0) - 1))}
                                onIncrease={() => setModRank(detailRef.id, Math.min(maxRank, Number(ownedRank ?? 0) + 1))}
                                decreaseDisabled={ownedCount <= 0 || Number(ownedRank ?? 0) <= 0}
                                increaseDisabled={ownedCount <= 0 || Number(ownedRank ?? 0) >= maxRank}
                            />
                        ) : (
                            <div className="rounded-2xl border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] px-4 py-4">
                                <div className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--wf-text-dim)]">Ownership</div>
                                <div className="mt-2 text-lg font-medium text-[color:var(--wf-text-strong)]">{isOwned ? "Owned" : "Not owned"}</div>
                                <div className="mt-1 text-sm leading-6 text-[color:var(--wf-text-muted)]">
                                    Use the counter to reflect how many copies you currently have in inventory.
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </WorkspaceSection>

            <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
                <WorkspaceSection
                    title="Overview"
                    subtitle="Clean reference details, tuned for scanning instead of raw catalog debugging."
                >
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
                        <div className="overflow-hidden rounded-[28px] border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-2)]">
                            {isBlueprint ? (
                                <div className="relative flex min-h-[280px] items-center justify-center overflow-hidden px-6 py-8">
                                    <img
                                        src={blueprintTemplateUrl}
                                        alt="Blueprint template"
                                        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-95"
                                        loading="lazy"
                                    />
                                <div className="pointer-events-none absolute inset-0 bg-[color:var(--wf-hover)]" />
                                    {blueprintOverlayUrl ? (
                                        <img
                                            src={blueprintOverlayUrl}
                                            alt={entity.name}
                                            className="relative z-[1] h-full max-h-[220px] w-full max-w-[320px] object-contain drop-shadow-[0_22px_36px_rgba(2,6,23,0.55)]"
                                            loading="lazy"
                                        />
                                    ) : (
                                        <div className="relative z-[1] rounded-full border border-white/10 bg-slate-950/35 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-200/80">
                                            Blueprint
                                        </div>
                                    )}
                                </div>
                            ) : imageUrl ? (
                                <img
                                    src={imageUrl}
                                    alt={entity.name}
                                    className="h-full min-h-[280px] w-full object-contain p-6"
                                    loading="lazy"
                                />
                            ) : (
                                <div className="flex min-h-[280px] items-center justify-center bg-[color:var(--wf-surface-2)] px-6 text-center text-sm text-[color:var(--wf-text-dim)]">
                                    No artwork available for this entry.
                                </div>
                            )}
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            {overviewStats.map((item) => (
                                <div key={item.label} className="rounded-2xl border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] px-4 py-4">
                                    <div className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--wf-text-dim)]">{item.label}</div>
                                    <div className="mt-2 text-lg font-medium leading-tight text-[color:var(--wf-text-strong)]">{item.value}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </WorkspaceSection>

                <WorkspaceSection
                    title="Actions"
                    subtitle="Continue from the inspector without breaking your flow."
                >
                    <div className="grid gap-3">
                        <WorkspaceAction onClick={() => clearDetailAndGo("inventory")} className="justify-start">
                            Open Inventory Workspace
                        </WorkspaceAction>
                        <WorkspaceAction onClick={() => clearDetailAndGo(weapon ? "mods" : detailRef.kind === "arcane" ? "arcanes" : "mods")} className="justify-start">
                            {weapon ? "Open Mod Builder Workspace" : detailRef.kind === "arcane" ? "Open Arcanes Workspace" : "Open Mods Workspace"}
                        </WorkspaceAction>
                        <WorkspaceAction
                            onClick={() => {
                                navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}${window.location.search}${buildSearchDetailHash(detailRef)}`).catch(() => undefined);
                            }}
                            className="justify-start"
                        >
                            Copy Deep Link
                        </WorkspaceAction>
                        <div className="rounded-2xl border border-dashed border-[color:var(--wf-border-subtle)] px-4 py-3 text-sm leading-relaxed text-[color:var(--wf-text-muted)]">
                            Keep the inspector open while browsing builds, drops, or mods in the background.
                        </div>
                    </div>
                </WorkspaceSection>
            </div>

            {stats.length > 0 ? (
                <WorkspaceSection title="Key Effects" subtitle="Highest-rank effect lines at a glance.">
                    <div className="grid gap-2 md:grid-cols-2">
                        {stats.map((line) => (
                            <div
                                key={line}
                                className="rounded-2xl border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] px-4 py-3 text-sm leading-6 text-[color:var(--wf-text)]"
                            >
                                {renderCodexText(line)}
                            </div>
                        ))}
                    </div>
                </WorkspaceSection>
            ) : null}

            {weapon ? (
                <>
                    <WorkspaceSection title="Weapon Stats" subtitle="Full base weapon profile from the normalized weapon catalog.">
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {weaponStats.map((item) => (
                                <div key={item.label} className="rounded-2xl border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] px-4 py-4">
                                    <div className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--wf-text-dim)]">{item.label}</div>
                                    <div className="mt-2 text-lg font-medium leading-tight text-[color:var(--wf-text-strong)]">{item.value}</div>
                                    {item.hint ? <div className="mt-1 text-sm text-[color:var(--wf-text-muted)]">{item.hint}</div> : null}
                                </div>
                            ))}
                        </div>
                    </WorkspaceSection>

                    <WorkspaceSection title="Damage Breakdown" subtitle={`Base damage split across all active types (${formatDecimal(weapon.damage.total, 2)} total).`}>
                        <div className="space-y-3">
                            {weaponDamageRows.map((row) => (
                                <div key={row.label} className="rounded-2xl border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] px-4 py-4">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <div className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--wf-text-dim)]">{row.label}</div>
                                            <div className="mt-2 text-lg font-medium text-[color:var(--wf-text-strong)]">{formatDecimal(row.value, 2)}</div>
                                        </div>
                                        <div className="min-w-[140px] text-right">
                                            <div className="text-sm font-medium text-[color:var(--wf-text-strong)]">{formatCompactPercent(row.share, 1)}</div>
                                            <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/20">
                                                <div
                                                    className="h-full rounded-full bg-[color:var(--wf-accent-strong)]"
                                                    style={{ width: `${Math.max(4, Math.min(100, row.share * 100))}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </WorkspaceSection>

                    {weapon.attacks.length > 0 ? (
                        <WorkspaceSection title="Attack Profiles" subtitle="Named attacks available on this weapon and their individual stats.">
                            <div className="grid gap-4 xl:grid-cols-2">
                                {weapon.attacks.map((attack) => {
                                    const attackDamageRows = getWeaponDamageRows(attack.damage);
                                    return (
                                        <div key={attack.name} className="rounded-[28px] border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] px-5 py-5">
                                            <div className="flex items-start justify-between gap-4">
                                                <div>
                                                    <div className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--wf-text-dim)]">Attack</div>
                                                    <div className="mt-2 text-xl font-semibold text-[color:var(--wf-text-strong)]">{attack.name}</div>
                                                </div>
                                                <div className="rounded-full border border-[color:var(--wf-border-subtle)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--wf-text-dim)]">
                                                    {formatDecimal(attack.damageTotal, 2)} dmg
                                                </div>
                                            </div>
                                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                                {getAttackStatRows(attack).map((item) => (
                                                    <div key={`${attack.name}-${item.label}`} className="rounded-2xl border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface)] px-4 py-3">
                                                        <div className="text-[11px] uppercase tracking-[0.14em] text-[color:var(--wf-text-dim)]">{item.label}</div>
                                                        <div className="mt-2 text-base font-medium text-[color:var(--wf-text-strong)]">{item.value}</div>
                                                    </div>
                                                ))}
                                            </div>
                                            {attackDamageRows.length > 0 ? (
                                                <div className="mt-4 space-y-2">
                                                    {attackDamageRows.map((row) => (
                                                        <div key={`${attack.name}-${row.label}`} className="flex items-center justify-between gap-4 rounded-2xl border border-[color:var(--wf-border-subtle)] px-4 py-3 text-sm">
                                                            <div className="text-[color:var(--wf-text-strong)]">{row.label}</div>
                                                            <div className="text-right text-[color:var(--wf-text-muted)]">
                                                                {formatDecimal(row.value, 2)} · {formatCompactPercent(row.share, 1)}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : null}
                                        </div>
                                    );
                                })}
                            </div>
                        </WorkspaceSection>
                    ) : null}
                </>
            ) : null}

            {sourceEntries.length > 0 ? (
                <WorkspaceSection title="Source Locations" subtitle="Toggle between vendors, mission rewards, caches, relics, and other acquisition paths.">
                    <GroupedSourceList entries={sourceEntries} />
                </WorkspaceSection>
            ) : null}

            {craftingTree.length > 0 ? (
                <WorkspaceSection title="Crafting Tree" subtitle="Build path and component requirements for this crafted item.">
                    <CraftingTreeList nodes={craftingTree} onOpenDetail={openCatalogDetail} />
                </WorkspaceSection>
            ) : null}

            {craftedWithLoading || craftedWithEntries.length > 0 ? (
                <WorkspaceSection
                    title="Used In"
                    subtitle="Items and blueprints that directly consume this entry as a crafting requirement."
                >
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="text-sm text-[color:var(--wf-text-muted)]">
                                {craftedWithLoading
                                    ? "Scanning direct crafting results..."
                                    : `${craftedWithEntries.length} direct crafting result${craftedWithEntries.length === 1 ? "" : "s"}`}
                            </div>
                            {craftedWithEntries.length > 10 ? (
                                <button
                                    type="button"
                                    onClick={() => setShowAllCraftedWith((value) => !value)}
                                    className="inline-flex items-center rounded-full border border-[color:var(--wf-border-subtle)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--wf-text-dim)] transition hover:border-[color:var(--wf-border-strong)] hover:text-[color:var(--wf-text-strong)]"
                                >
                                    {showAllCraftedWith ? "Show Top 10" : `Show All (${craftedWithEntries.length})`}
                                </button>
                            ) : null}
                        </div>

                        <div
                            className={[
                                "overflow-hidden rounded-[24px] border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)]",
                                showAllCraftedWith && craftedWithEntries.length > 10 ? "max-h-[26rem] overflow-y-auto" : "",
                            ].join(" ")}
                        >
                            {craftedWithLoading ? (
                                <div className="px-4 py-4 text-sm text-[color:var(--wf-text-muted)]">
                                    Building reverse crafting references for this item...
                                </div>
                            ) : null}
                            {(showAllCraftedWith ? craftedWithEntries : craftedWithEntries.slice(0, 10)).map((crafted) => {
                                const canOpenDetail = Boolean(getSearchDetailRefForCatalogId(crafted.catalogId as never));
                                const row = (
                                    <>
                                        <div className="min-w-0">
                                            <div className="text-sm font-medium text-[color:var(--wf-text-strong)]">{crafted.name}</div>
                                            <div className="mt-1 text-xs text-[color:var(--wf-text-muted)]">Consumes {crafted.count} in its direct recipe</div>
                                        </div>
                                        <div className="shrink-0 rounded-full border border-[color:var(--wf-border-subtle)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--wf-text-dim)]">
                                            ×{crafted.count}
                                        </div>
                                    </>
                                );

                                if (canOpenDetail) {
                                    return (
                                        <button
                                            key={`${crafted.catalogId}-${crafted.count}`}
                                            type="button"
                                            onClick={() => openCatalogDetail(crafted.catalogId)}
                                            className="flex w-full items-center justify-between gap-4 border-t border-[color:var(--wf-border-subtle)] px-4 py-3 text-left transition first:border-t-0 hover:bg-white/5"
                                        >
                                            {row}
                                        </button>
                                    );
                                }

                                return (
                                    <div
                                        key={`${crafted.catalogId}-${crafted.count}`}
                                        className="flex items-center justify-between gap-4 border-t border-[color:var(--wf-border-subtle)] px-4 py-3 first:border-t-0"
                                    >
                                        {row}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </WorkspaceSection>
            ) : null}

        </div>
    );
}
