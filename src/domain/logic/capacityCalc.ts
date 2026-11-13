// src/domain/logic/capacityCalc.ts
// Warframe mod capacity system, per the wiki:
// https://wiki.warframe.com/w/Mod_Capacity
//
// Key rules:
//  - Base capacity = weapon rank (max 30 normally, 40 for Kuva/Tenet/Coda)
//  - Orokin Catalyst doubles available capacity
//  - Minimum mod capacity = 15 + floor(MR / 2); +1 per Legendary Rank after MR 30
//  - Mod drain at rank r = baseDrain + r  (max rank r = fusionLimit)
//  - Matching polarity: halves drain, ceil((drain)/2)
//  - Non-matching polarity: increases drain by 25%, rounded up
//  - Aura mods (baseDrain < 0): GRANT capacity instead of consuming it
//    - Base grant = |baseDrain| + fusionLimit
//    - Matching polarity: doubles the grant
//    - Non-matching polarity: grants 80%, rounded down

import type { ModEntry } from "../catalog/modCatalog";

// ── Polarity helpers ──────────────────────────────────────────────────────────

/**
 * Returns the effective drain cost of a mod in a given slot polarity,
 * at a given mod rank (0 = unranked, fusionLimit = max rank).
 *
 * For aura mods this returns a negative number representing the capacity
 * ADDED (so it can be summed with regular drain costs to get net usage).
 */
export function effectiveDrain(
    mod: ModEntry,
    slotPolarity: string,
    modRank?: number,
): number {
    const rank = modRank ?? mod.fusionLimit; // default to max rank
    const rawDrain = mod.baseDrain + rank;
    const hasModPolarity = Boolean(mod.polarity && mod.polarity !== "none");
    const hasSlotPolarity = Boolean(slotPolarity && slotPolarity !== "none");
    const matchesPolarity = hasModPolarity && hasSlotPolarity && slotPolarity === mod.polarity;

    if (mod.isAura || mod.isStance) {
        // Aura and stance mods add capacity. WFCD stores baseDrain as a negative value for
        // auras; stances use the same effective rank math but are identified separately.
        // At rank r the base grant is |baseDrain| + r, then matching polarity doubles it
        // while a different polarized slot grants 80% of the base amount.
        const grant = Math.abs(mod.baseDrain) + rank;
        if (matchesPolarity) {
            return -(grant * 2);
        }
        if (!hasSlotPolarity) return -grant;
        return -Math.floor(grant * 0.8);
    }

    if (rawDrain <= 0) return 0;

    if (matchesPolarity) {
        // Matching: halve drain, rounded up
        return Math.ceil(rawDrain / 2);
    } else if (!hasSlotPolarity) {
        // Unset/empty slot polarity — no polarity modifier (neutral)
        return rawDrain;
    } else {
        // Non-matching: add 25% of the base drain, rounded up.
        return rawDrain + Math.ceil(rawDrain / 4);
    }
}

// ── Capacity pool ─────────────────────────────────────────────────────────────

export interface CapacityConfig {
    /** Current weapon rank (0–30, or 0–40 for over-level weapons) */
    weaponRank: number;
    /** Whether an Orokin Catalyst is installed (doubles capacity) */
    hasCatalyst: boolean;
    /** Player's Mastery Rank (used for minimum capacity calculation) */
    masteryRank: number;
    /** Whether the weapon can go to rank 40 (Kuva/Tenet/Coda) */
    canOverLevel: boolean;
}

/**
 * Maximum possible rank for a weapon.
 */
export function maxWeaponRank(canOverLevel: boolean): number {
    return canOverLevel ? 40 : 30;
}

/** Count polarity changes by their physical slot, including newly polarized slots. */
export function countPolarityChanges(defaultPolarities: string[], currentPolarities: string[]): number {
    const slotCount = Math.max(defaultPolarities.length, currentPolarities.length);
    let changes = 0;
    for (let index = 0; index < slotCount; index++) {
        if ((defaultPolarities[index] ?? "") !== (currentPolarities[index] ?? "")) changes++;
    }
    return changes;
}

/**
 * Minimum mod capacity based on player's Mastery Rank.
 * MR 0–30: 15 + floor(MR/2)
 * MR 31+:  30 + (MR - 30)  (i.e. +1 per Legendary Rank)
 */
