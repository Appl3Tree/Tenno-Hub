// src/catalog/sources/sourceCatalog.ts

import { normalizeSourceId, type SourceId } from "../../domain/ids/sourceIds";
import { PR } from "../../domain/ids/prereqIds";
import wfcdSourceLabels from "../../data/_generated/wfcd-source-label-map.auto.json";
import itemAcquisitionJson from "../../data/_generated/item-acquisition.byCatalogId.auto.json";
import { canonicalizeWfItemsLocation } from "./wfItemsLocCanonical";
import { CURATED_SOURCES } from "./curatedSources";

// warframe-drop-data/raw inputs
import missionRewardsJson from "../../../external/warframe-drop-data/raw/missionRewards.json";
import relicsJson from "../../data/_generated/relics-lean.auto.json";
import blueprintLocationsJson from "../../../external/warframe-drop-data/raw/blueprintLocations.json";
import enemyBlueprintTablesJson from "../../../external/warframe-drop-data/raw/enemyBlueprintTables.json";
import modLocationsJson from "../../../external/warframe-drop-data/raw/modLocations.json";
import enemyModTablesJson from "../../../external/warframe-drop-data/raw/enemyModTables.json";
import transientRewardsJson from "../../../external/warframe-drop-data/raw/transientRewards.json";
import sortieRewardsJson from "../../../external/warframe-drop-data/raw/sortieRewards.json";
import cetusBountyRewardsJson from "../../../external/warframe-drop-data/raw/cetusBountyRewards.json";
import solarisBountyRewardsJson from "../../../external/warframe-drop-data/raw/solarisBountyRewards.json";
import deimosRewardsJson from "../../../external/warframe-drop-data/raw/deimosRewards.json";
import entratiLabRewardsJson from "../../../external/warframe-drop-data/raw/entratiLabRewards.json";
import hexRewardsJson from "../../../external/warframe-drop-data/raw/hexRewards.json";
import zarimanRewardsJson from "../../../external/warframe-drop-data/raw/zarimanRewards.json";
import syndicatesJson from "../../../external/warframe-drop-data/raw/syndicates.json";
import miscItemsJson from "../../../external/warframe-drop-data/raw/miscItems.json";
import keyRewardsJson from "../../../external/warframe-drop-data/raw/keyRewards.json";
import resourceByAvatarJson from "../../../external/warframe-drop-data/raw/resourceByAvatar.json";
import additionalItemByAvatarJson from "../../../external/warframe-drop-data/raw/additionalItemByAvatar.json";

// warframe-items/raw (for wfitems:loc sources)
import WARFRAME_ITEMS_ALL from "../../data/_generated/warframe-items-all-lean.auto.json";

export type Source = {
    id: SourceId;
    label: string;
    type: "drop" | "crafting" | "vendor" | "other";
    prereqIds?: string[];
};

export type RawSource = {
    id: string;
    label: string;
    type?: Source["type"];
    prereqIds?: string[];
};

const CURATED_SOURCE_BY_ID = new Map(
    CURATED_SOURCES.map((source) => [normalizeSourceId(source.id), source] as const)
);

const SYNDICATE_VENDOR_ALIASES: Array<{ prefix: string; canonicalName: string }> = [
    { prefix: "Cephalon Simaris", canonicalName: "Cephalon Simaris" },
    { prefix: "Kahl's Garrison", canonicalName: "Kahl's Garrison" },
    { prefix: "The Perrin Sequence", canonicalName: "The Perrin Sequence" },
    { prefix: "Perrin Sequence", canonicalName: "The Perrin Sequence" },
    { prefix: "Steel Meridian", canonicalName: "Steel Meridian" },
    { prefix: "Arbiters of Hexis", canonicalName: "Arbiters of Hexis" },
    { prefix: "Arbiter Of Hexis", canonicalName: "Arbiters of Hexis" },
    { prefix: "Arbiters", canonicalName: "Arbiters of Hexis" },
    { prefix: "Cephalon Suda", canonicalName: "Cephalon Suda" },
    { prefix: "New Loka", canonicalName: "New Loka" },
    { prefix: "Red Veil", canonicalName: "Red Veil" },
    { prefix: "Solaris United", canonicalName: "Solaris United" },
    { prefix: "The Holdfasts", canonicalName: "The Holdfasts" },
    { prefix: "The Quills", canonicalName: "The Quills" },
    { prefix: "Vox Solaris", canonicalName: "Vox Solaris" },
    { prefix: "NecraLoid", canonicalName: "NecraLoid" },
    { prefix: "Conclave", canonicalName: "Conclave" },
    { prefix: "Ventkids", canonicalName: "Ventkids" },
    { prefix: "Ostron", canonicalName: "Ostron" },
    { prefix: "Entrati", canonicalName: "Entrati" },
    { prefix: "Operational Supply", canonicalName: "Operational Supply" },
] as const;

const STAR_CHART_REGION_PREREQS: Array<{ prefix: string; prereqIds: string[] }> = [
    { prefix: "Mercury", prereqIds: [PR.JUNCTION_MERCURY_VENUS] },
    { prefix: "Venus", prereqIds: [PR.JUNCTION_VENUS_EARTH] },
    { prefix: "Earth", prereqIds: [PR.VORS_PRIZE] },
    { prefix: "Mars", prereqIds: [PR.JUNCTION_EARTH_MARS] },
    { prefix: "Phobos", prereqIds: [PR.JUNCTION_MARS_PHOBOS] },
    { prefix: "Ceres", prereqIds: [PR.JUNCTION_MARS_CERES] },
    { prefix: "Deimos", prereqIds: [PR.DEIMOS_ACCESS] },
    { prefix: "Jupiter", prereqIds: [PR.JUNCTION_CERES_JUPITER] },
    { prefix: "Europa", prereqIds: [PR.JUNCTION_JUPITER_EUROPA] },
    { prefix: "Saturn", prereqIds: [PR.JUNCTION_EUROPA_SATURN] },
    { prefix: "Uranus", prereqIds: [PR.JUNCTION_SATURN_URANUS] },
    { prefix: "Neptune", prereqIds: [PR.JUNCTION_URANUS_NEPTUNE] },
    { prefix: "Pluto", prereqIds: [PR.JUNCTION_NEPTUNE_PLUTO] },
    { prefix: "Sedna", prereqIds: [PR.JUNCTION_SEDNA_ERIS] },
    { prefix: "Eris", prereqIds: [PR.JUNCTION_PLUTO_SEDNA] },
    { prefix: "Lua", prereqIds: [PR.JUNCTION_EARTH_LUA] },
    { prefix: "Kuva Fortress", prereqIds: [PR.KUVA_FORTRESS_ACCESS] },
    { prefix: "Sanctuary", prereqIds: [PR.HUB_RELAY, PR.NEW_STRANGE] },
    { prefix: "Earth Proxima", prereqIds: [PR.SYSTEM_PROXIMA_ACCESS] },
    { prefix: "Venus Proxima", prereqIds: [PR.SYSTEM_PROXIMA_ACCESS] },
    { prefix: "Saturn Proxima", prereqIds: [PR.SYSTEM_PROXIMA_SATURN_ACCESS] },
    { prefix: "Neptune Proxima", prereqIds: [PR.SYSTEM_PROXIMA_NEPTUNE_ACCESS] },
    { prefix: "Pluto Proxima", prereqIds: [PR.SYSTEM_PROXIMA_PLUTO_ACCESS] },
    { prefix: "Veil Proxima", prereqIds: [PR.SYSTEM_PROXIMA_VEIL_ACCESS] },
    { prefix: "Uranus Proxima", prereqIds: [PR.SYSTEM_URANUS_PROXIMA] },
    { prefix: "Zariman", prereqIds: [PR.HUB_ZARIMAN] },
    { prefix: "Sanctum Anatomica", prereqIds: [PR.HUB_SANCTUM] },
    { prefix: "Höllvania", prereqIds: [PR.HUB_HOLLVANIA] },
    { prefix: "Duviri", prereqIds: [PR.DUVIRI_PARADOX] },
    { prefix: "Dark Refractory, Deimos", prereqIds: [PR.THE_OLD_PEACE] },
] as const;

function getSyndicateVendorOverride(syndicateName: string): Pick<RawSource, "label" | "prereqIds"> | null {
    const curatedEquivalentIdByName: Record<string, string> = {
        "Cephalon Simaris": "data:vendor/simaris",
        Entrati: "data:vendor/deimos/entrati",
        "Kahl's Garrison": "data:vendor/kahl-garrison/chipper",
        Ostron: "data:vendor/cetus/ostron",
        "Solaris United": "data:vendor/fortuna/solaris-united",
        "The Holdfasts": "data:vendor/zariman/holdfasts",
        "The Quills": "data:vendor/cetus/quills",
        Ventkids: "data:vendor/fortuna/ventkids",
        "Vox Solaris": "data:vendor/fortuna/vox-solaris",
        NecraLoid: "data:vendor/deimos/necraloid",
        "Operational Supply": "data:events/plague-star",
    };

    const curatedId = curatedEquivalentIdByName[syndicateName];
    if (curatedId) {
        const curated = CURATED_SOURCE_BY_ID.get(normalizeSourceId(curatedId));
        if (curated) {
            return {
                label: curated.label,
                prereqIds: curated.prereqIds,
            };
        }
    }

    const relaySyndicates = new Set([
        "Arbiters of Hexis",
        "Cephalon Suda",
        "Conclave",
        "New Loka",
        "Red Veil",
        "Steel Meridian",
        "The Perrin Sequence",
    ]);

    if (relaySyndicates.has(syndicateName)) {
        return {
            label: `Syndicate Vendor: ${syndicateName}`,
            prereqIds: ["hub_relay"],
        };
    }

    return null;
}

