// ===== FILE: src/domain/catalog/starChart/planets.ts =====

import type { StarChartPlanet } from "../../models/starChart";
import missionRewardsJson from "../../../../external/warframe-drop-data/raw/missionRewards.json";

function normalizeName(s: string): string {
    return (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function foldDiacritics(s: string): string {
    return (s ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeNameNoPunct(s: string): string {
    const folded = foldDiacritics(s);
    return normalizeName(folded).replace(/[^a-z0-9 ]+/g, "").replace(/\s+/g, " ").trim();
}

function toToken(s: string): string {
    return normalizeNameNoPunct(s).replace(/\s+/g, "-");
}

/**
 * Authoritative planet/region/hub registry.
 *
 * Phase 1.5 rule: must be 100% complete before enabling startup validation.
 *
 * Conventions:
 * - id is stable, internal, and never derived from display name.
 * - sortOrder is grouped with large gaps so we can insert later without churn.
 */
const CURATED_STAR_CHART_PLANETS: StarChartPlanet[] = [
    // =============================
    // Core Star Chart "planets"
    // =============================
    { id: "planet:mercury", name: "Mercury", kind: "planet", sortOrder: 10 },
    { id: "planet:venus", name: "Venus", kind: "planet", sortOrder: 20 },
    { id: "planet:earth", name: "Earth", kind: "planet", sortOrder: 30 },
    { id: "planet:mars", name: "Mars", kind: "planet", sortOrder: 40 },
    { id: "planet:deimos", name: "Deimos", kind: "planet", sortOrder: 50 },

    { id: "planet:phobos", name: "Phobos", kind: "planet", sortOrder: 60 },
    { id: "planet:ceres", name: "Ceres", kind: "planet", sortOrder: 70 },

    { id: "planet:jupiter", name: "Jupiter", kind: "planet", sortOrder: 80 },
    { id: "planet:europa", name: "Europa", kind: "planet", sortOrder: 90 },

    { id: "planet:saturn", name: "Saturn", kind: "planet", sortOrder: 100 },
    { id: "planet:uranus", name: "Uranus", kind: "planet", sortOrder: 110 },
    { id: "planet:neptune", name: "Neptune", kind: "planet", sortOrder: 120 },

    { id: "planet:pluto", name: "Pluto", kind: "planet", sortOrder: 130 },
    { id: "planet:sedna", name: "Sedna", kind: "planet", sortOrder: 140 },
    { id: "planet:eris", name: "Eris", kind: "planet", sortOrder: 150 },

    // =============================
    // Star Chart regions (non-planet)
    // =============================
    { id: "region:lua", name: "Lua", kind: "region", sortOrder: 200 },
    { id: "region:kuva_fortress", name: "Kuva Fortress", kind: "region", sortOrder: 210 },
    { id: "region:void", name: "Void", kind: "region", sortOrder: 220 },
    { id: "region:zariman", name: "Zariman", kind: "region", sortOrder: 230 },
    { id: "region:duviri", name: "Duviri", kind: "region", sortOrder: 240 },
    { id: "region:sanctuary", name: "Sanctuary", kind: "region", sortOrder: 250 },

    // =============================
    // Höllvania & Dark Refractory
    // =============================
    { id: "region:hollvania", name: "Höllvania", kind: "region", sortOrder: 250 },
    { id: "region:dark_refractory_deimos", name: "Dark Refractory, Deimos", kind: "region", sortOrder: 260 },

    // =============================
    // Railjack regions (Proxima)
    // =============================
    { id: "region:earth_proxima", name: "Earth Proxima", kind: "region", sortOrder: 310 },
    { id: "region:venus_proxima", name: "Venus Proxima", kind: "region", sortOrder: 320 },
    { id: "region:saturn_proxima", name: "Saturn Proxima", kind: "region", sortOrder: 330 },
    { id: "region:neptune_proxima", name: "Neptune Proxima", kind: "region", sortOrder: 340 },
    { id: "region:pluto_proxima", name: "Pluto Proxima", kind: "region", sortOrder: 350 },
    { id: "region:veil_proxima", name: "Veil Proxima", kind: "region", sortOrder: 360 },
    { id: "region:uranus_proxima", name: "Uranus Proxima", kind: "region", sortOrder: 370 },

    // =============================
    // Hubs (accessed via Star Chart / navigation)
    // =============================
    { id: "hub:cetus", name: "Cetus", kind: "hub", sortOrder: 410 },
    { id: "hub:fortuna", name: "Fortuna", kind: "hub", sortOrder: 420 },
    { id: "hub:necralisk", name: "Necralisk", kind: "hub", sortOrder: 430 },
    { id: "hub:chrysalith", name: "Chrysalith", kind: "hub", sortOrder: 440 },
    { id: "hub:sanctum_anatomica", name: "Sanctum Anatomica", kind: "hub", sortOrder: 450 },

    // =============================
    // Relays (classic Star Chart relay locations)
    // =============================
    { id: "hub:relay_larunda", name: "Larunda Relay", kind: "hub", sortOrder: 510 },
    { id: "hub:relay_strata", name: "Strata Relay", kind: "hub", sortOrder: 520 },
    { id: "hub:relay_kronia", name: "Kronia Relay", kind: "hub", sortOrder: 530 },
    { id: "hub:relay_kuiper", name: "Kuiper Relay", kind: "hub", sortOrder: 540 },
    { id: "hub:relay_leonov", name: "Leonov Relay", kind: "hub", sortOrder: 550 },
    { id: "hub:relay_vesper", name: "Vesper Relay", kind: "hub", sortOrder: 560 },
    { id: "hub:relay_orcus", name: "Orcus Relay", kind: "hub", sortOrder: 570 }
];

function deriveAutoPlanetsFromMissionRewards(): StarChartPlanet[] {
    const root: any = (missionRewardsJson as any)?.missionRewards ?? (missionRewardsJson as any);
    if (!root || typeof root !== "object" || Array.isArray(root)) return [];

    const existingIds = new Set<string>(CURATED_STAR_CHART_PLANETS.map((p) => p.id));
    const existingNameToks = new Set<string>(CURATED_STAR_CHART_PLANETS.map((p) => toToken(p.name)));

    // If a missionRewards "group" is actually represented in our curated list under a different
    // in-game naming (ex: "Veil" is "Veil Proxima" in the Star Chart), do NOT auto-create a fake planet.
    const SKIP_GROUP_TOKENS = new Set<string>([
        "veil",
        "sanctuary" // keep this if you do NOT want an "auto:sanctuary" button
    ]);

    const out: StarChartPlanet[] = [];
    const groupNames = Object.keys(root);

    // Keep auto groups at the end, but stable.
    // sortOrder 9000+ leaves space for future curated inserts.
    let sortOrder = 9000;

    for (const g of groupNames) {
        const name = String(g ?? "").trim();
        if (!name) continue;

        const tok = toToken(name);
        if (!tok) continue;

        if (SKIP_GROUP_TOKENS.has(tok)) continue;

        // If a curated planet already matches by name token, skip.
        if (existingNameToks.has(tok)) continue;

        const id = `auto:${tok}`;
        if (existingIds.has(id)) continue;

        out.push({
            id,
            name,
            kind: "region",
            sortOrder
        });

        existingIds.add(id);
        sortOrder += 1;
    }

    return out;
}

export const STAR_CHART_PLANETS: StarChartPlanet[] = [
    ...CURATED_STAR_CHART_PLANETS,
    ...deriveAutoPlanetsFromMissionRewards()
];

