import { describe, expect, it } from "vitest";
import publicItems from "../../../data/_generated/public-export-items.auto.json";
import publicUpgrades from "../../../data/_generated/public-export-mods.auto.json";
import legacyUpgrades from "../../../data/_generated/legacy-upgrades.auto.json";
import { FULL_CATALOG } from "../loadFullCatalog";

describe("Public Export Plus catalog integration", () => {
    it("loads every generated item identity into the inventory catalog", () => {
        const entries = Object.entries(publicItems);
        expect(entries.length).toBeGreaterThan(0);
        for (const [path] of entries) {
            expect(FULL_CATALOG.recordsById[`items:${path}`]).toMatchObject({
                source: "items",
                path,
                isDisplayable: true,
            });
            expect(FULL_CATALOG.inventoryItemIds).toContain(`items:${path}`);
        }
    });

    it("loads the complete generic Peely Pix name map as counted inventory items", () => {
        const entries = Object.entries(publicItems).filter(([, record]) => record.category === "Peely Pix");
        expect(entries).toHaveLength(25);
        for (const [path, record] of entries) {
            expect(FULL_CATALOG.recordsById[`items:${path}`]).toMatchObject({
                source: "items",
                path,
                displayName: record.name,
                categories: ["Peely Pix"],
                isDisplayable: true,
            });
            expect(FULL_CATALOG.inventoryItemIds).toContain(`items:${path}`);
        }
    });

    it("loads exact upgrade and Riven identities into their matching catalogs", () => {
        const upgradeData = publicUpgrades as {
            mods: Record<string, { name: string }>;
            rivens: Record<string, { name: string }>;
        };
        for (const [path, record] of Object.entries(upgradeData.mods)) {
            expect(FULL_CATALOG.recordsById[`mods:${path}`]).toMatchObject({
                source: "mods",
                path,
                displayName: record.name,
            });
        }
        for (const [path, record] of Object.entries(upgradeData.rivens)) {
            expect(FULL_CATALOG.recordsById[`rivens:${path}`]).toMatchObject({
                source: "rivens",
                path,
                displayName: record.name,
            });
        }
    });

    it("loads legacy exact upgrade fallbacks only where the maintained catalogs have no record", () => {
        const entries = Object.entries(legacyUpgrades as Record<string, { name: string; type?: string }>);
        expect(entries.length).toBeGreaterThan(0);
        for (const [path, record] of entries) {
            expect(FULL_CATALOG.recordsById[`mods:${path}`]).toMatchObject({
                source: "mods",
                path,
                displayName: record.name,
            });
            expect(FULL_CATALOG.recordsById[`mods:${path}`]?.raw).toMatchObject({
                type: record.type,
                identitySource: "IhToN/warframe-item-data",
            });
        }
    });
});
