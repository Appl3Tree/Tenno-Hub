import { PREREQ_REGISTRY } from "../prereqs/prereqRegistry";
import type { PrereqId } from "../../domain/ids/prereqIds";
import { PR } from "../../domain/ids/prereqIds";

export type QuestClassification = "main" | "side" | "warframe";

export interface QuestGuideEntry {
    /** Stable completion/progression identity shared with the prerequisite tracker. */
    prereqId: PrereqId;
    classification: QuestClassification;
    /** Optional Wiki story-arc / nested-quest label. This is grouping, not a quest. */
    subgroup?: string;
    summary: string;
}

export interface QuestGuideGroup {
    id: QuestClassification;
    title: string;
    entries: QuestGuideEntry[];
}

interface QuestPresentation {
    classification: QuestClassification;
    order: number;
    subgroup?: string;
    summary: string;
}

/**
 * Presentation-only metadata keyed to canonical quest IDs. Names, unlocks,
 * completion state, and dependencies come from PREREQ_REGISTRY below. This
 * metadata controls Handbook grouping and concise explanatory copy.
 */
const QUEST_PRESENTATION: Partial<Record<PrereqId, QuestPresentation>> = {
    [PR.AWAKENING]: { classification: "main", order: 10, subgroup: "Arc 1: Tenno Awakening", summary: "Opening quest and movement/combat tutorial." },
    [PR.VORS_PRIZE]: { classification: "main", order: 20, subgroup: "Arc 1: Tenno Awakening", summary: "Tutorial quest that restores core Orbiter functions; Junctions open the remaining planets." },
    [PR.THE_TEACHER]: { classification: "main", order: 30, subgroup: "Arc 1: Tenno Awakening", summary: "Teshin introduces the player to modding." },
    [PR.VOX_SOLARIS]: { classification: "main", order: 40, subgroup: "Arc 1: Tenno Awakening", summary: "Fortuna and Solaris United introduction on Venus." },
    [PR.ONCE_AWAKE]: { classification: "main", order: 50, subgroup: "Arc 1: Tenno Awakening", summary: "Early quest that introduces the Infested faction." },
    [PR.HEART_OF_DEIMOS]: { classification: "main", order: 60, subgroup: "Arc 1: Tenno Awakening", summary: "Opens the Necralisk and Cambion Drift progression on Deimos." },
    [PR.ARCHWING]: { classification: "main", order: 70, subgroup: "Arc 1: Tenno Awakening", summary: "Awards Archwing equipment and introduces Archwing missions." },

    [PR.NATAH]: { classification: "main", order: 110, subgroup: "Arc 2: This Is What You Are", summary: "Investigates the Lotus and the Sentients." },
    [PR.SECOND_DREAM]: { classification: "main", order: 120, subgroup: "Arc 2: This Is What You Are", summary: "Reveals the Tenno's nature and unlocks Operator and Focus access." },
    [PR.WAR_WITHIN]: { classification: "main", order: 130, subgroup: "Arc 2: This Is What You Are", summary: "Continues the Operator story and unlocks additional systems and locations." },
    [PR.RISING_TIDE]: { classification: "main", order: 140, subgroup: "Arc 2: This Is What You Are", summary: "Quest to construct a personal Railjack." },
    [PR.CHAINS_HARROW]: { classification: "main", order: 150, subgroup: "Arc 2: This Is What You Are", summary: "Harrow's story quest, begun through the Quills on Cetus." },
    [PR.APOSTASY]: { classification: "main", order: 160, subgroup: "Arc 2: This Is What You Are", summary: "Short story prologue that follows the Operator's personal quarters becoming available." },
    [PR.SACRIFICE]: { classification: "main", order: 170, subgroup: "Arc 2: This Is What You Are", summary: "Story quest that awards Excalibur Umbra and the Skiajati." },

    [PR.CHIMERA_PROLOGUE]: { classification: "main", order: 210, subgroup: "Arc 3: The New War · Prelude to War", summary: "First Prelude to War chapter; unlocks the Ropalolyst encounter." },
    [PR.ERRA]: { classification: "main", order: 220, subgroup: "Arc 3: The New War · Prelude to War", summary: "Second Prelude to War chapter." },
    [PR.PRELUDE_TO_WAR]: { classification: "main", order: 230, subgroup: "Arc 3: The New War · Prelude to War", summary: "The Maker, the third Prelude to War chapter." },
    [PR.NEW_WAR]: { classification: "main", order: 240, subgroup: "Arc 3: The New War", summary: "Feature-length story quest. A loaner Necramech is supplied; owning one is not a prerequisite." },
    [PR.DUVIRI_PARADOX]: { classification: "main", order: 250, subgroup: "Arc 3: The New War", summary: "Duviri story and alternate gameplay path; completion is required before The Hex." },

    [PR.WHISPERS_WALL]: { classification: "main", order: 310, subgroup: "Arc 4: Void War Saga · Kalymos Sequence", summary: "Opens the Sanctum Anatomica and Cavia progression." },
    [PR.THE_LOTUS_EATERS]: { classification: "main", order: 320, subgroup: "Arc 4: Void War Saga · Kalymos Sequence", summary: "Short prologue that follows Whispers in the Walls." },
    [PR.THE_HEX]: { classification: "main", order: 330, subgroup: "Arc 4: Void War Saga · Kalymos Sequence", summary: "Opens the Höllvania 1999 hub and The Hex progression." },
    [PR.THE_HEX_FINALE]: { classification: "main", order: 340, subgroup: "Arc 4: Void War Saga · Kalymos Sequence", summary: "The Hex epilogue, unlocked through KIM relationships and syndicate progression." },
    [PR.THE_OLD_PEACE]: { classification: "main", order: 350, subgroup: "Arc 4: Void War Saga · Kalymos Sequence", summary: "Continues the Kalymos Sequence and opens its associated locations and activities." },
    [PR.TAU_PROLOGUE_LUA]: { classification: "main", order: 360, subgroup: "Arc 4: Void War Saga · Prologue to Tau", summary: "First released, permanent, replayable Prologue to Tau chapter." },
    [PR.TAU_PROLOGUE_VESSEL]: { classification: "main", order: 370, subgroup: "Arc 4: Void War Saga · Prologue to Tau", summary: "Second released, permanent, replayable Prologue to Tau chapter; follows Lua." },
    [PR.JADE_SHADOWS]: { classification: "main", order: 380, subgroup: "Arc 4: Void War Saga · Jade Shadows Arc", summary: "Stalker story quest that awards Jade's main blueprint." },
    [PR.JADE_SHADOWS_CONSTELLATIONS]: { classification: "main", order: 390, subgroup: "Arc 4: Void War Saga · Jade Shadows Arc", summary: "Update 43 quest that opens Uranus Proxima, two Railjack missions, and Pontis Tower." },
    [PR.ANGELS_ZARIMAN]: { classification: "main", order: 400, subgroup: "Arc 4: Void War Saga · One-Offs", summary: "Post-New War quest that opens Zariman missions, the Chrysalith, and Holdfasts." },

    [PR.HOWL_KUBROW]: { classification: "side", order: 10, summary: "Unlocks Kubrow incubation and breeding." },
    [PR.STOLEN_DREAMS]: { classification: "side", order: 20, summary: "Maroo quest that opens the weekly Ayatan Treasure Hunt." },
    [PR.VEILBREAKER]: { classification: "side", order: 30, summary: "Introduces Kahl-175 and his post-New War missions." },
    [PR.PATIENT_ZERO]: { classification: "side", order: 40, summary: "Opens the Mutalist Alad V assassination encounter." },
    [PR.A_MAN_FEW_WORDS]: { classification: "side", order: 50, summary: "Darvo and Clem quest that unlocks the weekly Help Clem mission." },
    [PR.SAYA_VIGIL]: { classification: "side", order: 60, summary: "Cetus quest featuring the Ostrons and Gara." },

    [PR.DEADLOCK_PROTOCOL]: { classification: "warframe", order: 10, summary: "Protea quest involving Parvos Granum and the Granum Void." },
    [PR.CALL_TEMPESTARII]: { classification: "warframe", order: 20, summary: "Sevagoth quest that continues the Railjack story." },
    [PR.NEW_STRANGE]: { classification: "warframe", order: 30, summary: "Cephalon Simaris quest that awards Chroma blueprints." },
    [PR.GLAST_GAMBIT]: { classification: "warframe", order: 40, summary: "Nidus story and blueprint quest." },
    [PR.OCTAVIA_ANTHEM]: { classification: "warframe", order: 50, summary: "Octavia story and blueprint quest." },
    [PR.SANDS_INAROS]: { classification: "warframe", order: 60, summary: "Inaros story and blueprint quest." },
    [PR.HIDDEN_MESSAGES]: { classification: "warframe", order: 70, summary: "Mirage story and blueprint quest." },
    [PR.MASK_REVENANT]: { classification: "warframe", order: 80, summary: "Revenant story and blueprint quest." },
    [PR.SILVER_GROVE]: { classification: "warframe", order: 90, summary: "Titania story and blueprint quest." },
    [PR.WAVERIDER]: { classification: "warframe", order: 100, summary: "Yareli story and blueprint quest." },
    [PR.LIMBO_THEOREM]: { classification: "warframe", order: 110, summary: "Limbo story and blueprint quest." },
    [PR.JORDAS_PRECEPT]: { classification: "warframe", order: 120, summary: "Atlas story and blueprint quest." },
};

