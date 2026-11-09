// ===== FILE: src/domain/logic/syndicatePrereqs.ts =====
//
// Derives automatic prereq completions from syndicate rank state.
// Call deriveCompletedMap() instead of reading state.prereqs.completed directly
// anywhere the planner, graph, or prereq engine is invoked.
//
// This keeps the engine layer pure (no syndicate awareness) while ensuring
// syndicate-gated prereqs are automatically marked complete when the player's
// Syndicates tracker already reflects the required rank.

import { PREREQ_REGISTRY } from "../../catalog/prereqs/prereqRegistry";
import { PR } from "../ids/prereqIds";
import { SY } from "../ids/syndicateIds";
import type { SyndicateState } from "../types";
import { isNightmareUnlockedFromNodeCompletion, isSteelPathUnlockedFromNodeCompletion } from "./starChartProgression";

/**
 * Returns a merged completedMap that includes auto-derived completions
 * for any prereq whose `validatedBySyndicate` or `validatedByAnySyndicate`
 * condition is satisfied by
 * the player's current syndicate ranks.
 *
 * Manual completions in the base map are always preserved.
 */
export function deriveCompletedMap(
    baseCompletedMap: Record<string, boolean>,
    syndicates: SyndicateState[],
    masteryRank?: number | null,
    nodeCompletedMap: Record<string, boolean> = {},
    railjackIntrinsics: Record<string, number> = {},
): Record<string, boolean> {
    // Build a fast rank lookup: syndicateId -> current rank
    const rankBySyndicateId: Record<string, number> = {};
    for (const syn of syndicates) {
        if (syn?.id) {
            rankBySyndicateId[syn.id] = typeof syn.rank === "number" ? syn.rank : -1;
        }
    }

    const merged: Record<string, boolean> = { ...baseCompletedMap };
    const normalizedMasteryRank = typeof masteryRank === "number" && Number.isFinite(masteryRank)
        ? Math.max(0, Math.floor(masteryRank))
        : -1;

    // Helminth segments can be bought from Son or as a built segment in the
    // Market bundle. Model Son's rank + mastery purchase eligibility as an
    // auto-derived alternative; it is not a separate user-completed milestone.
    const entratiRank = rankBySyndicateId[SY.ENTRATI] ?? -1;
    if (normalizedMasteryRank >= 8 && entratiRank >= 3) {
        merged[PR.SEGMENT_HELMINTH_SON_ACCESS] = true;
    }
    if (normalizedMasteryRank >= 8 && entratiRank >= 5) {
        merged[PR.SEGMENT_HELMINTH_INVIGORATION_SON_ACCESS] = true;
    }

    for (const def of PREREQ_REGISTRY) {
        if (def.validatedBySyndicate) {
            const { syndicateId, rank: requiredRank } = def.validatedBySyndicate;
            const currentRank = rankBySyndicateId[syndicateId] ?? -1;

            if (currentRank >= requiredRank) {
                merged[def.id] = true;
            }
        }

        if (def.validatedByAnySyndicate) {
            const { syndicateIds, rank: requiredRank } = def.validatedByAnySyndicate;
            if (syndicateIds.some((syndicateId) => (rankBySyndicateId[syndicateId] ?? -1) >= requiredRank)) {
                merged[def.id] = true;
            }
        }

        if (typeof def.validatedByMasteryRank === "number" && normalizedMasteryRank >= def.validatedByMasteryRank) {
            merged[def.id] = true;
        }
        // Note: we never set merged[def.id] = false here — if the player manually
        // marked it complete but their rank dropped, we trust the manual mark.
        // The Syndicates page is the canonical source for rank going forward.
    }

    // Junction checkmarks are imported and edited in the Star Chart tracker.
    // Keep the prerequisite graph in sync with that canonical completion source
    // instead of making users maintain a second checkbox for every Junction.
    for (const def of PREREQ_REGISTRY) {
        if (def.id.startsWith("junction_") && nodeCompletedMap[`node:${def.id}`] === true) {
            merged[def.id] = true;
        }
    }

    if (normalizedMasteryRank >= 5 && isSteelPathUnlockedFromNodeCompletion(nodeCompletedMap)) {
        merged[PR.ACTIVITY_STEEL_PATH] = true;
    }

    if (isNightmareUnlockedFromNodeCompletion(nodeCompletedMap)) {
        merged[PR.ACTIVITY_NIGHTMARE] = true;
    }

    // Completing Pluto → Eris necessarily completes its Focus Lens task,
    // which unlocks Arbitrations even when that task was not tracked separately.
    if (nodeCompletedMap["node:junction_pluto_sedna"] === true) {
        merged[PR.SYSTEM_ERIS_FOCUS_LENS] = true;
    }

    // The old Star Chart model represented Kuva Fortress as an Eris Junction.
    // Preserve existing checkmarks while using the current direct War Within unlock.
    if (merged[PR.WAR_WITHIN] === true || nodeCompletedMap["node:junction_eris_kuva_fortress"] === true) {
        merged[PR.KUVA_FORTRESS_ACCESS] = true;
    }

    // Lua is opened by The Second Dream. Preserve completion imported under the
    // former (incorrect) Earth → Lua Junction node identifier.
    if (merged[PR.SECOND_DREAM] === true || nodeCompletedMap["node:junction_earth_lua"] === true) {
        merged[PR.JUNCTION_EARTH_LUA] = true;
    }

    // Deimos is reached through the War node on Mars, not a Junction. Preserve
    // the old profile import key that stored a Mars-to-Deimos pseudo-Junction.
    if (nodeCompletedMap["node:mr/mars/war"] === true || nodeCompletedMap["node:junction_mars_deimos"] === true) {
        merged[PR.DEIMOS_ACCESS] = true;
    }

    // Railjack Intrinsics are already imported and manually editable. Derive
    // the Proxima region milestones from those ranks so the Star Chart and
    // source availability do not require a duplicate checkbox.
    if (merged[PR.ARCHWING] === true) {
        merged[PR.SYSTEM_PROXIMA_ACCESS] = true;
        const highestIntrinsicRank = Object.values(railjackIntrinsics)
            .reduce((highest, value) => Math.max(highest, Number.isFinite(value) ? Math.floor(value) : 0), 0);
        if (highestIntrinsicRank >= 3) {
            merged[PR.SYSTEM_PROXIMA_SATURN_ACCESS] = true;
            merged[PR.SYSTEM_PROXIMA_NEPTUNE_ACCESS] = true;
        }
        if (highestIntrinsicRank >= 5) merged[PR.SYSTEM_PROXIMA_PLUTO_ACCESS] = true;
        if (highestIntrinsicRank >= 7) merged[PR.SYSTEM_PROXIMA_VEIL_ACCESS] = true;
    }
    if (merged[PR.CLAN_DRY_DOCK] === true || merged[PR.SYSTEM_PROXIMA_ACCESS] === true) {
        merged[PR.SYSTEM_RAILJACK_ARMAMENTS_ACCESS] = true;
    }

    // The Mote Amp is one valid Operator Amp and therefore satisfies the generic
    // equipment gate used by The New War. Other owned Amp models can be marked there.
    if (merged[PR.AMP_MOTE] === true) {
        merged[PR.SYSTEM_OPERATOR_AMP] = true;
    }

    // Dark Refractory becomes available in Navigation after The Old Peace or
    // after the player opts into Mission Preview; The Teacher alone only makes
    // the preview button available and is not itself an access grant.
    if (merged[PR.THE_OLD_PEACE] === true || merged[PR.SYSTEM_DARK_REFRACTORY_PREVIEW] === true) {
        merged[PR.ACTIVITY_DARK_REFRACTORY] = true;
    }

    return merged;
}

