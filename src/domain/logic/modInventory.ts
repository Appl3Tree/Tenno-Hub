export interface ModRankInventorySnapshot {
    rankCounts: Record<string, number>;
    unknownCount: number;
    totalCount: number;
    highestOwnedRank: number | null;
}

function safeCount(value: unknown): number {
    const count = Number(value);
    return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}

/**
 * Read exact per-rank copies when available. Legacy inventories have only a
 * total and one tracked rank, so preserve their previous meaning by treating
 * every copy as that rank until the user edits the distribution.
 */
export function getModRankInventorySnapshot(
    path: string,
    totalOwned: number,
    maxRank: number,
    legacyHighestRank: number | undefined,
    exactCountsByPath: Record<string, Record<string, number>> | undefined,
    unknownCountsByPath: Record<string, number> | undefined,
): ModRankInventorySnapshot {
    const totalCount = safeCount(totalOwned);
    const boundedMaxRank = Math.max(0, safeCount(maxRank));
    const exact = exactCountsByPath?.[path];
    const hasExact = exactCountsByPath !== undefined && Object.prototype.hasOwnProperty.call(exactCountsByPath, path);
    const rankCounts: Record<string, number> = {};

    if (!hasExact) {
        const requestedRank = Number.isFinite(legacyHighestRank) ? Math.floor(legacyHighestRank ?? 0) : boundedMaxRank;
        const rank = Math.max(0, Math.min(boundedMaxRank, requestedRank));
        if (totalCount > 0) rankCounts[String(rank)] = totalCount;
        return {
            rankCounts,
            unknownCount: 0,
            totalCount,
            highestOwnedRank: totalCount > 0 ? rank : null,
        };
    }

    let overflowCount = 0;
    for (const [rawRank, rawCount] of Object.entries(exact ?? {})) {
        const rank = Number(rawRank);
        const count = safeCount(rawCount);
        if (count <= 0) continue;
        if (!Number.isInteger(rank) || rank < 0 || rank > boundedMaxRank) {
            overflowCount += count;
            continue;
        }
        rankCounts[String(rank)] = (rankCounts[String(rank)] ?? 0) + count;
    }

    let unknownCount = safeCount(unknownCountsByPath?.[path]) + overflowCount;
    const represented = Object.values(rankCounts).reduce((sum, count) => sum + count, 0) + unknownCount;
    if (represented < totalCount) {
        unknownCount += totalCount - represented;
    } else if (represented > totalCount) {
        let excess = represented - totalCount;
        const fromUnknown = Math.min(unknownCount, excess);
        unknownCount -= fromUnknown;
        excess -= fromUnknown;
        for (const rank of Object.keys(rankCounts).map(Number).sort((a, b) => b - a)) {
            if (excess <= 0) break;
            const removed = Math.min(rankCounts[String(rank)] ?? 0, excess);
            rankCounts[String(rank)] = (rankCounts[String(rank)] ?? 0) - removed;
            excess -= removed;
            if (rankCounts[String(rank)] <= 0) delete rankCounts[String(rank)];
        }
    }

    const nonZeroRanks = Object.keys(rankCounts).map(Number).filter((rank) => (rankCounts[String(rank)] ?? 0) > 0);
    const highestOwnedRank = nonZeroRanks.length > 0 ? Math.max(...nonZeroRanks) : null;
    return { rankCounts, unknownCount, totalCount, highestOwnedRank };
}

export function availableModRanks(snapshot: ModRankInventorySnapshot): number[] {
    return Object.keys(snapshot.rankCounts)
        .map(Number)
        .filter((rank) => Number.isInteger(rank) && (snapshot.rankCounts[String(rank)] ?? 0) > 0)
        .sort((left, right) => left - right);
}
