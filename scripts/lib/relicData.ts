export interface RelicMissionRewardRow {
    relicKey: string;
    relicDisplay: string;
    pathLabel: string;
    rotation: string;
    chance: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Normalize a mission reward name such as `Lith L8 Relic (Radiant)` to `lith l8`. */
export function relicKeyFromRewardName(itemName: string): string | null {
    const normalized = itemName.replace(/\s+/g, " ").trim();
    const match = normalized.match(
        /^([A-Za-z]+)\s+([A-Za-z0-9]+)\s+Relic(?:\s*\((?:Intact|Exceptional|Flawless|Radiant)\))?$/i,
    );
    if (!match) return null;
    return `${match[1]!.toLowerCase()} ${match[2]!.toLowerCase()}`;
}

/**
 * Read both rotational and flat mission reward tables without dropping relic
 * rewards. Relic-looking names and chances fail closed when malformed.
 */
export function collectRelicMissionRewardRows(missionRewards: unknown): RelicMissionRewardRow[] {
    if (!isRecord(missionRewards)) {
        throw new Error("missionRewards must be an object keyed by planet");
    }

    const output: RelicMissionRewardRow[] = [];
    for (const [planet, rawNodes] of Object.entries(missionRewards)) {
        if (!isRecord(rawNodes)) throw new Error(`missionRewards.${planet} must be an object keyed by node`);
        for (const [node, rawInfo] of Object.entries(rawNodes)) {
            if (!isRecord(rawInfo)) throw new Error(`missionRewards.${planet}.${node} must be a node object`);
            const rewards = rawInfo.rewards;
            if (rewards === undefined || rewards === null) continue;

            const addRewardList = (rotation: string, list: unknown): void => {
                if (!Array.isArray(list)) {
                    throw new Error(`missionRewards.${planet}.${node}.${rotation || "rewards"} must be an array`);
                }
                for (let index = 0; index < list.length; index++) {
                    const reward = list[index];
                    if (!isRecord(reward)) {
                        throw new Error(`missionRewards.${planet}.${node}.${rotation || "rewards"}[${index}] must be an object`);
                    }
                    const itemName = typeof reward.itemName === "string" ? reward.itemName.trim() : "";
                    if (!/\bRelic\b/i.test(itemName)) continue;

                    const relicKey = relicKeyFromRewardName(itemName);
                    if (!relicKey) {
                        throw new Error(`missionRewards.${planet}.${node}.${rotation || "rewards"}[${index}] has an unrecognized relic name: ${JSON.stringify(itemName)}`);
                    }
                    if (typeof reward.chance !== "number" || !Number.isFinite(reward.chance) || reward.chance < 0) {
                        throw new Error(`missionRewards.${planet}.${node}.${rotation || "rewards"}[${index}] has an invalid chance for ${JSON.stringify(itemName)}: ${JSON.stringify(reward.chance)}`);
                    }

                    const pathLabel = rotation
                        ? `missionRewards / ${planet} / ${node} / ${rotation}`
                        : `missionRewards / ${planet} / ${node}`;
                    output.push({ relicKey, relicDisplay: itemName, pathLabel, rotation, chance: reward.chance });
                }
            };

            if (Array.isArray(rewards)) {
                addRewardList("", rewards);
            } else if (isRecord(rewards)) {
                for (const [rotation, list] of Object.entries(rewards)) addRewardList(rotation, list);
            } else {
                throw new Error(`missionRewards.${planet}.${node}.rewards must be an object or array`);
            }
        }
    }
    return output;
}

/** Fail when mission rewards point at relic identities absent from relics.json. */
export function validateRelicMissionRewardReferences(missionRewards: unknown, relicCatalog: unknown): void {
    const catalogRows = Array.isArray(relicCatalog)
        ? relicCatalog
        : isRecord(relicCatalog) && Array.isArray(relicCatalog.relics)
            ? relicCatalog.relics
            : null;
    if (!catalogRows) throw new Error("relics.json must contain a relics array");

    const namedIntactKeys = new Set<string>();
    const duplicates = new Set<string>();
    for (const row of catalogRows) {
        if (!isRecord(row) || row.state !== "Intact") continue;
        if (typeof row.tier !== "string" || typeof row.relicName !== "string") continue;
        const key = relicKeyFromRewardName(`${row.tier} ${row.relicName} Relic`);
        if (!key) throw new Error(`relics.json has an unrecognized Intact identity: ${JSON.stringify(`${row.tier} ${row.relicName}`)}`);
        if (namedIntactKeys.has(key)) duplicates.add(key);
        namedIntactKeys.add(key);
    }
    if (duplicates.size > 0) {
        throw new Error(`relics.json has duplicate Intact canonical identities: ${[...duplicates].sort().join(", ")}`);
    }

    const missing = new Map<string, RelicMissionRewardRow>();
    for (const row of collectRelicMissionRewardRows(missionRewards)) {
        if (!namedIntactKeys.has(row.relicKey) && !missing.has(row.relicKey)) missing.set(row.relicKey, row);
    }
    if (missing.size > 0) {
        const examples = [...missing.values()].slice(0, 8)
            .map((row) => `${JSON.stringify(row.relicDisplay)} at ${row.pathLabel}`);
        throw new Error(`missionRewards.json references ${missing.size} relic key(s) missing from the named Intact relics.json catalog: ${examples.join(", ")}${missing.size > examples.length ? ", …" : ""}`);
    }
}
