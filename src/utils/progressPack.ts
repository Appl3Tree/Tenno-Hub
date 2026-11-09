// src/utils/progressPack.ts

/**
 * Progress Pack helpers
 *
 * This file was empty. It is now the single place for:
 * - schema validation (v2)
 * - export/import helpers for the pack format
 *
 * Store still owns merge logic; this module just validates and normalizes.
 */

import { z } from "zod";

export const PlatformSchema = z.enum(["PC", "PlayStation", "Xbox", "Switch", "Mobile", "Android"]);

export const InventorySchema = z.object({
    credits: z.number().int().min(0),
    platinum: z.number().int().min(0),
    counts: z.record(z.string(), z.number().nonnegative())
});

export const ProgressPackSchemaV2 = z
    .object({
        meta: z
            .object({
                schemaVersion: z.literal(2),
                createdAtIso: z.string(),
                updatedAtIso: z.string()
            })
            .passthrough(),
        player: z
            .object({
                platform: PlatformSchema.optional(),
                accountId: z.string().optional(),
                displayName: z.string().optional(),
                masteryRank: z.number().nullable().optional(),
                clanName: z.string().optional(),
                clanTier: z.number().optional(),
                clanClass: z.number().optional(),
                clanXp: z.number().optional()
            })
            .passthrough()
            .optional(),
        ui: z
            .object({
                activePage: z.string()
            })
            .passthrough()
            .optional(),
        prereqs: z
            .object({
                completed: z.record(z.string(), z.boolean())
            })
            .passthrough()
            .optional(),
        inventory: InventorySchema.optional(),
        syndicates: z.any().optional(),
        dailyTasks: z.any().optional(),
        goals: z.any().optional(),
        mastery: z.any().optional(),
        missions: z.any().optional()
    })
    .passthrough();

export type ProgressPackV2 = z.infer<typeof ProgressPackSchemaV2>;

export function parseProgressPackV2(jsonText: string): { ok: true; data: ProgressPackV2 } | { ok: false; error: string } {
    try {
        const parsed = JSON.parse(jsonText);
        const ok = ProgressPackSchemaV2.safeParse(parsed);
        if (!ok.success) {
            return { ok: false, error: "Invalid Progress Pack (schema v2 required)." };
        }
        return { ok: true, data: ok.data };
    } catch {
        return { ok: false, error: "Invalid JSON." };
    }
}

