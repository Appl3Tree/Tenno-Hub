// ===== FILE: src/app/routes.ts =====
import type { PageKey } from "../domain/models/userState";

export type WorkModeKey = "command" | "progression" | "collection" | "planning" | "system";

export type NavRoute = {
    key: PageKey;
    label: string;
    desc: string;
    mode: WorkModeKey;
    shortLabel?: string;
};

export const NAV_ROUTES: NavRoute[] = [
    { key: "dashboard", label: "Dashboard", shortLabel: "Dash", desc: "Today’s checklist and quick status.", mode: "command" },
    { key: "world_state", label: "World State", shortLabel: "World", desc: "Live cycles, missions, fissures, and events.", mode: "command" },

    { key: "goals", label: "Goals", desc: "Personal goal portfolio.", mode: "progression" },
    { key: "prereqs", label: "Prerequisites", shortLabel: "Prereqs", desc: "Quest and system unlock tracking.", mode: "progression" },
    { key: "syndicates", label: "Syndicates", shortLabel: "Syndis", desc: "Syndicate standing and ranks.", mode: "progression" },
    { key: "intrinsics", label: "Intrinsics", desc: "Railjack and Duviri intrinsic progression.", mode: "progression" },
    { key: "challenges", label: "Challenges", desc: "Track your achievement challenges and progress.", mode: "progression" },
    { key: "handbook", label: "Tenno's Handbook", shortLabel: "Handbook", desc: "Quest order, game mechanics, and farming guides for new players.", mode: "progression" },

    { key: "inventory", label: "Inventory", desc: "Full catalog by category with filters.", mode: "collection" },
    { key: "mods", label: "Mods", shortLabel: "Mods", desc: "Browse mods, rivens, and drop locations.", mode: "collection" },
    { key: "arcanes", label: "Arcanes", shortLabel: "Arcanes", desc: "Track arcane ownership, ranks, and acquisition.", mode: "collection" },
    { key: "starchart", label: "Star Chart", shortLabel: "Chart", desc: "Click planet → node to see rewards and item sources.", mode: "collection" },

    { key: "requirements", label: "Farming", desc: "Targeted vs Overlap across goals + syndicates.", mode: "planning" },
    { key: "relic_planner", label: "Relic Planner", shortLabel: "Relics", desc: "Find which relics contain your target items and plan fissure runs.", mode: "planning" },
    { key: "build_planner", label: "Build Planner", shortLabel: "Builds", desc: "Build and optimize weapon loadouts using the damage model.", mode: "planning" },

    { key: "imports", label: "Import / Export", shortLabel: "Import", desc: "Progress Pack tools.", mode: "system" },
    { key: "settings", label: "Settings", desc: "App preferences.", mode: "system" },
    { key: "diagnostics", label: "Diagnostics", shortLabel: "Diag", desc: "Validation and debug output.", mode: "system" },
];

export const SEARCH_DETAIL_ROUTE: NavRoute = {
    key: "search_detail",
    label: "Search Detail",
    shortLabel: "Detail",
    desc: "Focused dossier view for an item, mod, or arcane.",
    mode: "collection",
};

export const WORK_MODE_META: Record<WorkModeKey, { label: string; shortLabel: string; desc: string }> = {
    command: {
        label: "Today",
        shortLabel: "Today",
        desc: "Check live activities and pick up where you left off.",
    },
    progression: {
        label: "Progression",
        shortLabel: "Progress",
        desc: "Track goals, unlocks, syndicates, and challenges.",
    },
    collection: {
        label: "Inventory & Catalog",
        shortLabel: "Items",
        desc: "Update owned items or browse mods, arcanes, and sources.",
    },
    planning: {
        label: "Farm & Plan",
        shortLabel: "Farm",
        desc: "Find farming routes, plan relic runs, and build loadouts.",
    },
    system: {
        label: "App & Data",
        shortLabel: "App",
        desc: "Manage preferences, profile data, and technical diagnostics.",
    },
};

export const WORK_MODE_ORDER: WorkModeKey[] = ["command", "progression", "collection", "planning", "system"];

const WORK_MODE_DEFAULT_ROUTES: Record<WorkModeKey, PageKey> = {
    command: "dashboard",
    progression: "goals",
    collection: "inventory",
    planning: "requirements",
    system: "settings",
};

export function getRouteByKey(key: PageKey): NavRoute {
    if (key === "search_detail") {
        return SEARCH_DETAIL_ROUTE;
    }
    if (key === "relics") {
        return NAV_ROUTES.find((route) => route.key === "relic_planner") ?? NAV_ROUTES[0];
    }
    return NAV_ROUTES.find((route) => route.key === key) ?? NAV_ROUTES[0];
}

/** The workspace navigation button lands on that group's most useful entry page. */
export function getDefaultRouteForMode(mode: WorkModeKey): NavRoute {
    return NAV_ROUTES.find((route) => route.key === WORK_MODE_DEFAULT_ROUTES[mode]) ?? NAV_ROUTES[0];
}

