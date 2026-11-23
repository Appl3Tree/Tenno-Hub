export type SentientIncisionDamageType =
    | "heat"
    | "electricity"
    | "toxin"
    | "corrosive"
    | "magnetic"
    | "viral"
    | "radiation"
    | "gas";

/** Resolve the Wiki's adaptive elemental channel for a faction or active Overguard pool. */
export function getSentientIncisionDamageType(
    targetFaction: string,
    targetHasOverguard = false,
): SentientIncisionDamageType | null {
    if (targetHasOverguard) return "corrosive";

    switch (targetFaction.trim().toLowerCase()) {
        case "infested":
            return "heat";
        case "anarchs":
            return "electricity";
        case "narmer":
            return "toxin";
        case "grineer":
        case "kuva grineer":
        case "zariman":
        case "scaldra":
        case "scaldra (1999)":
            return "corrosive";
        case "corpus":
        case "corpus amalgam":
        case "techrot":
        case "techrot (1999)":
            return "magnetic";
        case "orokin":
            return "viral";
        case "sentient":
        case "the murmur":
            return "radiation";
        case "infested deimos":
        case "deimos infested":
            return "gas";
        default:
            return null;
    }
}
