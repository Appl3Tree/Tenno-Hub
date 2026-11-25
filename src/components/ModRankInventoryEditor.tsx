import { useMemo, useState } from "react";

export default function ModRankInventoryEditor({
    maxRank,
    rankCounts,
    unknownCount,
    totalCount,
    onChange,
    className = "",
}: {
    maxRank: number;
    rankCounts: Record<string, number>;
    unknownCount: number;
    totalCount: number;
    onChange: (rankCounts: Record<string, number>, unknownCount: number) => void;
    className?: string;
}) {
    const [expanded, setExpanded] = useState(false);
    const ranks = useMemo(() => Array.from({ length: Math.max(0, Math.floor(maxRank)) + 1 }, (_, rank) => rank), [maxRank]);
    const summary = useMemo(() => {
        const parts = Object.keys(rankCounts)
            .map(Number)
            .sort((left, right) => left - right)
            .filter((rank) => (rankCounts[String(rank)] ?? 0) > 0)
            .map((rank) => `R${rank} ×${rankCounts[String(rank)]}`);
        if (unknownCount > 0) parts.push(`Unranked ×${unknownCount}`);
        return parts.length > 0 ? parts.join(" · ") : "No copies";
    }, [rankCounts, unknownCount]);

    const changeRank = (rank: number, delta: number, assignUnknown = false) => {
        const key = String(rank);
        const next = { ...rankCounts };
        if (assignUnknown) {
            if (unknownCount <= 0) return;
            next[key] = (next[key] ?? 0) + 1;
            onChange(next, unknownCount - 1);
            return;
        }
        next[key] = Math.max(0, (next[key] ?? 0) + delta);
        if (next[key] <= 0) delete next[key];
        onChange(next, unknownCount);
    };

    return (
        <div className={["relative", className].filter(Boolean).join(" ")} onClick={(event) => event.stopPropagation()}>
            <button
                type="button"
                className="rounded-md border border-slate-700 bg-slate-900/80 px-2 py-1 text-[10px] font-medium text-slate-300 hover:border-slate-500 hover:text-white"
                aria-expanded={expanded}
                onClick={() => setExpanded((value) => !value)}
            >
                Ranks · {totalCount}
            </button>
            {expanded && (
                <div className="mt-2 rounded-lg border border-slate-700 bg-slate-950 p-3 shadow-xl">
                    <div className="mb-2 flex items-center justify-between gap-3">
                        <div>
                            <div className="text-xs font-semibold text-slate-100">Owned copies by rank</div>
                            <div className="mt-0.5 max-w-64 text-[10px] leading-4 text-slate-500">{summary}</div>
                        </div>
                        <button type="button" className="text-xs text-slate-500 hover:text-white" onClick={() => setExpanded(false)} aria-label="Close rank editor">✕</button>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                        {ranks.map((rank) => {
                            const count = rankCounts[String(rank)] ?? 0;
                            return (
                                <div key={rank} className="flex items-center justify-between gap-1 rounded border border-slate-800 bg-slate-900/60 px-1.5 py-1">
                                    <span className="w-7 text-[10px] font-mono text-slate-400">R{rank}</span>
                                    <button type="button" className="h-5 w-5 rounded bg-slate-800 text-slate-300 disabled:opacity-30" disabled={count <= 0} onClick={() => changeRank(rank, -1)} aria-label={`Remove one rank ${rank} copy`}>−</button>
                                    <span className="min-w-4 text-center text-[10px] font-mono text-slate-200">{count}</span>
                                    <button type="button" className="h-5 w-5 rounded bg-slate-800 text-slate-300" onClick={() => changeRank(rank, 1)} aria-label={`Add one rank ${rank} copy`}>+</button>
                                    {unknownCount > 0 ? (
                                        <button type="button" className="rounded px-1 text-[9px] text-cyan-300 hover:bg-cyan-950/50" onClick={() => changeRank(rank, 0, true)} title="Assign one unranked copy here">↥</button>
                                    ) : <span className="w-4" />}
                                </div>
                            );
                        })}
                    </div>
                    {unknownCount > 0 && <div className="mt-2 text-[10px] text-amber-300">{unknownCount} copy/copies still have no recorded rank. Use ↥ to assign one to a rank.</div>}
                    <div className="mt-2 text-right text-[10px] text-slate-500">Total owned: {totalCount}</div>
                </div>
            )}
        </div>
    );
}
