import { FULL_CATALOG, type CatalogId } from "../domain/catalog/loadFullCatalog";
import type { AlecaFrameCatalogMatch } from "./alecaFrameImport";

const LEGENDARY_CORE_UPGRADE_PATH = "/Lotus/Upgrades/Mods/Fusers/LegendaryModFuser";
const LEGENDARY_CORE_ITEM_PATH = "/Lotus/StoreItems/Upgrades/Mods/Fusers/LegendaryModFuser";

function isUpgradeSection(section: string): boolean {
  return section === "RawUpgrades" || section === "Upgrades";
}

/** Exact Lotus-path resolver used by the AlecaFrame review and importer. */
export function exactAlecaFrameCatalogMatch(path: string, section: string): AlecaFrameCatalogMatch | null {
  if (isUpgradeSection(section)) {
    // Legendary Core is a non-equippable, rank-zero fusion consumable. AlecaFrame
    // stores it as a stacked RawUpgrades record, while the inventory catalog
    // exposes its exact store identity under /Lotus/StoreItems/.
    const isStackedLegendaryCore = section === "RawUpgrades" && path === LEGENDARY_CORE_UPGRADE_PATH;
    const itemPath = isStackedLegendaryCore ? LEGENDARY_CORE_ITEM_PATH : path;
    const itemId = "items:" + itemPath;
    const item = FULL_CATALOG.recordsById[itemId as CatalogId];
    if (item && (item.categories.includes("Peely Pix") || isStackedLegendaryCore)) {
      return {
        catalogId: itemId,
        kind: "item",
        ...(section === "RawUpgrades" ? { rawUpgradeItem: true } : {}),
      };
    }

    const rivenId = "rivens:" + path;
    const riven = FULL_CATALOG.recordsById[rivenId as CatalogId];
    if (riven) return { catalogId: rivenId, kind: "riven" };

    const modId = "mods:" + path;
    const mod = FULL_CATALOG.recordsById[modId as CatalogId];
    if (!mod) return null;
    const raw = mod.raw && typeof mod.raw === "object" ? mod.raw as Record<string, unknown> : {};
    const type = String(raw.type ?? "").toLowerCase();
    const arcane = path.startsWith("/Lotus/Upgrades/CosmeticEnhancers/") ||
      type === "arcane" || type.includes("arcane") ||
      mod.categories.some((category) => category.toLowerCase().includes("arcane"));
    return { catalogId: modId, kind: arcane ? "arcane" : "mod" };
  }
  const itemId = "items:" + path;
  return FULL_CATALOG.recordsById[itemId as CatalogId]
    ? { catalogId: itemId, kind: "item" }
    : null;
}