/**
 * Returns true if this prereq's completion is driven by syndicate rank,
 * not by a manual checkbox.
 */
export function isValidatedBySyndicate(prereqId: string): boolean {
    return PREREQ_REGISTRY.some(
        (d) => d.id === prereqId && (!!d.validatedBySyndicate || !!d.validatedByAnySyndicate)
    );
}

const COMPLETION_DERIVED_FROM_PROGRESS = new Set<string>([
    PR.DEIMOS_ACCESS,
    PR.SEGMENT_HELMINTH_SON_ACCESS,
    PR.SEGMENT_HELMINTH_INVIGORATION_SON_ACCESS,
    PR.SYSTEM_PROXIMA_ACCESS,
    PR.SYSTEM_RAILJACK_ARMAMENTS_ACCESS,
    PR.JUNCTION_EARTH_LUA,
    PR.KUVA_FORTRESS_ACCESS,
    PR.SYSTEM_ERIS_FOCUS_LENS,
]);

export function isAutoTrackedPrereq(prereqId: string): boolean {
    const def = PREREQ_REGISTRY.find((entry) => entry.id === prereqId);
    if (!def) return false;
    return !!def.validatedBySyndicate
        || !!def.validatedByAnySyndicate
        || typeof def.validatedByMasteryRank === "number"
        || def.conditions?.some((condition) => condition.type === "star_chart_access") === true
        || def.conditions?.some((condition) => condition.type === "railjack_intrinsic_rank") === true
        || def.label.startsWith("Junction:")
        || COMPLETION_DERIVED_FROM_PROGRESS.has(def.id);
}