export function minModCapacity(masteryRank: number): number {
    if (masteryRank <= 30) {
        return 15 + Math.floor(masteryRank / 2);
    }
    return 30 + (masteryRank - 30);
}

/**
 * Total available mod capacity for a weapon, before subtracting mod drain.
 * = max(weaponRank, minModCapacity(MR))  [then optionally × 2 for catalyst]
 */
export function totalModCapacity(cfg: CapacityConfig): number {
    const base = Math.max(cfg.weaponRank, minModCapacity(cfg.masteryRank));
    return cfg.hasCatalyst ? base * 2 : base;
}

/** Allocation-light capacity check for optimizer hot paths. */
export function fitsWithinCapacity(
    cfg: CapacityConfig,
    slotPolarities: string[],
    mods: (ModEntry | null)[],
    modRanks?: (number | undefined)[],
    extraSlots: Array<{ mod: ModEntry; rank: number; polarity: string }> = [],
): boolean {
    let usedCapacity = 0;
    for (let index = 0; index < mods.length; index++) {
        const mod = mods[index] ?? null;
        if (!mod) continue;
        const rank = modRanks?.[index] ?? mod.fusionLimit;
        usedCapacity += effectiveDrain(mod, slotPolarities[index] ?? "", rank);
    }
    for (const slot of extraSlots) {
        usedCapacity += effectiveDrain(slot.mod, slot.polarity, slot.rank);
    }
    return usedCapacity <= totalModCapacity(cfg);
}

// ── Build-level capacity accounting ─────────────────────────────────────────

export interface SlotConfig {
    /** The current polarity of this slot (may differ from weapon default if forma'd) */
    polarity: string;
}

export interface CapacitySummary {
    /** Total available mod capacity (after catalyst, minimum cap) */
    totalCapacity: number;
    /** Capacity consumed by all installed mods (after polarity adjustments) */
    usedCapacity: number;
    /** Capacity added by aura mods (already included in usedCapacity as negative) */
    auraGrant: number;
    /** Remaining free capacity */
    remainingCapacity: number;
    /** True if mods exceed available capacity */
    overCapacity: boolean;
    /** Per-slot breakdown */
    slotBreakdown: Array<{
        slotPolarity: string;
        mod: ModEntry | null;
        modRank: number;
        rawDrain: number;
        effectiveDrain: number;
    }>;
}

/**
 * Compute the full capacity summary for a given weapon build.
 *
 * @param cfg        Weapon capacity configuration (rank, catalyst, MR)
 * @param slots      Array of slot configs (polarity per slot)
 * @param mods       Array of mods (null = empty slot), parallel to slots
 * @param modRanks   Optional per-mod rank overrides (defaults to max rank)
 */
export function computeCapacity(
    cfg: CapacityConfig,
    slots: SlotConfig[],
    mods: (ModEntry | null)[],
    modRanks?: (number | undefined)[],
): CapacitySummary {
    const total = totalModCapacity(cfg);

    let usedCapacity = 0;
    let auraGrant = 0;
    const slotBreakdown: CapacitySummary["slotBreakdown"] = [];

    for (let i = 0; i < slots.length; i++) {
        const slotPol = slots[i]?.polarity ?? "";
        const mod = mods[i] ?? null;
        const rank = modRanks?.[i] ?? (mod?.fusionLimit ?? 0);

        if (!mod) {
            slotBreakdown.push({ slotPolarity: slotPol, mod: null, modRank: 0, rawDrain: 0, effectiveDrain: 0 });
            continue;
        }

        const rawDrain = mod.baseDrain + rank;
        const eff = effectiveDrain(mod, slotPol, rank);

        if (mod.isAura || mod.isStance) {
            auraGrant += Math.abs(eff); // eff is negative for auras
        }

        usedCapacity += eff;
        slotBreakdown.push({ slotPolarity: slotPol, mod, modRank: rank, rawDrain, effectiveDrain: eff });
    }

    const remaining = total - usedCapacity;

    return {
        totalCapacity: total,
        usedCapacity,
        auraGrant,
        remainingCapacity: remaining,
        overCapacity: remaining < 0,
        slotBreakdown,
    };
}