function inferExtraPrereqsFromSourceLabel(label: string, vendorName?: string): string[] {
    const raw = safeString(label);
    if (!raw) return [];

    const out = new Set<string>();
    const normalizedVendor = safeString(vendorName)?.toLowerCase();

    if (normalizedVendor === "cephalon simaris") {
        const labelToPrereqId: Array<[RegExp, string]> = [
            [/Complete The Archwing/i, PR.ARCHWING],
            [/Complete The Sacrifice/i, PR.SACRIFICE],
            [/Complete Sands of Inaros/i, PR.SANDS_INAROS],
            [/Complete The Silver Grove/i, PR.SILVER_GROVE],
            [/Complete The Waverider/i, PR.WAVERIDER],
            [/Complete The Limbo Theorem/i, PR.LIMBO_THEOREM],
            [/Complete Hidden Messages/i, PR.HIDDEN_MESSAGES],
            [/Complete The New War/i, PR.NEW_WAR],
            [/Complete The War Within/i, PR.WAR_WITHIN],
            [/Complete The Second Dream/i, PR.SECOND_DREAM],
            [/Complete Chains of Harrow/i, PR.CHAINS_HARROW],
            [/Complete Octavia's Anthem/i, PR.OCTAVIA_ANTHEM],
            [/Complete The Glast Gambit/i, PR.GLAST_GAMBIT],
            [/Complete The Jordas Precept/i, PR.JORDAS_PRECEPT],
            [/Complete Mask of the Revenant/i, PR.MASK_REVENANT],
            [/Complete The Deadlock Protocol/i, PR.DEADLOCK_PROTOCOL],
            [/Complete Call of the Tempestarii/i, PR.CALL_TEMPESTARII],
            [/Complete Heart of Deimos/i, PR.HEART_OF_DEIMOS],
            [/Complete The Duviri Paradox/i, PR.DUVIRI_PARADOX],
            [/Complete The New Strange/i, PR.NEW_STRANGE],
            [/Complete Saya's Vigil/i, PR.SAYA_VIGIL],
            [/Complete Chimera Prologue/i, PR.CHIMERA_PROLOGUE],
            [/Complete Erra/i, PR.ERRA],
            [/Complete Natah/i, PR.NATAH],
            [/Complete Vox Solaris/i, PR.VOX_SOLARIS],
            [/Unlock through The Deadlock Protocol/i, PR.DEADLOCK_PROTOCOL],
            [/Unlock through Stolen Dreams/i, PR.STOLEN_DREAMS],
            [/Unlock through Tenshin's Cave/i, PR.DUVIRI_PARADOX],
            [/Complete Neptune Junction/i, PR.JUNCTION_URANUS_NEPTUNE],
            [/Complete Pluto Junction/i, PR.JUNCTION_NEPTUNE_PLUTO],
            [/Complete Uranus Junction/i, PR.JUNCTION_SATURN_URANUS],
        ];

        for (const [pattern, prereqId] of labelToPrereqId) {
            if (pattern.test(raw)) out.add(prereqId);
        }
    }

    return [...out];
}

function inferSourceMetadataFromLabel(label: string): Pick<RawSource, "label" | "prereqIds" | "type"> | null {
    const raw = safeString(label);
    if (!raw) return null;
    const quantityNormalized = raw.replace(
        /^WFItems Location(?: \(Legacy\))?:\s*\d+[xX]\s+/i,
        "WFItems Location: "
    );
    const prefixStripped = quantityNormalized
        .replace(/^Transient Reward:\s*/i, "")
        .replace(/^Key Rewards:\s*/i, "")
        .replace(/^Sortie Rewards$/i, "Sorties");

    if (/^Sortie Rewards$/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.ACTIVITY_SORTIES],
            type: "drop",
        };
    }

    if (/^Transient Reward:\s*Duviri Circuit$/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.DUVIRI_PARADOX],
            type: "drop",
        };
    }

    if (/^Transient Reward:\s*Duviri Full Experience$/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.DUVIRI_PARADOX],
            type: "drop",
        };
    }

    if (/^Key Rewards:\s*(Another Betrayer|Family Reunion|Hot Mess|Recover the Orokin Archive|Sunkiller|Table for Two|The Aftermath|Time'?s Up|Faceoff)/i.test(quantityNormalized)) {
        const prereqIds: string[] = [PR.THE_HEX];
        if (/Steel Path/i.test(quantityNormalized)) prereqIds.push(PR.ACTIVITY_STEEL_PATH);
        return {
            label: raw,
            prereqIds,
            type: "drop",
        };
    }

    if (/^(?:Key Rewards|WFItems Location(?: \(Legacy\))?):\s*Enter Nihil'?s Oubliette(?:,\s*Rotation [A-Z])?$/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.ACTIVITY_NIGHTWAVE],
            type: "drop",
        };
    }

    if (/^(?:Transient Reward|WFItems Location(?: \(Legacy\))?):\s*Arbitrations$/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.ACTIVITY_ARBITRATIONS],
            type: "drop",
        };
    }

    if (/^(?:Transient Reward|WFItems Location(?: \(Legacy\))?):\s*Derelict Vault$/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.CLAN_DOJO, PR.DEIMOS_ACCESS],
            type: "drop",
        };
    }

    if (/^(?:Transient Reward|WFItems Location(?: \(Legacy\))?):\s*Duviri Static Undercroft Portal/i.test(quantityNormalized)) {
        const prereqIds: string[] = [PR.DUVIRI_PARADOX];
        if (/Steel Path/i.test(quantityNormalized)) prereqIds.push(PR.ACTIVITY_STEEL_PATH);
        return {
            label: raw,
            prereqIds,
            type: "drop",
        };
    }

    if (/^(?:Transient Reward|WFItems Location(?: \(Legacy\))?):\s*The Descendia:/i.test(quantityNormalized)) {
        const prereqIds: string[] = [PR.THE_OLD_PEACE];
        if (/Steel Path/i.test(quantityNormalized)) prereqIds.push(PR.ACTIVITY_STEEL_PATH);
        return {
            label: raw,
            prereqIds,
            type: "drop",
        };
    }

    if (/^Cetus Bounty:/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.HUB_CETUS],
            type: "drop",
        };
    }

    if (/^Solaris Bounty:/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.VOX_SOLARIS],
            type: "drop",
        };
    }

    if (/^Deimos Bounty:\s*.*Arcana Isolation Vault/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.HUB_NECRALISK],
            type: "drop",
        };
    }

    if (/^Deimos Bounty:\s*.*Isolation Vault/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.HUB_NECRALISK],
            type: "drop",
        };
    }

    if (/^Deimos Bounty:/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.HUB_NECRALISK],
            type: "drop",
        };
    }

    if (/^Hex Reward:/i.test(quantityNormalized)) {
        const prereqIds: string[] = [PR.THE_HEX];
        if (/Steel Path/i.test(quantityNormalized)) prereqIds.push(PR.ACTIVITY_STEEL_PATH);
        return {
            label: raw,
            prereqIds,
            type: "drop",
        };
    }

    if (/^Transient Reward:\s*Razorback$/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.ACTIVITY_INVASIONS],
            type: "drop",
        };
    }

    if (/^Transient Reward:\s*Fomorian Sabotage$/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.ACTIVITY_INVASIONS, PR.ARCHWING],
            type: "drop",
        };
    }

    if (/^(?:Area|WFItems Location(?: \(Legacy\))?|Enemy Mod Drop|Resource Drop \(Avatar\)|Avatar Drop):\s*Orb Vallis\s*-\s*.+Enemies$/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.HUB_FORTUNA],
            type: "drop",
        };
    }

    if (/^(?:Enemy|Enemy Drop|Enemy Mod Drop|Resource Drop \(Avatar\)|Additional Drop \(Avatar\)|Avatar Drop|WFItems Location(?: \(Legacy\))?):\s*Drekar (Trooper|Eviscerator|Hellion|Heavy Gunner)$/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.JUNCTION_SATURN_URANUS],
            type: "drop",
        };
    }

    if (/^(?:Enemy|Enemy Drop|Enemy Mod Drop|Resource Drop \(Avatar\)|Additional Drop \(Avatar\)|Avatar Drop|WFItems Location(?: \(Legacy\))?):\s*Deimos (Carnis|Jugulus|Saxum|Leaping Thrasher)$/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.HUB_NECRALISK],
            type: "drop",
        };
    }

    if (/^(?:Enemy|Enemy Drop|Enemy Mod Drop|Resource Drop \(Avatar\)|Additional Drop \(Avatar\)|Avatar Drop|WFItems Location(?: \(Legacy\))?):\s*Deimos (Ancient Healer|Swarm Mutalist Moa)$/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.HUB_NECRALISK],
            type: "drop",
        };
    }

    if (/^(?:Enemy|Enemy Drop|Enemy Mod Drop|Resource Drop \(Avatar\)|Additional Drop \(Avatar\)|Avatar Drop|WFItems Location(?: \(Legacy\))?):\s*(Armis Ulta|Auditor|Azoth|Derim Zahn|Dru Pesfor|Jad Teran|Jen Dro|Lockjaw & Sol|M-W\.A\.M\.|Nako Xol|Pelna Cade|Rana Del|Raptor Rx|Tia Mayn|Ved Xol)$/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.ACTIVITY_INDEX],
            type: "drop",
        };
    }

    if (/^(?:Enemy|Enemy Drop|Enemy Mod Drop|Resource Drop \(Avatar\)|Additional Drop \(Avatar\)|Avatar Drop|WFItems Location(?: \(Legacy\))?):\s*Lumbering Fragment$/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.HUB_SANCTUM],
            type: "drop",
        };
    }

    if (/^(?:Enemy|Enemy Drop|Enemy Mod Drop|Resource Drop \(Avatar\)|Additional Drop \(Avatar\)|Avatar Drop|WFItems Location(?: \(Legacy\))?):\s*Techrot Scaart$/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.HUB_HOLLVANIA],
            type: "drop",
        };
    }

    if (/^(?:Enemy|Enemy Drop|Enemy Mod Drop|Resource Drop \(Avatar\)|Additional Drop \(Avatar\)|Avatar Drop|WFItems Location(?: \(Legacy\))?):\s*(Angst|Malice|Mania|Misery|Torment|Violence)(?:\s*\(Level 0 - 100\))?$/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.ACTIVITY_STEEL_PATH],
            type: "drop",
        };
    }

    if (/^(?:Enemy|Enemy Drop|Enemy Mod Drop|Resource Drop \(Avatar\)|Additional Drop \(Avatar\)|Avatar Drop|WFItems Location(?: \(Legacy\))?):\s*The Fragmented Suzerain$/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.WHISPERS_WALL],
            type: "drop",
        };
    }

    if (/^(?:Key Rewards|WFItems Location(?: \(Legacy\))?):\s*Operation:\s*Orphix Venom(?:,\s*Rotation [A-Z])?$/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.WAR_WITHIN, PR.HEART_OF_DEIMOS],
            type: "drop",
        };
    }

    if (/^(?:Enemy|Enemy Drop|Enemy Mod Drop|Resource Drop \(Avatar\)|Additional Drop \(Avatar\)|Avatar Drop|WFItems Location(?: \(Legacy\))?):\s*Juno (Fog|Nul|Sap|Slo) Comba$/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.JUNCTION_URANUS_NEPTUNE],
            type: "drop",
        };
    }

    if (/^(?:Enemy|Enemy Drop|Enemy Mod Drop|Resource Drop \(Avatar\)|Additional Drop \(Avatar\)|Avatar Drop|WFItems Location(?: \(Legacy\))?):\s*(Fog|Nul|Sap|Slo) Comba$/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.JUNCTION_JUPITER_EUROPA],
            type: "drop",
        };
    }

    if (/^(?:Enemy|Enemy Drop|Enemy Mod Drop|Resource Drop \(Avatar\)|Additional Drop \(Avatar\)|Avatar Drop|WFItems Location(?: \(Legacy\))?):\s*General Sargas Ruk$/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.JUNCTION_EUROPA_SATURN],
            type: "drop",
        };
    }

    if (/^(?:Enemy|Enemy Drop|Enemy Mod Drop|Resource Drop \(Avatar\)|Additional Drop \(Avatar\)|Avatar Drop|WFItems Location(?: \(Legacy\))?):\s*Leaping Thrasher$/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.DEIMOS_ACCESS],
            type: "drop",
        };
    }

    if (/^(?:Enemy|Enemy Drop|Enemy Mod Drop|Resource Drop \(Avatar\)|Additional Drop \(Avatar\)|Avatar Drop|WFItems Location(?: \(Legacy\))?):\s*Orphid Specter$/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.SILVER_GROVE],
            type: "drop",
        };
    }

    if (/^(?:Enemy|Enemy Drop|Enemy Mod Drop|Resource Drop \(Avatar\)|Additional Drop \(Avatar\)|Avatar Drop|WFItems Location(?: \(Legacy\))?):\s*Deimos Charger$/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.HUB_NECRALISK],
            type: "drop",
        };
    }

    if (/^(?:Enemy|Enemy Drop|Enemy Mod Drop|Resource Drop \(Avatar\)|Additional Drop \(Avatar\)|Avatar Drop|WFItems Location(?: \(Legacy\))?):\s*(Deimos Juggernaut|Polyp-Hog Juggernaut)$/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.HUB_NECRALISK],
            type: "drop",
        };
    }

    if (/^(?:Enemy|Enemy Drop|Enemy Mod Drop|Resource Drop \(Avatar\)|Additional Drop \(Avatar\)|Avatar Drop|WFItems Location(?: \(Legacy\))?):\s*Grineer Manic$/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.ACTIVITY_DEFECTION],
            type: "drop",
        };
    }

    if (/^(?:Additional Drop \(Avatar\)|Enemy|Enemy Drop|Enemy Mod Drop|Resource Drop \(Avatar\)|Avatar Drop):\s*Amalgam (Arca Heqet|Arca Kucumatz|Cinder Machinist|Phase Moa|Swarm Satyr)$/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.JUNCTION_CERES_JUPITER],
            type: "drop",
        };
    }

    if (/^(?:Transient Reward|WFItems Location(?: \(Legacy\))?):\s*Nokko:\s*(Corporate Restructuring(?: Rewards)?|Critter Liberation Rewards|Weed The Gardens Rewards)(?:\s*\(Steel Path\))?(?:,\s*Rotation [A-Z])?$/i.test(quantityNormalized)) {
        const prereqIds: string[] = [PR.HUB_FORTUNA, PR.NEW_WAR];
        if (/Steel Path/i.test(quantityNormalized)) prereqIds.push(PR.ACTIVITY_STEEL_PATH);
        return {
            label: raw,
            prereqIds,
            type: "drop",
        };
    }

    if (/^(?:Transient Reward|WFItems Location(?: \(Legacy\))?):\s*Temporal Archimedea (Gold|Silver|Legendary) Rewards$/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.THE_HEX, PR.SYNDICATE_HEX_RANK5],
            type: "drop",
        };
    }

    if (/^(?:Transient Reward|WFItems Location(?: \(Legacy\))?):\s*Deep Archimedea (Gold|Silver|Legendary) Rewards$/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.WHISPERS_WALL, PR.SYNDICATE_CAVIA_RANK5],
            type: "drop",
        };
    }

    if (/^(?:Additional Drop \(Avatar\)|Resource Drop \(Avatar\)|Avatar Drop):\s*Entrati Netracell Coffer(?:\s*\(Level 0 - 100\))?$/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.ACTIVITY_NETRACELLS],
            type: "drop",
        };
    }

    if (/^(?:Enemy|Enemy Drop|Enemy Mod Drop|Resource Drop \(Avatar\)|Additional Drop \(Avatar\)|Avatar Drop|WFItems Location(?: \(Legacy\))?):\s*Arcane Boiler$/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.STOLEN_DREAMS],
            type: "drop",
        };
    }

    if (/^(?:Enemy|Enemy Drop|Enemy Mod Drop|Resource Drop \(Avatar\)|Additional Drop \(Avatar\)|Avatar Drop|WFItems Location(?: \(Legacy\))?):\s*(Axio|Taro|Vorac|Orm) Detron Crewman$/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.SYSTEM_PROXIMA_ACCESS],
            type: "drop",
        };
    }

    if (/^(?:Enemy|Enemy Drop|Enemy Mod Drop|Resource Drop \(Avatar\)|Additional Drop \(Avatar\)|Avatar Drop|WFItems Location(?: \(Legacy\))?):\s*Terra Detron Crewman$/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.HUB_FORTUNA],
            type: "drop",
        };
    }

    if (/^(?:Enemy|Enemy Drop|Enemy Mod Drop|Resource Drop \(Avatar\)|Additional Drop \(Avatar\)|Avatar Drop|WFItems Location(?: \(Legacy\))?):\s*Vapos Detron Crewman$/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.JUNCTION_CERES_JUPITER],
            type: "drop",
        };
    }

    if (/^(?:Enemy|Enemy Drop|Enemy Mod Drop|Resource Drop \(Avatar\)|Additional Drop \(Avatar\)|Avatar Drop|WFItems Location(?: \(Legacy\))?):\s*Narmer Detron Crewman$/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.NEW_WAR],
            type: "drop",
        };
    }

    if (/Shadow Stalker/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.SECOND_DREAM],
            type: "drop",
        };
    }

    if (/Protector Stalker/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.JADE_SHADOWS],
            type: "drop",
        };
    }

    if (/Aerodynamic/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.ACTIVITY_ARBITRATIONS],
            type: "vendor",
        };
    }

    if (/Aero Agility/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.JUNCTION_CERES_JUPITER],
            type: "drop",
        };
    }

    if (/Aero Periphery|Aero Vantage/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.JUNCTION_CERES_JUPITER],
            type: "drop",
        };
    }

    if (/Aerial Commander/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.HUB_CETUS],
            type: "drop",
        };
    }

    if (/Juno Sapper MOA/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.JADE_SHADOWS],
            type: "drop",
        };
    }

    if (/\bPrimm\b|\bVERD-IE\b/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.HUB_ZARIMAN],
            type: "drop",
        };
    }

    if (/Sargas Ruk Sigil/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.JUNCTION_EUROPA_SATURN],
            type: "drop",
        };
    }

    if (/Tyl Regor Sigil/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.JUNCTION_SATURN_URANUS],
            type: "drop",
        };
    }

    if (/Raptor Sigil/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.JUNCTION_JUPITER_EUROPA],
            type: "drop",
        };
    }

    if (/Vay Hek Sigil/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.MR_5],
            type: "drop",
        };
    }

    if (/Vor Sigil/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.JUNCTION_MERCURY_VENUS],
            type: "drop",
        };
    }

    if (/Jackal Sigil/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.JUNCTION_VENUS_EARTH],
            type: "drop",
        };
    }

    if (/Hyena Sigil/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.JUNCTION_URANUS_NEPTUNE],
            type: "drop",
        };
    }

    if (/Lech Kril Sigil/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.JUNCTION_EARTH_MARS],
            type: "drop",
        };
    }

    if (/Holdfasts (Angel|Fallen|Guardian|Seraph|Watcher) Sigil/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.HUB_ZARIMAN],
            type: "vendor",
        };
    }

    if (/Quills (Adherent|Architect|Instrument|Mote|Observer) Sigil/i.test(quantityNormalized)) {
        const rankByTitle: Record<string, string> = {
            Mote: PR.SYNDICATE_QUILLS_RANK1,
            Observer: PR.SYNDICATE_QUILLS_RANK2,
            Adherent: PR.SYNDICATE_QUILLS_RANK3,
            Instrument: PR.SYNDICATE_QUILLS_RANK4,
            Architect: PR.SYNDICATE_QUILLS_RANK5,
        };
        const title = quantityNormalized.match(/Quills (Adherent|Architect|Instrument|Mote|Observer) Sigil/i)?.[1];
        return {
            label: raw,
            prereqIds: title ? [rankByTitle[title]] : [PR.WAR_WITHIN],
            type: "vendor",
        };
    }

    if (/Necraloid (Agnesis|Modus|Odima) Sigil/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.HEART_OF_DEIMOS, PR.WAR_WITHIN],
            type: "vendor",
        };
    }

    if (/Teralyst Sigil/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.HUB_CETUS],
            type: "drop",
        };
    }

    if (/Gantulyst Sigil|Hydrolyst Sigil/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.HUB_CETUS],
            type: "drop",
        };
    }

    if (/Lephantis Sigil/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.DEIMOS_ACCESS],
            type: "drop",
        };
    }

    if (/Bloodshed Sigil/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.HUB_FORTUNA, PR.SYNDICATE_SOLARIS_RANK5],
            type: "drop",
        };
    }

    if (/Leaping Thrasher Sigil/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.DEIMOS_ACCESS],
            type: "drop",
        };
    }

    if ((/\bStalker Sigil\b|\bStalker\b/i.test(quantityNormalized)) && !/Shadow Stalker|Protector Stalker|Night Stalker/i.test(quantityNormalized)) {
        return {
            label: raw,
            type: "drop",
        };
    }

    if (/Grustrag Sigil/i.test(quantityNormalized)) {
        return {
            label: raw,
            type: "drop",
        };
    }

    if (/Zanuka Hunter|Zanuka Sigil|Zanuka Arena Simulacrum/i.test(quantityNormalized)) {
        return {
            label: raw,
            type: "drop",
        };
    }

    const wfItemsBody = quantityNormalized.replace(/^WFItems Location(?: \(Legacy\))?:\s*/i, "");

    if (/^(Defiance|Armada|Vigilance|Uprising|Protectorate|Freedom Fighter|Armored|Rebellion|Unyielding|Champion) Sigil$/i.test(wfItemsBody)) {
        return {
            label: raw,
            prereqIds: [PR.HUB_RELAY],
            type: "vendor",
        };
    }

    if (/^(Guiding Path|Bending Will|Discipline|Will|Choice|Grasp|Potential|Succession|Surpassing|Truth) Sigil$/i.test(wfItemsBody)) {
        return {
            label: raw,
            prereqIds: [PR.HUB_RELAY],
            type: "vendor",
        };
    }

    if (/^(Query|Searching|Pattern Match|Atomic|Manifold|Fractal|Multivariate|Labyrinth|Hexan|Oracle) Sigil$/i.test(wfItemsBody)) {
        return {
            label: raw,
            prereqIds: [PR.HUB_RELAY],
            type: "vendor",
        };
    }

    if (/^(Progress|Opportunity|Calculating|Synergy|Directives|Strategy|Tessellations|Optimum|Capital|Chairman) Sigil$/i.test(wfItemsBody)) {
        return {
            label: raw,
            prereqIds: [PR.HUB_RELAY],
            type: "vendor",
        };
    }

    if (/^(Blades|Cull|Threat|Maelstrom|Lesion|Ruin|Viscera|Malevolent|Covert|Assassin) Sigil$/i.test(wfItemsBody)) {
        return {
            label: raw,
            prereqIds: [PR.HUB_RELAY],
            type: "vendor",
        };
    }

    if (/^(Sacrifice|Seed|Rebirth|Growth|Clarity|Bloom|Purity|Gaia|Bounty|Humanity) Sigil$/i.test(wfItemsBody)) {
        return {
            label: raw,
            prereqIds: [PR.HUB_RELAY],
            type: "vendor",
        };
    }

    if (/^(Awakening|Perception|Awareness|Revelation|Diligence|Prudence|Discretion|Ambition|Volition|Freedom|Enlightenment|Discovery|Accord|Insight|Empathy) Sigil$/i.test(wfItemsBody)) {
        return {
            label: raw,
            prereqIds: [PR.HUB_RELAY],
            type: "vendor",
        };
    }

    if (/Play Conclave|\(Conclave\)/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.HUB_RELAY],
            type: "drop",
        };
    }

    if (/Primary Bulwark/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.THE_OLD_PEACE],
            type: "drop",
        };
    }

    if (/Animal Instinct/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.ACTIVITY_NIGHTMARE],
            type: "drop",
        };
    }

    if (/Nightmare Mode Rewards|Nightmare Mode Rescue/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.ACTIVITY_NIGHTMARE],
            type: "drop",
        };
    }

    if (/Nightmare Tatters/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.CHAINS_HARROW],
            type: "drop",
        };
    }

    if (/^Duviri Endless: Tier \d+ \(Normal\)$/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.DUVIRI_PARADOX],
            type: "drop",
        };
    }

    if (/^Duviri Endless: Tier \d+ \(Hard\)$/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.DUVIRI_PARADOX, PR.ACTIVITY_STEEL_PATH],
            type: "drop",
        };
    }

    if (/^Duviri: Murmur Invasion rewards \(Rotation [A-Z]\)$/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.DUVIRI_PARADOX],
            type: "drop",
        };
    }

    if (/^Duviri: Murmur Invasion rewards \(Steel Path, Rotation [A-Z]\)$/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.DUVIRI_PARADOX, PR.ACTIVITY_STEEL_PATH],
            type: "drop",
        };
    }

    if (/^Enemy: Exploiter Orb$/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.HUB_FORTUNA, PR.SYNDICATE_SOLARIS_RANK5],
            type: "drop",
        };
    }

    if (/^Enemy: The Sergeant$/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.JUNCTION_MARS_PHOBOS],
            type: "drop",
        };
    }

    if (/^Enemy: Tusk Thumper(?: Bull| Doma)?$/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.HUB_CETUS],
            type: "drop",
        };
    }

    if (/^Enemy: Narmer Thumper(?: Bull| Doma)?$/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.HUB_CETUS, PR.NEW_WAR],
            type: "drop",
        };
    }

    if (/Phorid Sigil|Blood For Ammo/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.ACTIVITY_INVASIONS],
            type: "drop",
        };
    }

    if (/Legacy: Albrecht[’']s Laboratories bounty/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.HUB_SANCTUM],
            type: "drop",
        };
    }

    if (/Albrecht[’']s Laboratories|Entrati Lab Bounty/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.HUB_SANCTUM],
            type: "drop",
        };
    }

    if (/Open Zariman reinforced carrypods/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.HUB_ZARIMAN],
            type: "drop",
        };
    }

    if (/^WFItems Location(?: \(Legacy\))?:\s*Sanctuary$/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.HUB_RELAY, PR.NEW_STRANGE],
            type: "drop",
        };
    }

    if (/Run Narmer bounties/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.NEW_WAR],
            type: "drop",
        };
    }

    if (/Play Naberus event content/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.HUB_NECRALISK],
            type: "drop",
        };
    }

    for (const { prefix, prereqIds } of STAR_CHART_REGION_PREREQS) {
        const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        if (
            new RegExp(`^(?:Mission:\\s*)?${escapedPrefix}\\s+-\\s+`, "i").test(quantityNormalized) ||
            new RegExp(`^(Mission Reward|Caches):\\s*${escapedPrefix}\\s*/\\s*`, "i").test(quantityNormalized) ||
            new RegExp(`^WFItems Location(?: \\(Legacy\\))?:\\s*${escapedPrefix}\\s*/\\s*`, "i").test(quantityNormalized)
        ) {
            const sourcePrereqIds = [...prereqIds];
            if (/Steel Path/i.test(quantityNormalized)) sourcePrereqIds.push(PR.ACTIVITY_STEEL_PATH);
            return {
                label: raw,
                prereqIds: Array.from(new Set(sourcePrereqIds)),
                type: "drop",
            };
        }
    }

    if (/(^| )Thrax Plasm/i.test(quantityNormalized) && !/Lua Thrax Plasm/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.ANGELS_ZARIMAN],
            type: "drop",
        };
    }

    if (/(Aerial|Momentous|Reinforced|Tenacious) Bond/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.HUB_FORTUNA],
            type: "vendor",
        };
    }

    if (/(Contagious|Duplex|Seismic|Vicious) Bond/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.HUB_NECRALISK],
            type: "vendor",
        };
    }

    if (/(Covert|Manifold|Mystic|Restorative|Tandem) Bond/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.HUB_CETUS],
            type: "vendor",
        };
    }

    const syndicateVendorAlias = SYNDICATE_VENDOR_ALIASES.find(({ prefix }) => wfItemsBody.startsWith(prefix));
    if (syndicateVendorAlias) {
        const override = getSyndicateVendorOverride(syndicateVendorAlias.canonicalName);
        if (override) {
            return {
                label: raw,
                prereqIds: override.prereqIds,
                type: "vendor",
            };
        }
    }

    const syndicateVendor = raw.match(/^Syndicate Vendor:\s*([^()]+?)(?:\s*\(|\s*$)/i);
    if (syndicateVendor) {
        const vendorName = syndicateVendor[1]?.trim();
        if (!vendorName) return null;

        const override = getSyndicateVendorOverride(vendorName);
        const extraPrereqs = inferExtraPrereqsFromSourceLabel(raw, vendorName);
        return {
            label: raw,
            prereqIds: Array.from(new Set([...(override?.prereqIds ?? []), ...extraPrereqs])),
            type: "vendor",
        };
    }

    if (/^WFItems Location(?: \(Legacy\))?:/i.test(quantityNormalized)) {
        if (/Arcane Boiler/i.test(quantityNormalized)) {
            return {
                label: raw,
                prereqIds: [PR.STOLEN_DREAMS],
                type: "drop",
            };
        }

        if (/\bTerra\b/.test(quantityNormalized)) {
            return {
                label: raw,
                prereqIds: [PR.HUB_FORTUNA],
                type: "drop",
            };
        }

        if (/\bVapos\b/.test(quantityNormalized)) {
            return {
                label: raw,
                prereqIds: [PR.JUNCTION_CERES_JUPITER],
                type: "drop",
            };
        }

        if (/\bNarmer\b/.test(quantityNormalized)) {
            return {
                label: raw,
                prereqIds: [PR.NEW_WAR],
                type: "drop",
            };
        }

        if (/\bArid\b/.test(quantityNormalized)) {
            return {
                label: raw,
                prereqIds: [PR.JUNCTION_EARTH_MARS],
                type: "drop",
            };
        }

        if (/\bFrontier\b/.test(quantityNormalized)) {
            return {
                label: raw,
                prereqIds: [PR.VORS_PRIZE],
                type: "drop",
            };
        }

        if (/\bTusk\b/.test(quantityNormalized)) {
            return {
                label: raw,
                prereqIds: [PR.HUB_CETUS],
                type: "drop",
            };
        }

        if (/\bKuva\b/.test(quantityNormalized)) {
            return {
                label: raw,
                prereqIds: [PR.WAR_WITHIN],
                type: "drop",
            };
        }

        if (/\b(Axio|Taro|Vorac|Orm|Aurax)\b/.test(quantityNormalized)) {
            return {
                label: raw,
                prereqIds: [PR.SYSTEM_PROXIMA_ACCESS],
                type: "drop",
            };
        }

        if (/\bScrofa\b/.test(quantityNormalized)) {
            return {
                label: raw,
                prereqIds: [PR.HUB_FORTUNA, PR.NEW_WAR],
                type: "drop",
            };
        }

        if (/Elite Sanctuary Onslaught|Sanctuary Onslaught/i.test(quantityNormalized)) {
            return {
                label: raw,
                prereqIds: ["hub_relay", PR.NEW_STRANGE],
                type: "drop",
            };
        }

        if (/Void Storm/i.test(quantityNormalized)) {
            return {
                label: raw,
                prereqIds: [PR.ACTIVITY_VOID_STORMS],
                type: "drop",
            };
        }

        if (/Profit-Taker/i.test(quantityNormalized)) {
            return {
                label: raw,
                prereqIds: [PR.HUB_FORTUNA, PR.SYNDICATE_SOLARIS_RANK5],
                type: "drop",
            };
        }

        if (/Eidolon Teralyst/i.test(quantityNormalized)) {
            return {
                label: raw,
                prereqIds: [PR.HUB_CETUS],
                type: "drop",
            };
        }

        if (/Eidolon Gantulyst|Eidolon Hydrolyst/i.test(quantityNormalized)) {
            return {
                label: raw,
                prereqIds: [PR.HUB_CETUS],
                type: "drop",
            };
        }

        if (/Derelict Vault/i.test(quantityNormalized)) {
            return {
                label: raw,
                prereqIds: [PR.CLAN_DOJO, PR.DEIMOS_ACCESS],
                type: "drop",
            };
        }

        if (/Duviri Circuit/i.test(quantityNormalized)) {
            return {
                label: raw,
                prereqIds: [PR.DUVIRI_PARADOX],
                type: "drop",
            };
        }

        if (/Duviri Full Experience|Duviri Experience|Duviri Lone Story|Kullervo's Hold/i.test(quantityNormalized)) {
            return {
                label: raw,
                prereqIds: [PR.DUVIRI_PARADOX],
                type: "drop",
            };
        }

        if (/H[öo]llvania .*WF1999 Bounty|Hallowed Flame/i.test(quantityNormalized)) {
            return {
                label: raw,
                prereqIds: [PR.HUB_HOLLVANIA],
                type: "drop",
            };
        }

        if (/Zariman Ten Zero .* Zariman Bounty/i.test(quantityNormalized)) {
            return {
                label: raw,
                prereqIds: [PR.HUB_ZARIMAN],
                type: "drop",
            };
        }

        if (/Entrati Netracell Coffer/i.test(quantityNormalized)) {
            return {
                label: raw,
                prereqIds: [PR.ACTIVITY_NETRACELLS],
                type: "drop",
            };
        }

        if (/Abyssal Beacon/i.test(quantityNormalized)) {
            return {
                label: raw,
                prereqIds: [PR.ACTIVITY_ABYSSAL_ZONE],
                type: "drop",
            };
        }

        if (/Arbitration Shield Drone|Arbitrations|Vitus Essence/i.test(quantityNormalized)) {
            return {
                label: raw,
                prereqIds: [PR.ACTIVITY_ARBITRATIONS],
                type: "drop",
            };
        }

        if (/Sorties/i.test(prefixStripped)) {
            return {
                label: raw,
                prereqIds: [PR.ACTIVITY_SORTIES],
                type: "drop",
            };
        }

        if (/Exploiter Orb/i.test(quantityNormalized)) {
            return {
                label: raw,
                prereqIds: [PR.HUB_FORTUNA, PR.SYNDICATE_SOLARIS_RANK5],
                type: "drop",
            };
        }

        if (/Atmo Systems|Gyromag Systems|Repeller Systems/i.test(quantityNormalized)) {
            return {
                label: raw,
                prereqIds: [PR.HUB_FORTUNA, PR.SYNDICATE_SOLARIS_RANK5],
                type: "drop",
            };
        }

        if (/Duviri Murmur Invasion Rewards/i.test(quantityNormalized)) {
            const prereqIds: string[] = [PR.DUVIRI_PARADOX];
            if (/Steel Path|Hard/i.test(quantityNormalized)) prereqIds.push(PR.ACTIVITY_STEEL_PATH);
            return {
                label: raw,
                prereqIds,
                type: "drop",
            };
        }

        if (/Duviri\/Endless/i.test(quantityNormalized)) {
            const prereqIds = [/Hard/i.test(quantityNormalized) ? PR.ACTIVITY_CIRCUIT_STEEL_PATH : PR.ACTIVITY_CIRCUIT];
            return {
                label: raw,
                prereqIds,
                type: "drop",
            };
        }

        if (/Tusk Thumper/i.test(quantityNormalized)) {
            return {
                label: raw,
                prereqIds: [PR.HUB_CETUS],
                type: "drop",
            };
        }

        if (/Narmer Thumper/i.test(quantityNormalized)) {
            return {
                label: raw,
                prereqIds: [PR.NEW_WAR, PR.HUB_CETUS],
                type: "drop",
            };
        }

        if (/The Sergeant/i.test(quantityNormalized)) {
            return {
                label: raw,
                prereqIds: [PR.JUNCTION_MARS_PHOBOS],
                type: "drop",
            };
        }

        if (/Wolf Of Saturn Six/i.test(quantityNormalized)) {
            return {
                label: raw,
                prereqIds: [PR.ACTIVITY_NIGHTWAVE],
                type: "drop",
            };
        }

        if (/Zealoid Prelate/i.test(quantityNormalized)) {
            return {
                label: raw,
                prereqIds: [PR.HEART_OF_DEIMOS],
                type: "drop",
            };
        }

        if (/Breath Of The Eidolon|Orokin Animus Matrix|Orokin Ballistics Matrix|Orokin Orientation Matrix/i.test(quantityNormalized)) {
            return {
                label: raw,
                prereqIds: [PR.HUB_CETUS],
                type: "drop",
            };
        }

        if (/Calda Toroid|Sola Toroid|Vega Toroid/i.test(quantityNormalized)) {
            return {
                label: raw,
                prereqIds: [PR.HUB_FORTUNA],
                type: "drop",
            };
        }

        if (/Corrupted Holokey/i.test(quantityNormalized)) {
            return {
                label: raw,
                prereqIds: [PR.ACTIVITY_VOID_STORMS],
                type: "drop",
            };
        }

        if (/Void Traces/i.test(quantityNormalized)) {
            return {
                label: raw,
                prereqIds: [PR.ACTIVITY_VOID_FISSURES],
                type: "drop",
            };
        }

        if (/Condroc|Kuaka|Mergoo|Grokdrul|Iradite|Cetus Wisp|Maprico|Nistlepod|Fish Scales|Goopolla Spleen|Khut-Khut Venom Sac|Mawfish Bones|Archimedean Itzam/i.test(quantityNormalized)) {
            return {
                label: raw,
                prereqIds: [PR.HUB_CETUS],
                type: "drop",
            };
        }

        if (/Atmo Systems|Gyromag Systems|Repeller Systems/i.test(quantityNormalized)) {
            return {
                label: raw,
                prereqIds: [PR.HUB_FORTUNA, PR.SYNDICATE_SOLARIS_RANK5],
                type: "drop",
            };
        }

        if (/Charc Electroplax|Thermal Sludge|Hexenon|Asterite/i.test(quantityNormalized)) {
            return {
                label: raw,
                prereqIds: [PR.HUB_FORTUNA],
                type: "drop",
            };
        }

        if (/Coprite Alloy|Pyrotic Alloy|Esher Devar|Fersteel Alloy|Marquise Veridos|Tear Azurite/i.test(quantityNormalized)) {
            return {
                label: raw,
                prereqIds: [PR.HUB_CETUS],
                type: "drop",
            };
        }

        if (/Agnovidisc|Atramentum|Ganglion|Gorgaricus Spore|Lucent Teroglobe|Mytocardia Spore|Necracoil|Pustulite|Scintillant|Fass Residue|Vome Residue|Yogwun Stomach/i.test(quantityNormalized)) {
            return {
                label: raw,
                prereqIds: [PR.HUB_NECRALISK],
                type: "drop",
            };
        }

        if (/H[öo]llvanian Pitchweave Fragment|Techrot Chitin|Techrot Motherboard|Temporal Dust|Saggen Pearl|Aggristone|Servoris|Efervon Sample|Ignia/i.test(quantityNormalized)) {
            return {
                label: raw,
                prereqIds: [PR.HUB_HOLLVANIA],
                type: "drop",
            };
        }

        if (/Connla Sprout|Dracroot|Eevani|Kovnik|Ueymag|Yao Shrub|Laudavi|Fergolyte|Kullervo's Bane/i.test(quantityNormalized)) {
            return {
                label: raw,
                prereqIds: [PR.DUVIRI_PARADOX],
                type: "drop",
            };
        }

        if (/Mortus Horn|Tralok Eyes/i.test(quantityNormalized)) {
            return {
                label: raw,
                prereqIds: [PR.HUB_CETUS],
                type: "drop",
            };
        }

        if (/Steel Essence/i.test(quantityNormalized)) {
            return {
                label: raw,
                prereqIds: [PR.ACTIVITY_STEEL_PATH],
                type: "drop",
            };
        }

        if (/Narmer Isoplast/i.test(quantityNormalized)) {
            return {
                label: raw,
                prereqIds: [PR.NEW_WAR],
                type: "drop",
            };
        }

        if (/Experimental Arc-Relay|Scuttler Husk|002-Er|Enigma Gyrum/i.test(quantityNormalized)) {
            return {
                label: raw,
                prereqIds: [PR.HUB_HOLLVANIA],
                type: "drop",
            };
        }

        if (/Maphica/i.test(quantityNormalized)) {
            return {
                label: raw,
                prereqIds: [PR.THE_OLD_PEACE],
                type: "drop",
            };
        }

        if (/Stela/i.test(quantityNormalized)) {
            return {
                label: raw,
                prereqIds: [PR.HUB_HOLLVANIA],
                type: "drop",
            };
        }

        if (/Vainthorn/i.test(quantityNormalized)) {
            return {
                label: raw,
                prereqIds: [PR.ACTIVITY_ABYSSAL_ZONE],
                type: "drop",
            };
        }

        if (/Lua Thrax Plasm|Voidgel Orb/i.test(quantityNormalized)) {
            return {
                label: raw,
                prereqIds: [PR.ANGELS_ZARIMAN],
                type: "drop",
            };
        }

        if (/Advances Debt-Bond|Familial Debt-Bond|Medical Debt-Bond|Shelter Debt-Bond|Training Debt-Bond/i.test(quantityNormalized)) {
            return {
                label: raw,
                prereqIds: [PR.HUB_FORTUNA],
                type: "drop",
            };
        }

        if (/Conclave Skin/i.test(quantityNormalized)) {
            return {
                label: raw,
                prereqIds: [PR.HUB_RELAY],
                type: "vendor",
            };
        }

        if (/Adaptation/i.test(quantityNormalized)) {
            return {
                label: raw,
                prereqIds: [PR.ACTIVITY_ARBITRATIONS],
                type: "drop",
            };
        }

        if (/Alad V/i.test(quantityNormalized)) {
            return {
                label: raw,
                prereqIds: [PR.JUNCTION_CERES_JUPITER],
                type: "drop",
            };
        }

    if (/Ambulas/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.JUNCTION_NEPTUNE_PLUTO],
            type: "drop",
        };
    }

    if (/Kela De Thaym/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.JUNCTION_SEDNA_ERIS],
            type: "drop",
        };
    }

    if (/Jackal/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.JUNCTION_VENUS_EARTH],
            type: "drop",
        };
    }

    if (/Hyena(?: Pack| Ln2| Ng| Pb| Th)?/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.JUNCTION_URANUS_NEPTUNE],
            type: "drop",
        };
    }

    if (/Sister Of Parvos \(Ascension(?: Hard)? Mode\)/i.test(quantityNormalized)) {
        return {
            label: raw,
            prereqIds: [PR.JADE_SHADOWS],
            type: "drop",
        };
    }

        if (/The Descendia|Dark Refractory/i.test(raw)) {
            const prereqIds: string[] = [PR.THE_OLD_PEACE];
            if (/Steel Path/i.test(raw)) prereqIds.push(PR.ACTIVITY_STEEL_PATH);
            return {
                label: raw,
                prereqIds,
                type: "drop",
            };
        }

        if (/Another Betrayer|Family Reunion|Hot Mess|Recover the Orokin Archive|Sunkiller|Table for Two|The Aftermath|Times Up|Faceoff/i.test(prefixStripped)) {
            const prereqIds: string[] = [PR.THE_HEX];
            if (/Steel Path/i.test(prefixStripped)) prereqIds.push(PR.ACTIVITY_STEEL_PATH);
            return {
                label: raw,
                prereqIds,
                type: "drop",
            };
        }
    }

    const wfItemsSimaris = raw.match(/^WFItems Location(?: \(Legacy\))?:\s*Cephalon Simaris\s*,?\s*(.*)$/i);
    if (wfItemsSimaris) {
        const extraPrereqs = inferExtraPrereqsFromSourceLabel(raw, "Cephalon Simaris");
        return {
            label: raw,
            prereqIds: Array.from(new Set(["hub_relay", PR.NEW_STRANGE, ...extraPrereqs])),
            type: "vendor",
        };
    }

    return null;
}

