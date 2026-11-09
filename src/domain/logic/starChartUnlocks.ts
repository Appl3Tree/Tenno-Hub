import { PR } from "../ids/prereqIds";
import { STAR_CHART_DATA } from "../catalog/starChart";
import { isPrereqUnlocked } from "./unlockGraph";

/**
 * Returns the Star Chart destinations available from normal progression.
 * Junction nodes remain the completion source for ordinary planet routes;
 * direct-access regions and temporary event routes are handled explicitly.
 */
export function getUnlockedStarChartDestinationIds(
    completedPrereqs: Record<string, boolean>,
    normalNodeCompletedMap: Record<string, boolean>,
    currentDate?: string,
): Set<string> {
    const unlocked = new Set<string>(["planet:earth"]);

    for (const node of STAR_CHART_DATA.nodes) {
        if (node.nodeType !== "junction" || !node.unlocksPlanetId) continue;
        const prereqId = node.id.replace(/^node:/, "");
        if (normalNodeCompletedMap[node.id] === true || completedPrereqs[prereqId] === true) {
            unlocked.add(node.unlocksPlanetId);
        }
    }

    // Deimos is reached through War on Mars, not a Star Chart Junction.
    if (normalNodeCompletedMap["node:mr/mars/war"] === true
        || completedPrereqs[PR.DEIMOS_ACCESS] === true
        || normalNodeCompletedMap["node:junction_mars_deimos"] === true) {
        unlocked.add("planet:deimos");
    }

    // These regions are direct quest unlocks; their old pseudo-Junctions are
    // still recognized so existing saved chart progress remains usable.
    if (completedPrereqs[PR.WAR_WITHIN] === true
        || completedPrereqs[PR.KUVA_FORTRESS_ACCESS] === true
        || normalNodeCompletedMap["node:junction_eris_kuva_fortress"] === true) {
        unlocked.add("region:kuva_fortress");
    }
    if (completedPrereqs[PR.SECOND_DREAM] === true
        || completedPrereqs[PR.JUNCTION_EARTH_LUA] === true
        || normalNodeCompletedMap["node:junction_earth_lua"] === true) {
        unlocked.add("region:lua");
    }

    // Operation: Taubound temporarily exposes its Eris route without the
    // permanent chart path. The event gate includes its current time window.
    if (isPrereqUnlocked(completedPrereqs, PR.ACTIVITY_TAUBOUND, undefined, { currentDate })) {
        unlocked.add("planet:eris");
    }

    return unlocked;
}