const GROUPS: Array<{ id: QuestClassification; title: string }> = [
    { id: "main", title: "Main Quests" },
    { id: "side", title: "Side Quests" },
    { id: "warframe", title: "Warframe Quests" },
];

const registryQuestDefinitions = PREREQ_REGISTRY.filter((definition) => definition.id.startsWith("quest_"));

/** Every registered quest is listed automatically; only its Handbook presentation is configured above. */
export const QUEST_GUIDE_ENTRIES: QuestGuideEntry[] = registryQuestDefinitions
    .map((definition, registryOrder) => {
        const presentation = QUEST_PRESENTATION[definition.id];
        return {
            prereqId: definition.id,
            classification: presentation?.classification ?? (definition.category === "Quests" ? "main" : "side"),
            subgroup: presentation?.subgroup,
            summary: presentation?.summary ?? definition.description,
            presentationOrder: presentation?.order ?? 10_000 + registryOrder,
        };
    })
    .sort((a, b) => a.classification.localeCompare(b.classification) || a.presentationOrder - b.presentationOrder)
    .map((entry) => ({
        prereqId: entry.prereqId,
        classification: entry.classification,
        subgroup: entry.subgroup,
        summary: entry.summary,
    }));

export const QUEST_GUIDE_GROUPS: QuestGuideGroup[] = GROUPS.map((group) => ({
    ...group,
    entries: QUEST_GUIDE_ENTRIES.filter((entry) => entry.classification === group.id),
}));