function safeString(v: unknown): string | null {
    return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

function normalizeName(s: string): string {
    return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function foldDiacritics(s: string): string {
    // NFKD splits letters+diacritics, then we remove the diacritic marks
    return (s ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeNameNoPunct(s: string): string {
    const folded = foldDiacritics(s);
    return normalizeName(folded).replace(/[^a-z0-9 ]+/g, "").replace(/\s+/g, " ").trim();
}

function toToken(s: string): string {
    return normalizeNameNoPunct(s).replace(/\s+/g, "-");
}

function slugifyDropNodeToken(s: string): string {
    return String(s ?? "")
        .trim()
        .toLowerCase()
        .replace(/['"]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 80);
}

function titleCaseTokenWords(s: string): string {
    return String(s ?? "")
        .split(/[_-]+/g)
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

function humanizeDropNodePlanet(token: string): string {
    const normalized = String(token ?? "").trim().toLowerCase();
    const specialCases: Record<string, string> = {
        "kuva-fortress": "Kuva Fortress",
        "veil-proxima": "Veil Proxima",
        "earth-proxima": "Earth Proxima",
        "saturn-proxima": "Saturn Proxima",
        "venus-proxima": "Venus Proxima",
        "neptune-proxima": "Neptune Proxima",
        hollvania: "Höllvania",
    };
    return specialCases[normalized] ?? titleCaseTokenWords(normalized);
}

/**
 * Build a valid data: SourceId payload segment.
 * Use "/" to keep it stable and consistent across layers.
 */
function dataId(parts: string[]): string {
    const cleaned = parts
        .map((p) => safeString(p) ?? "")
        .filter((p) => p.length > 0)
        .map((p) => toToken(p))
        .filter((p) => p.length > 0);

    if (cleaned.length === 0) return "data:unknown";
    return `data:${cleaned.join("/")}`;
}

/**
 * Build a valid src: SourceId payload segment (no extra colons).
 * MUST match src/catalog/sources/sourceCatalog.ts behavior used elsewhere.
 *
 * This intentionally uses the same tokenization as acquisitionFromDropData.ts:
 * normalizeNameNoPunct -> hyphenated token segments.
 */
function srcId(parts: string[]): string {
    const cleaned = parts
        .map((p) => safeString(p) ?? "")
        .filter((p) => p.length > 0)
        .map((p) => toToken(p))
        .filter((p) => p.length > 0);

    if (cleaned.length === 0) return "src:unknown";
    return `src:${cleaned.join("/")}`;
}

function pushUnique(out: RawSource[], seen: Set<string>, id: string, label: string, type: RawSource["type"]): void {
    const sid = safeString(id);
    const lab = safeString(label);
    if (!sid || !lab) return;
    if (seen.has(sid)) return;
    seen.add(sid);
    out.push({ id: sid, label: lab, type });
}

/**
 * WFCD-derived drop sources (already labeled).
 * Preserve WFCD IDs verbatim (commonly data:drop:<hash>).
 */
function buildWfcdDropSources(): RawSource[] {
    const out: RawSource[] = [];
    const seen = new Set<string>();

    for (const [sid, label] of Object.entries(wfcdSourceLabels as Record<string, string>)) {
        const inferred = inferSourceMetadataFromLabel(label);
        pushUnique(out, seen, sid, inferred?.label ?? label, inferred?.type ?? "drop");
        if (inferred?.prereqIds?.length) {
            out[out.length - 1] = {
                ...out[out.length - 1],
                prereqIds: inferred.prereqIds,
            };
        }
    }

    out.sort((a, b) => a.label.localeCompare(b.label));
    return out;
}

/**
 * Mission node sources derived from missionRewards.json.
 * MUST match acquisitionFromDropData.ts:
 *   dataId(["node", planetName, nodeName])
 */
function buildMissionNodeSources(): RawSource[] {
    const out: RawSource[] = [];
    const seen = new Set<string>();

    const mrRoot = (missionRewardsJson as any)?.missionRewards ?? (missionRewardsJson as any);
    if (!mrRoot || typeof mrRoot !== "object") return out;

    for (const [planetName, planetObj] of Object.entries(mrRoot as Record<string, any>)) {
        if (!planetObj || typeof planetObj !== "object") continue;

        for (const [nodeName, nodeObj] of Object.entries(planetObj as Record<string, any>)) {
            if (!nodeObj || typeof nodeObj !== "object") continue;

            const id = dataId(["node", planetName, nodeName]);
            const gameMode = safeString((nodeObj as any)?.gameMode);
            // (Extra) = Steel Path variant — replace in the display label only; ID stays stable.
            const nodeNameDisplay = String(nodeName).replace(/\s*\(Extra\)\s*$/i, " (Steel Path)");
            const label = gameMode ? `${planetName} - ${nodeNameDisplay} (${gameMode})` : `${planetName} - ${nodeNameDisplay}`;
            const inferred = inferSourceMetadataFromLabel(label);
            pushUnique(out, seen, id, inferred?.label ?? label, inferred?.type ?? "drop");
            if (inferred?.prereqIds?.length) {
                out[out.length - 1] = {
                    ...out[out.length - 1],
                    prereqIds: inferred.prereqIds,
                };
            }
        }
    }

    out.sort((a, b) => a.label.localeCompare(b.label));
    return out;
}

function buildMissionDropNodeAliasSources(): RawSource[] {
    const out: RawSource[] = [];
    const seen = new Set<string>();

    const mrRoot = (missionRewardsJson as any)?.missionRewards ?? (missionRewardsJson as any);
    if (!mrRoot || typeof mrRoot !== "object") return out;

    for (const [planetNameRaw, planetObj] of Object.entries(mrRoot as Record<string, any>)) {
        if (!planetObj || typeof planetObj !== "object") continue;

        const planetName = String(planetNameRaw ?? "").trim();
        const planetToken = slugifyDropNodeToken(planetName);
        if (!planetName || !planetToken) continue;

        for (const [nodeNameRaw, nodeObj] of Object.entries(planetObj as Record<string, any>)) {
            if (!nodeObj || typeof nodeObj !== "object") continue;

            const nodeName = String(nodeNameRaw ?? "").trim();
            const nodeToken = slugifyDropNodeToken(nodeName);
            if (!nodeName || !nodeToken) continue;

            const gameMode = safeString((nodeObj as any)?.gameMode);
            const nodeNameDisplay = nodeName.replace(/\s*\(Extra\)\s*$/i, " (Steel Path)");
            const label = gameMode
                ? `Mission: ${planetName} - ${nodeNameDisplay} (${gameMode})`
                : `Mission: ${planetName} - ${nodeNameDisplay}`;
            const inferred = inferSourceMetadataFromLabel(label);
            pushUnique(out, seen, `data:drop:node:${planetToken}:${nodeToken}`, inferred?.label ?? label, inferred?.type ?? "drop");
            if (inferred?.prereqIds?.length) {
                out[out.length - 1] = {
                    ...out[out.length - 1],
                    prereqIds: inferred.prereqIds,
                };
            }
        }
    }

    const sourcePool = Array.isArray((itemAcquisitionJson as any)?.sourcePool)
        ? ((itemAcquisitionJson as any).sourcePool as unknown[])
        : [];

    for (const rawSourceId of sourcePool) {
        if (typeof rawSourceId !== "string" || !rawSourceId.startsWith("data:drop:node:")) continue;

        // The mission-rewards pass above already emitted canonical node IDs.
        // Do not pass duplicate IDs through pushUnique: the metadata assignment
        // below targets the last inserted row, not the duplicate's original
        // row, and used to leak a later node's region gate onto another source.
        if (seen.has(rawSourceId)) continue;

        const match = rawSourceId.match(/^data:drop:node:([^:]+):(.+)$/);
        if (!match) continue;

        const [, planetToken, nodeToken] = match;
        const label = `Mission: ${humanizeDropNodePlanet(planetToken)} - ${titleCaseTokenWords(nodeToken)}`;
        const inferred = inferSourceMetadataFromLabel(label);
        pushUnique(out, seen, rawSourceId, inferred?.label ?? label, inferred?.type ?? "drop");
        if (inferred?.prereqIds?.length) {
            out[out.length - 1] = {
                ...out[out.length - 1],
                prereqIds: inferred.prereqIds,
            };
        }
    }

    out.sort((a, b) => a.label.localeCompare(b.label));
    return out;
}

function buildRankedSyndicateSources(): RawSource[] {
    const out: RawSource[] = [];
    const seen = new Set<string>();

    const quillsRanks: Array<{ token: string; label: string; prereqIds: string[] }> = [
        { token: "mote", label: "Buy from The Quills (Mote rank)", prereqIds: [PR.SYNDICATE_QUILLS_RANK1] },
        { token: "observer", label: "Buy from The Quills (Observer rank)", prereqIds: [PR.SYNDICATE_QUILLS_RANK2] },
        { token: "adherent", label: "Buy from The Quills (Adherent rank)", prereqIds: [PR.SYNDICATE_QUILLS_RANK3] },
        { token: "instrument", label: "Buy from The Quills (Instrument rank)", prereqIds: [PR.SYNDICATE_QUILLS_RANK4] },
        { token: "architect", label: "Buy from The Quills (Architect rank)", prereqIds: [PR.SYNDICATE_QUILLS_RANK5] },
    ];

    for (const rank of quillsRanks) {
        pushUnique(out, seen, `data:syndicate/quills/${rank.token}`, rank.label, "vendor");
        out[out.length - 1] = {
            ...out[out.length - 1],
            prereqIds: rank.prereqIds,
        };
    }

    const holdfastRankInfo: Record<string, { label: string; prereqIds: string[] }> = {
        neutral: { label: "Neutral rank", prereqIds: [PR.HUB_ZARIMAN] },
        watcher: { label: "Watcher rank", prereqIds: [PR.HUB_ZARIMAN, PR.SYNDICATE_HOLDFASTS_RANK1] },
        guardian: { label: "Guardian rank", prereqIds: [PR.HUB_ZARIMAN, PR.SYNDICATE_HOLDFASTS_RANK2] },
        fallen: { label: "Fallen rank", prereqIds: [PR.HUB_ZARIMAN, PR.SYNDICATE_HOLDFASTS_RANK3] },
        seraph: { label: "Seraph rank", prereqIds: [PR.HUB_ZARIMAN, PR.SYNDICATE_HOLDFASTS_RANK4] },
        angel: { label: "Angel rank", prereqIds: [PR.HUB_ZARIMAN, PR.SYNDICATE_HOLDFASTS_RANK5] },
    };

    const holdfastVendors: Record<string, string> = {
        cavalero: "Cavalero",
        hombask: "Hombask",
    };

    for (const [vendorToken, vendorLabel] of Object.entries(holdfastVendors)) {
        for (const [rankToken, rankInfo] of Object.entries(holdfastRankInfo)) {
            pushUnique(
                out,
                seen,
                `data:syndicate/holdfasts/${vendorToken}/${rankToken}`,
                `Buy from ${vendorLabel} (${rankInfo.label})`,
                "vendor",
            );
            out[out.length - 1] = {
                ...out[out.length - 1],
                prereqIds: rankInfo.prereqIds,
            };
        }
    }

    out.sort((a, b) => a.label.localeCompare(b.label));
    return out;
}

/**
 * Mission reward sources (typed) derived from missionRewards.json.
 *
 * Emits (canonical):
 *   data:missionreward/<planet>/<node>
 *   data:missionreward/<planet>/<node>/rotationa|rotationb|rotationc
 *
 * NOTE:
 * - Node names in missionRewards.json sometimes include suffixes like "(Caches)" or "(Extra)".
 * - acquisitionFromWarframeItems/acquisitionFromDropData canonicalize those to the base node name.
 * - Therefore we MUST strip those suffixes before tokenization here.
 */
function buildMissionRewardSources(): RawSource[] {
    const out: RawSource[] = [];
    const seen = new Set<string>();

    const mrRoot = (missionRewardsJson as any)?.missionRewards ?? (missionRewardsJson as any);
    if (!mrRoot || typeof mrRoot !== "object" || Array.isArray(mrRoot)) return out;

    // Only strip (Caches) — (Extra) is the Steel Path variant and gets its own source ID + label.
    const stripNodeSuffix = (s: string): string => s.replace(/\s*\(Caches\)\s*$/i, "");

    for (const [planetName, planetObj] of Object.entries(mrRoot as Record<string, any>)) {
        if (!planetObj || typeof planetObj !== "object") continue;

        for (const [nodeNameRaw, nodeObj] of Object.entries(planetObj as Record<string, any>)) {
            if (!nodeObj || typeof nodeObj !== "object") continue;

            const nodeNameBase = stripNodeSuffix(String(nodeNameRaw));

            // (Extra) suffix = Steel Path variant. Use it as-is for the ID (tokenizer strips parens),
            // but replace "(Extra)" with "(Steel Path)" in the human-readable label.
            const isSteelPath = /\s*\(Extra\)\s*$/i.test(nodeNameBase);
            const nodeNameDisplay = isSteelPath
                ? nodeNameBase.replace(/\s*\(Extra\)\s*$/i, " (Steel Path)")
                : nodeNameBase;

            // Canonical ids (match what your jq script expects: data:missionreward/<planet>/<baseNode>)
            const baseId = dataId(["missionreward", String(planetName), nodeNameBase]);
            const baseLabel = `Mission Reward: ${planetName} / ${nodeNameDisplay}`;
            const baseInferred = inferSourceMetadataFromLabel(baseLabel);
            pushUnique(out, seen, baseId, baseInferred?.label ?? baseLabel, baseInferred?.type ?? "drop");
            if (baseInferred?.prereqIds?.length) {
                out[out.length - 1] = {
                    ...out[out.length - 1],
                    prereqIds: baseInferred.prereqIds,
                };
            }

            const rewards = (nodeObj as any)?.rewards;
            if (!rewards || typeof rewards !== "object" || Array.isArray(rewards)) continue;

            const hasA = Object.prototype.hasOwnProperty.call(rewards, "A");
            const hasB = Object.prototype.hasOwnProperty.call(rewards, "B");
            const hasC = Object.prototype.hasOwnProperty.call(rewards, "C");

            if (hasA) {
                const label = `${baseLabel} (Rotation A)`;
                const inferred = inferSourceMetadataFromLabel(label);
                pushUnique(out, seen, dataId(["missionreward", planetName, nodeNameBase, "rotationa"]), inferred?.label ?? label, inferred?.type ?? "drop");
                if (inferred?.prereqIds?.length) {
                    out[out.length - 1] = {
                        ...out[out.length - 1],
                        prereqIds: inferred.prereqIds,
                    };
                }
            }
            if (hasB) {
                const label = `${baseLabel} (Rotation B)`;
                const inferred = inferSourceMetadataFromLabel(label);
                pushUnique(out, seen, dataId(["missionreward", planetName, nodeNameBase, "rotationb"]), inferred?.label ?? label, inferred?.type ?? "drop");
                if (inferred?.prereqIds?.length) {
                    out[out.length - 1] = {
                        ...out[out.length - 1],
                        prereqIds: inferred.prereqIds,
                    };
                }
            }
            if (hasC) {
                const label = `${baseLabel} (Rotation C)`;
                const inferred = inferSourceMetadataFromLabel(label);
                pushUnique(out, seen, dataId(["missionreward", planetName, nodeNameBase, "rotationc"]), inferred?.label ?? label, inferred?.type ?? "drop");
                if (inferred?.prereqIds?.length) {
                    out[out.length - 1] = {
                        ...out[out.length - 1],
                        prereqIds: inferred.prereqIds,
                    };
                }
            }

            // Optional: legacy aliases (only if older code ever emitted these)
            // - nodeNameRaw includes "(Caches)" -> tokenizes to "<node>-caches"
            // - some layers might have emitted mission-reward or rotation-a style
            //
            // If you want zero-risk compatibility, keep these aliases.
            const legacyBaseId1 = dataId(["mission-reward", String(planetName), String(nodeNameRaw)]);
            if (legacyBaseId1 !== baseId) {
                pushUnique(out, seen, legacyBaseId1, baseInferred?.label ?? baseLabel, baseInferred?.type ?? "drop");
                if (baseInferred?.prereqIds?.length) {
                    out[out.length - 1] = {
                        ...out[out.length - 1],
                        prereqIds: baseInferred.prereqIds,
                    };
                }
            }

            const legacyBaseId2 = dataId(["missionreward", String(planetName), String(nodeNameRaw)]);
            if (legacyBaseId2 !== baseId) {
                pushUnique(out, seen, legacyBaseId2, baseInferred?.label ?? baseLabel, baseInferred?.type ?? "drop");
                if (baseInferred?.prereqIds?.length) {
                    out[out.length - 1] = {
                        ...out[out.length - 1],
                        prereqIds: baseInferred.prereqIds,
                    };
                }
            }

            if (hasA) {
                const legacyRotA1 = dataId(["mission-reward", planetName, nodeNameRaw, "rotationa"]);
                if (legacyRotA1 !== dataId(["missionreward", planetName, nodeNameBase, "rotationa"])) {
                    const label = `${baseLabel} (Rotation A)`;
                    const inferred = inferSourceMetadataFromLabel(label);
                    pushUnique(out, seen, legacyRotA1, inferred?.label ?? label, inferred?.type ?? "drop");
                    if (inferred?.prereqIds?.length) {
                        out[out.length - 1] = {
                            ...out[out.length - 1],
                            prereqIds: inferred.prereqIds,
                        };
                    }
                }
            }
            if (hasB) {
                const legacyRotB1 = dataId(["mission-reward", planetName, nodeNameRaw, "rotationb"]);
                if (legacyRotB1 !== dataId(["missionreward", planetName, nodeNameBase, "rotationb"])) {
                    const label = `${baseLabel} (Rotation B)`;
                    const inferred = inferSourceMetadataFromLabel(label);
                    pushUnique(out, seen, legacyRotB1, inferred?.label ?? label, inferred?.type ?? "drop");
                    if (inferred?.prereqIds?.length) {
                        out[out.length - 1] = {
                            ...out[out.length - 1],
                            prereqIds: inferred.prereqIds,
                        };
                    }
                }
            }
            if (hasC) {
                const legacyRotC1 = dataId(["mission-reward", planetName, nodeNameRaw, "rotationc"]);
                if (legacyRotC1 !== dataId(["missionreward", planetName, nodeNameBase, "rotationc"])) {
                    const label = `${baseLabel} (Rotation C)`;
                    const inferred = inferSourceMetadataFromLabel(label);
                    pushUnique(out, seen, legacyRotC1, inferred?.label ?? label, inferred?.type ?? "drop");
                    if (inferred?.prereqIds?.length) {
                        out[out.length - 1] = {
                            ...out[out.length - 1],
                            prereqIds: inferred.prereqIds,
                        };
                    }
                }
            }
        }
    }

    out.sort((a, b) => a.label.localeCompare(b.label));
    return out;
}

/**
 * Cache sources inferred from warframe-items/raw/All.json drop location strings.
 * Emits:
 *   data:caches/<planet>/<node>
 */
function buildWfItemsCacheSources(): RawSource[] {
    const out: RawSource[] = [];
    const seen = new Set<string>();

    const locs = new Set<string>();

    const stack: unknown[] = [WARFRAME_ITEMS_ALL as unknown];
    while (stack.length > 0) {
        const cur = stack.pop();
        if (!cur) continue;

        if (Array.isArray(cur)) {
            for (const v of cur) stack.push(v);
            continue;
        }
        if (typeof cur !== "object") continue;

        const obj = cur as Record<string, unknown>;
        for (const v of Object.values(obj)) {
            if (v && (typeof v === "object" || Array.isArray(v))) stack.push(v);
        }

        const drops = (obj as any).drops;
        if (!Array.isArray(drops)) continue;

        for (const d of drops) {
            const loc = safeString((d as any)?.location);
            if (!loc) continue;
            if (!/\(\s*Caches\s*\)/i.test(loc)) continue;
            locs.add(loc);
        }
    }

    for (const raw of Array.from(locs.values())) {
        const head = safeString(String(raw).split("(")[0] ?? "");
        if (!head) continue;

        const headNoComma = safeString(String(head).split(",")[0] ?? "");
        if (!headNoComma) continue;

        const parts = headNoComma
            .split("/")
            .map((x) => safeString(x))
            .filter(Boolean);

        if (parts.length < 2) continue;

        const planet = parts[0];
        const node = parts.slice(1).join("/");
        if (!planet || !node) continue;

        const id = dataId(["caches", planet, node]);
        const label = `Caches: ${planet} / ${node}`;
        const inferred = inferSourceMetadataFromLabel(label);
        pushUnique(out, seen, id, inferred?.label ?? label, inferred?.type ?? "drop");
        if (inferred?.prereqIds?.length) {
            out[out.length - 1] = {
                ...out[out.length - 1],
                prereqIds: inferred.prereqIds,
            };
        }
    }

    out.sort((a, b) => a.label.localeCompare(b.label));
    return out;
}

/**
 * warframe-items/raw All.json derived wfitems:loc sources.
 * These must exist because acquisitionFromWarframeItems.ts and acquisitionFromWfItemsDrops.ts emit:
 *   data:wfitems:loc:<toToken(location)>
 */
function buildWfItemsLocSources(): RawSource[] {
    const out: RawSource[] = [];
    const seen = new Set<string>(CURATED_SOURCES.map((src) => normalizeSourceId(src.id)));

    const locs = new Set<string>();

    const stack: unknown[] = [WARFRAME_ITEMS_ALL as unknown];
    while (stack.length > 0) {
        const cur = stack.pop();

        if (!cur) continue;

        if (Array.isArray(cur)) {
            for (const v of cur) stack.push(v);
            continue;
        }

        if (typeof cur !== "object") continue;

        const obj = cur as Record<string, unknown>;

        for (const v of Object.values(obj)) {
            if (v && (typeof v === "object" || Array.isArray(v))) stack.push(v);
        }

        const candidates: unknown[] = [];

        if (Array.isArray(obj.drops)) candidates.push(...(obj.drops as unknown[]));
        if (Array.isArray(obj.drop)) candidates.push(...(obj.drop as unknown[]));
        if (Array.isArray(obj.locations)) candidates.push(...(obj.locations as unknown[]));
        if (Array.isArray(obj.location)) candidates.push(...(obj.location as unknown[]));

        for (const c of candidates) {
            if (!c) continue;

            if (typeof c === "string") {
                const s = safeString(c);
                if (s) locs.add(s);
                continue;
            }

            if (typeof c === "object") {
                const co = c as Record<string, unknown>;
                const name = safeString(co.location) ?? safeString(co.name) ?? safeString(co.place) ?? safeString(co.source);
                if (name) locs.add(name);

                for (const v of Object.values(co)) {
                    if (typeof v === "string") {
                        const s = safeString(v);
                        if (s && s.length <= 120) locs.add(s);
                    }
                }
            }
        }
    }

    for (const loc of Array.from(locs.values())) {
        const { canonicalSourceId, canonicalLabel, legacySourceId } = canonicalizeWfItemsLocation(loc);
        const canonicalCurated = CURATED_SOURCE_BY_ID.get(normalizeSourceId(canonicalSourceId));
        const canonicalType = canonicalCurated?.type ?? "drop";

        const isRelicCanonical = canonicalSourceId.startsWith("data:relic/");
        const isRawSyndicateVendorCanonical = canonicalSourceId.startsWith("data:vendor/syndicate/");

        // For relics, canonical ids already come from relics.json (buildDropDataSupplementSources),
        // so we only keep the legacy wfitems alias to avoid duplicate SourceIds.
        if (!isRelicCanonical && !isRawSyndicateVendorCanonical) {
            const canonicalMeta = inferSourceMetadataFromLabel(canonicalLabel);
            pushUnique(
                out,
                seen,
                canonicalSourceId,
                canonicalMeta?.label ?? canonicalLabel,
                canonicalMeta?.type ?? canonicalType,
            );
            const canonicalPrereqs = canonicalMeta?.prereqIds ?? canonicalCurated?.prereqIds;
            if (canonicalPrereqs?.length) {
                out[out.length - 1] = {
                    ...out[out.length - 1],
                    prereqIds: canonicalPrereqs,
                };
            }
        }

        if (legacySourceId !== canonicalSourceId) {
            const legacyLabel = `WFItems Location (Legacy): ${loc}`;
            const legacyMeta = inferSourceMetadataFromLabel(legacyLabel);
            const canonicalMeta = inferSourceMetadataFromLabel(canonicalLabel);
            const inheritedPrereqs =
                legacyMeta?.prereqIds ??
                canonicalMeta?.prereqIds ??
                canonicalCurated?.prereqIds;
            const inheritedType =
                legacyMeta?.type ??
                canonicalMeta?.type ??
                canonicalType;
            pushUnique(out, seen, legacySourceId, legacyMeta?.label ?? legacyLabel, inheritedType);
            if (inheritedPrereqs?.length) {
                out[out.length - 1] = {
                    ...out[out.length - 1],
                    prereqIds: inheritedPrereqs,
                };
            }
        }
    }

    out.sort((a, b) => a.label.localeCompare(b.label));
    return out;
}

/**
 * Additional data:* sources used by drop-data acquisition layers.
 */
function buildDropDataSupplementSources(): RawSource[] {
    const out: RawSource[] = [];
    const seen = new Set<string>();

    // ---- Relics ----
    if (Array.isArray(relicsJson)) {
        for (const r of relicsJson as Array<{ tier?: string; relicName?: string }>) {
            const tier = safeString((r as any)?.tier) ?? "relic";
            const relicName = safeString((r as any)?.relicName) ?? "unknown";
            const id = dataId(["relic", tier, relicName]);
            const label = `Relic: ${tier} ${relicName}`;
            pushUnique(out, seen, id, label, "drop");
        }
    }

    // ---- Blueprint locations / enemy blueprint tables -> enemy-drop ----
    const blArr = (blueprintLocationsJson as any)?.blueprintLocations ?? (blueprintLocationsJson as any);
    if (Array.isArray(blArr)) {
        for (const row of blArr) {
            const enemies = Array.isArray((row as any)?.enemies) ? (row as any).enemies : [];
            for (const e of enemies) {
                const enemyName = safeString((e as any)?.enemyName);
                if (!enemyName) continue;
                const id = dataId(["enemy-drop", enemyName]);
                const label = `Enemy Drop: ${enemyName}`;
                const inferred = inferSourceMetadataFromLabel(label);
                pushUnique(out, seen, id, inferred?.label ?? label, inferred?.type ?? "drop");
                if (inferred?.prereqIds?.length) {
                    out[out.length - 1] = {
                        ...out[out.length - 1],
                        prereqIds: inferred.prereqIds,
                    };
                }
            }
        }
    }

    const ebtArr = (enemyBlueprintTablesJson as any)?.enemyBlueprintTables ?? (enemyBlueprintTablesJson as any);
    if (Array.isArray(ebtArr)) {
        for (const row of ebtArr) {
            const enemyName = safeString((row as any)?.enemyName);
            if (!enemyName) continue;
            const id = dataId(["enemy-drop", enemyName]);
            const label = `Enemy Drop: ${enemyName}`;
            const inferred = inferSourceMetadataFromLabel(label);
            pushUnique(out, seen, id, inferred?.label ?? label, inferred?.type ?? "drop");
            if (inferred?.prereqIds?.length) {
                out[out.length - 1] = {
                    ...out[out.length - 1],
                    prereqIds: inferred.prereqIds,
                };
            }
        }
    }

    // ---- Mod locations / enemy mod tables -> enemy-mod ----
    const mlArr = (modLocationsJson as any)?.modLocations ?? (modLocationsJson as any);
    if (Array.isArray(mlArr)) {
        for (const row of mlArr) {
            const enemies = Array.isArray((row as any)?.enemies) ? (row as any).enemies : [];
            for (const e of enemies) {
                const enemyName = safeString((e as any)?.enemyName);
                if (!enemyName) continue;
                const id = dataId(["enemy-mod", enemyName]);
                const label = `Enemy Mod Drop: ${enemyName}`;
                const inferred = inferSourceMetadataFromLabel(label);
                pushUnique(out, seen, id, inferred?.label ?? label, inferred?.type ?? "drop");
                if (inferred?.prereqIds?.length) {
                    out[out.length - 1] = {
                        ...out[out.length - 1],
                        prereqIds: inferred.prereqIds,
                    };
                }
            }
        }
    }

    const emtArr =
        (enemyModTablesJson as any)?.enemyModTables ??
        (enemyModTablesJson as any)?.modLocations ??
        (enemyModTablesJson as any);

    if (Array.isArray(emtArr)) {
        for (const row of emtArr) {
            const enemyName = safeString((row as any)?.enemyName);
            if (!enemyName) continue;
            const id = dataId(["enemy-mod", enemyName]);
            const label = `Enemy Mod Drop: ${enemyName}`;
            const inferred = inferSourceMetadataFromLabel(label);
            pushUnique(out, seen, id, inferred?.label ?? label, inferred?.type ?? "drop");
            if (inferred?.prereqIds?.length) {
                out[out.length - 1] = {
                    ...out[out.length - 1],
                    prereqIds: inferred.prereqIds,
                };
            }
        }
    }

    // ---- Transient rewards ----
    const trArr = (transientRewardsJson as any)?.transientRewards ?? (transientRewardsJson as any);
    if (Array.isArray(trArr)) {
        for (const row of trArr) {
            const objectiveName = safeString((row as any)?.objectiveName);
            if (!objectiveName) continue;
            const id = dataId(["transient", objectiveName]);
            const label = `Transient Reward: ${objectiveName}`;
            const inferred = inferSourceMetadataFromLabel(label);
            pushUnique(out, seen, id, inferred?.label ?? label, inferred?.type ?? "drop");
            if (inferred?.prereqIds?.length) {
                out[out.length - 1] = {
                    ...out[out.length - 1],
                    prereqIds: inferred.prereqIds,
                };
            }
        }
    }

    // ---- Sortie ----
    const srArr = (sortieRewardsJson as any)?.sortieRewards ?? (sortieRewardsJson as any);
    if (Array.isArray(srArr) && srArr.length > 0) {
        const label = "Sortie Rewards";
        const inferred = inferSourceMetadataFromLabel(label);
        pushUnique(out, seen, dataId(["sortie"]), inferred?.label ?? label, inferred?.type ?? "drop");
        if (inferred?.prereqIds?.length) {
            out[out.length - 1] = {
                ...out[out.length - 1],
                prereqIds: inferred.prereqIds,
            };
        }
    }

    // ---- Key rewards ----
    const krArr = (keyRewardsJson as any)?.keyRewards ?? (keyRewardsJson as any);
    if (Array.isArray(krArr)) {
        for (const row of krArr) {
            const keyName = safeString((row as any)?.keyName);
            if (!keyName) continue;
            const id = dataId(["key", keyName]);
            const label = `Key Rewards: ${keyName}`;
            const inferred = inferSourceMetadataFromLabel(label);
            pushUnique(out, seen, id, inferred?.label ?? label, inferred?.type ?? "drop");
            if (inferred?.prereqIds?.length) {
                out[out.length - 1] = {
                    ...out[out.length - 1],
                    prereqIds: inferred.prereqIds,
                };
            }
        }
    }

    // ---- Bounties (note: source ids use bountyLevel) ----
    const cbArr = (cetusBountyRewardsJson as any)?.cetusBountyRewards ?? (cetusBountyRewardsJson as any);
    if (Array.isArray(cbArr)) {
        for (const row of cbArr) {
            const bountyLevel = safeString((row as any)?.bountyLevel);
            if (!bountyLevel) continue;
            const id = dataId(["bounty", "cetus", bountyLevel]);
            const label = `Cetus Bounty: ${bountyLevel}`;
            const inferred = inferSourceMetadataFromLabel(label);
            pushUnique(out, seen, id, inferred?.label ?? label, inferred?.type ?? "drop");
            if (inferred?.prereqIds?.length) {
                out[out.length - 1] = {
                    ...out[out.length - 1],
                    prereqIds: inferred.prereqIds,
                };
            }
        }
    }

    const sbArr = (solarisBountyRewardsJson as any)?.solarisBountyRewards ?? (solarisBountyRewardsJson as any);
    if (Array.isArray(sbArr)) {
        for (const row of sbArr) {
            const bountyLevel = safeString((row as any)?.bountyLevel);
            if (!bountyLevel) continue;
            const id = dataId(["bounty", "solaris", bountyLevel]);
            const label = `Solaris Bounty: ${bountyLevel}`;
            const inferred = inferSourceMetadataFromLabel(label);
            pushUnique(out, seen, id, inferred?.label ?? label, inferred?.type ?? "drop");
            if (inferred?.prereqIds?.length) {
                out[out.length - 1] = {
                    ...out[out.length - 1],
                    prereqIds: inferred.prereqIds,
                };
            }
        }
    }

    const drArr = (deimosRewardsJson as any)?.deimosRewards ?? (deimosRewardsJson as any);
    if (Array.isArray(drArr)) {
        for (const row of drArr) {
            const bountyLevel = safeString((row as any)?.bountyLevel);
            if (!bountyLevel) continue;
            const id = dataId(["bounty", "deimos", bountyLevel]);
            const label = `Deimos Bounty: ${bountyLevel}`;
            const inferred = inferSourceMetadataFromLabel(label);
            pushUnique(out, seen, id, inferred?.label ?? label, inferred?.type ?? "drop");
            if (inferred?.prereqIds?.length) {
                out[out.length - 1] = {
                    ...out[out.length - 1],
                    prereqIds: inferred.prereqIds,
                };
            }
        }
    }

    const elArr = (entratiLabRewardsJson as any)?.entratiLabRewards ?? (entratiLabRewardsJson as any);
    if (Array.isArray(elArr)) {
        for (const row of elArr) {
            const bountyLevel = safeString((row as any)?.bountyLevel);
            if (!bountyLevel) continue;
            const id = dataId(["bounty", "entrati-lab", bountyLevel]);
            const label = `Entrati Lab Reward: ${bountyLevel}`;
            pushUnique(out, seen, id, label, "drop");
        }
    }

    const hxArr = (hexRewardsJson as any)?.hexRewards ?? (hexRewardsJson as any);
    if (Array.isArray(hxArr)) {
        for (const row of hxArr) {
            const bountyLevel = safeString((row as any)?.bountyLevel);
            if (!bountyLevel) continue;
            const id = dataId(["bounty", "hex", bountyLevel]);
            const label = `Hex Reward: ${bountyLevel}`;
            const inferred = inferSourceMetadataFromLabel(label);
            pushUnique(out, seen, id, inferred?.label ?? label, inferred?.type ?? "drop");
            if (inferred?.prereqIds?.length) {
                out[out.length - 1] = {
                    ...out[out.length - 1],
                    prereqIds: inferred.prereqIds,
                };
            }
        }
    }

    const zrArr = (zarimanRewardsJson as any)?.zarimanRewards ?? (zarimanRewardsJson as any);
    if (Array.isArray(zrArr)) {
        for (const row of zrArr) {
            const bountyLevel = safeString((row as any)?.bountyLevel);
            if (!bountyLevel) continue;
            const id = dataId(["bounty", "zariman", bountyLevel]);
            const label = `Zariman Bounty: ${bountyLevel}`;
            pushUnique(out, seen, id, label, "drop");
        }
    }

    // ---- Syndicate vendors ----
    const synRoot = (syndicatesJson as any)?.syndicates ?? (syndicatesJson as any);
    if (synRoot && typeof synRoot === "object" && !Array.isArray(synRoot)) {
        for (const synName of Object.keys(synRoot as Record<string, any>)) {
            const id = dataId(["vendor", "syndicate", synName]);
            const override = getSyndicateVendorOverride(synName);
            pushUnique(out, seen, id, override?.label ?? `Syndicate Vendor: ${synName}`, "vendor");
            if (override?.prereqIds?.length) {
                out[out.length - 1] = {
                    ...out[out.length - 1],
                    prereqIds: override.prereqIds,
                };
            }
        }
    }

    // ---- Misc enemy item drops (data:*) ----
    const miArr = (miscItemsJson as any)?.miscItems ?? (miscItemsJson as any);
    if (Array.isArray(miArr)) {
        for (const row of miArr) {
            const enemyName = safeString((row as any)?.enemyName);
            if (!enemyName) continue;
            const id = dataId(["enemy-item", enemyName]);
            const label = `Enemy Item Drop: ${enemyName}`;
            const inferred = inferSourceMetadataFromLabel(label);
            pushUnique(out, seen, id, inferred?.label ?? label, inferred?.type ?? "drop");
            if (inferred?.prereqIds?.length) {
                out[out.length - 1] = {
                    ...out[out.length - 1],
                    prereqIds: inferred.prereqIds,
                };
            }
        }
    }

    // ---- Resource by avatar (data:*) ----
    const rbaArr = (resourceByAvatarJson as any)?.resourceByAvatar ?? (resourceByAvatarJson as any);
    if (Array.isArray(rbaArr)) {
        for (const row of rbaArr) {
            const srcName = safeString((row as any)?.source);
            if (!srcName) continue;
            const id = dataId(["resource-by-avatar", srcName]);
            const label = `Resource Drop (Avatar): ${srcName}`;
            const inferred = inferSourceMetadataFromLabel(label);
            pushUnique(out, seen, id, inferred?.label ?? label, inferred?.type ?? "drop");
            if (inferred?.prereqIds?.length) {
                out[out.length - 1] = {
                    ...out[out.length - 1],
                    prereqIds: inferred.prereqIds,
                };
            }
        }
    }

    // ---- Additional item by avatar (data:*) ----
    const aibaArr = (additionalItemByAvatarJson as any)?.additionalItemByAvatar ?? (additionalItemByAvatarJson as any);
    if (Array.isArray(aibaArr)) {
        for (const row of aibaArr) {
            const srcName = safeString((row as any)?.source);
            if (!srcName) continue;
            const id = dataId(["additional-item-by-avatar", srcName]);
            const label = `Additional Drop (Avatar): ${srcName}`;
            const inferred = inferSourceMetadataFromLabel(label);
            pushUnique(out, seen, id, inferred?.label ?? label, inferred?.type ?? "drop");
            if (inferred?.prereqIds?.length) {
                out[out.length - 1] = {
                    ...out[out.length - 1],
                    prereqIds: inferred.prereqIds,
                };
            }
        }
    }

    out.sort((a, b) => a.label.localeCompare(b.label));
    return out;
}

/**
 * Runtime src:* sources emitted by acquisitionFromDropData.ts (legacy / optional).
 * Keep only the patterns you actually emit somewhere in src/catalog/items.
 */
function buildDropDataRuntimeSrcSources(): RawSource[] {
    const out: RawSource[] = [];
    const seen = new Set<string>();

    // src:enemyitem/<enemyName>
    const miArr = (miscItemsJson as any)?.miscItems ?? (miscItemsJson as any);
    if (Array.isArray(miArr)) {
        for (const row of miArr) {
            const enemyName = safeString((row as any)?.enemyName);
            if (!enemyName) continue;

            const id = srcId(["enemyitem", enemyName]);
            const label = `Enemy: ${enemyName}`;
            const inferred = inferSourceMetadataFromLabel(label);
            pushUnique(out, seen, id, inferred?.label ?? label, inferred?.type ?? "drop");
            if (inferred?.prereqIds?.length) {
                out[out.length - 1] = {
                    ...out[out.length - 1],
                    prereqIds: inferred.prereqIds,
                };
            }
        }
    }

    // src:resourcebyavatar/<source>
    const rbaArr = (resourceByAvatarJson as any)?.resourceByAvatar ?? (resourceByAvatarJson as any);
    if (Array.isArray(rbaArr)) {
        for (const row of rbaArr) {
            const srcName = safeString((row as any)?.source);
            if (!srcName) continue;

            const id = srcId(["resourcebyavatar", srcName]);
            const label = `Avatar Drop: ${srcName}`;
            const inferred = inferSourceMetadataFromLabel(label);
            pushUnique(out, seen, id, inferred?.label ?? label, inferred?.type ?? "drop");
            if (inferred?.prereqIds?.length) {
                out[out.length - 1] = {
                    ...out[out.length - 1],
                    prereqIds: inferred.prereqIds,
                };
            }
        }
    }

    out.sort((a, b) => a.label.localeCompare(b.label));
    return out;
}

// Exported catalog lists
function supplementSourcePrerequisites(source: RawSource): RawSource {
    const label = source.label;
    const additions: string[] = [];
    let prereqIds = [...(source.prereqIds ?? [])];

    if (/^Transient Reward:\s*Faceoff:/i.test(label)) additions.push(PR.THE_HEX);
    if (/Kuva (?:Flood|Siphon)/i.test(label)) {
        prereqIds = [PR.WAR_WITHIN, PR.MR_5];
    }
    if (/Nightmare Granum Void/i.test(label)) additions.push(PR.DEADLOCK_PROTOCOL);
    if (/Arbitration Shield Drone/i.test(label)) additions.push(PR.ACTIVITY_ARBITRATIONS);
    if (/Void Storm\s*\(Veil Proxima\)/i.test(label)) {
        prereqIds = [PR.SYSTEM_PROXIMA_VEIL_ACCESS];
    }

    if (/Duviri/i.test(label) && /(?:Steel Path|\bHard\b)/i.test(label)) {
        const replacedDuviriGates = new Set<string>([
            PR.DUVIRI_PARADOX,
            PR.ACTIVITY_STEEL_PATH,
            PR.ACTIVITY_CIRCUIT_STEEL_PATH,
        ]);
        prereqIds = prereqIds.filter((id) => !replacedDuviriGates.has(id));
        additions.push(PR.ACTIVITY_DUVIRI_STEEL_PATH);
    } else if (/^Transient Reward:\s*Duviri Circuit$/i.test(label)
        || /^Transient Reward:\s*Duviri Full Experience$/i.test(label)
        || /Duviri Murmur Invasion Rewards/i.test(label)) {
        additions.push(PR.DUVIRI_PARADOX);
    }

    if (/\bSteel Path\b/i.test(label) && !/Duviri/i.test(label)) additions.push(PR.ACTIVITY_STEEL_PATH);

    const originalPrereqs = source.prereqIds ?? [];
    if (additions.length === 0
        && prereqIds.length === originalPrereqs.length
        && prereqIds.every((id, index) => id === originalPrereqs[index])) return source;
    return {
        ...source,
        prereqIds: Array.from(new Set([...prereqIds, ...additions])),
    };
}

export const SOURCE_CATALOG: RawSource[] = [
    ...(CURATED_SOURCES as unknown as RawSource[]),
    ...buildWfcdDropSources(),
    ...buildMissionNodeSources(),
    ...buildMissionDropNodeAliasSources(),
    ...buildMissionRewardSources(),
    ...buildRankedSyndicateSources(),
    ...buildWfItemsCacheSources(),
    ...buildWfItemsLocSources(),
    ...buildDropDataSupplementSources(),
    ...buildDropDataRuntimeSrcSources(),
].map(supplementSourcePrerequisites);

export const SOURCE_INDEX: Record<SourceId, Source> = (() => {
    const index = {} as Record<SourceId, Source>;

    for (const raw of SOURCE_CATALOG) {
        const id = normalizeSourceId(raw.id);

        if (index[id]) {
            throw new Error(`Duplicate SourceId detected: ${id}`);
        }

        index[id] = {
            id,
            label: raw.label,
            type: raw.type ?? "other",
            prereqIds: raw.prereqIds,
        };
    }

    return index;
})();

export const SOURCES: Source[] = Object.values(SOURCE_INDEX);
