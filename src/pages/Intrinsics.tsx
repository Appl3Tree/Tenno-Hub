// ===== FILE: src/pages/Intrinsics.tsx =====
import { useTrackerStore } from "../store/store";
import { WorkspacePanel } from "../components/workspace/WorkspaceChrome";
import {
    IntrinsicsDetails,
    getIntrinsicModeData,
    getCumulativeCost,
    getTotalCost,
} from "../components/intrinsics/IntrinsicsDetails";

// ── Page ──────────────────────────────────────────────────────────────────────

const EMPTY_INTRINSICS: Record<string, number> = {};

function IntrinsicsSection(props: {
    title: string;
    eyebrow: string;
    accentClassName: string;
    accentGlowClassName: string;
    total: number;
    max: number;
    costTotal: number;
    costMax: number;
    description: string;
    mode: "proxima" | "duviri";
}) {
    const { title, eyebrow, accentClassName, accentGlowClassName, total, max, costTotal, costMax, description, mode } = props;
    const rankPct = max > 0 ? (total / max) * 100 : 0;
    const costPct = costMax > 0 ? (costTotal / costMax) * 100 : 0;

    return (
        <WorkspacePanel className="relative overflow-hidden border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-1)] p-0">
            <div className={["absolute inset-x-0 top-0 h-px opacity-80", accentGlowClassName].join(" ")} />
            <div className="relative p-5 sm:p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-2xl">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                            {eyebrow}
                        </div>
                        <h2 className="mt-2 text-xl font-semibold text-[color:var(--wf-text-strong)]">
                            {title}
                        </h2>
                        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
                            {description}
                        </p>
                    </div>
                    <div className="min-w-[220px] lg:text-right">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Overall Progress</div>
                        <div className="mt-3 space-y-2">
                            <div>
                                <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-slate-500 lg:justify-end lg:gap-4">
                                    <span>Rank</span>
                                    <span>{total} / {max}</span>
                                </div>
                                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-900">
                                    <div className={["h-full rounded-full", accentClassName].join(" ")} style={{ width: `${rankPct}%` }} />
                                </div>
                            </div>
                            <div>
                                <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-slate-500 lg:justify-end lg:gap-4">
                                    <span>Cost</span>
                                    <span>{costTotal.toLocaleString()} / {costMax.toLocaleString()}</span>
                                </div>
                                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-900">
                                    <div className={["h-full rounded-full", accentClassName].join(" ")} style={{ width: `${costPct}%` }} />
                                </div>
                            </div>
                        </div>
                        <div className="mt-2 text-xs text-slate-500">
                            {rankPct.toFixed(0)}% ranks · {costPct.toFixed(0)}% cost invested
                        </div>
                    </div>
                </div>

                <div className="mt-6 border-t border-[color:var(--wf-border-subtle)] pt-5">
                    <IntrinsicsDetails mode={mode} />
                </div>
            </div>
        </WorkspacePanel>
    );
}

export default function Intrinsics() {
    const railjack = useTrackerStore(s => s.state.intrinsics?.railjack ?? EMPTY_INTRINSICS);
    const duviri   = useTrackerStore(s => s.state.intrinsics?.duviri   ?? EMPTY_INTRINSICS);

    const hasData = Object.keys(railjack).length > 0 || Object.keys(duviri).length > 0;

    const railjackMeta = getIntrinsicModeData("proxima");
    const duviriMeta = getIntrinsicModeData("duviri");
    const railjackTotal = railjackMeta.skills.reduce((sum, sk) => sum + (railjack[sk.key] ?? 0), 0);
    const railjackMax = railjackMeta.skills.length * 10;
    const duviriTotal = duviriMeta.skills.reduce((sum, sk) => sum + (duviri[sk.key] ?? 0), 0);
    const duviriMax = duviriMeta.skills.length * 10;
    const railjackCostPerSkillMax = getTotalCost(railjackMeta.costPerRank);
    const duviriCostPerSkillMax = getTotalCost(duviriMeta.costPerRank);
    const railjackCostTotal = railjackMeta.skills.reduce(
        (sum, sk) => sum + getCumulativeCost(railjackMeta.costPerRank, Math.min(railjack[sk.key] ?? 0, 10)),
        0,
    );
    const duviriCostTotal = duviriMeta.skills.reduce(
        (sum, sk) => sum + getCumulativeCost(duviriMeta.costPerRank, Math.min(duviri[sk.key] ?? 0, 10)),
        0,
    );
    const railjackCostMax = railjackMeta.skills.length * railjackCostPerSkillMax;
    const duviriCostMax = duviriMeta.skills.length * duviriCostPerSkillMax;

    return (
        <div className="space-y-6">
            <WorkspacePanel className="overflow-hidden border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-1)] p-5 sm:p-6" aria-labelledby="intrinsics-page-title">
                <div className="flex items-start justify-between gap-6 flex-wrap">
                    <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                            Profile Systems
                        </div>
                        <h1 id="intrinsics-page-title" className="mt-2 text-2xl font-semibold text-[color:var(--wf-text-strong)]">Intrinsics</h1>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                            Review your Railjack and Duviri progression in one place, with the same rank-by-rank upgrade data shown from the Star Chart intrinsic panels.
                        </p>
                    </div>
                    {hasData && (
                        <div className="flex gap-6 text-right">
                            <div>
                                <div className="text-2xl font-semibold text-slate-100 font-mono">{railjackTotal}<span className="text-sm text-slate-600">/{railjackMax}</span></div>
                                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Railjack</div>
                                <div className="text-[11px] text-slate-600">{railjackCostTotal.toLocaleString()} / {railjackCostMax.toLocaleString()} cost</div>
                            </div>
                            <div>
                                <div className="text-2xl font-semibold text-slate-100 font-mono">{duviriTotal}<span className="text-sm text-slate-600">/{duviriMax}</span></div>
                                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Duviri</div>
                                <div className="text-[11px] text-slate-600">{duviriCostTotal.toLocaleString()} / {duviriCostMax.toLocaleString()} cost</div>
                            </div>
                        </div>
                    )}
                </div>

                {!hasData && (
                    <div className="mt-4 rounded-xl border border-slate-700/60 bg-slate-900/60 px-4 py-3 text-sm text-slate-400">
                        Import your profile on the <span className="text-slate-200 font-medium">Import / Export</span> page to prefill intrinsic ranks, or set them manually below if the importer misses them.
                        Intrinsics are read from the <span className="font-mono text-slate-300 text-xs">PlayerSkills</span> field in your profile data when available.
                    </div>
                )}
            </WorkspacePanel>

            <IntrinsicsSection
                title="Railjack Intrinsics"
                eyebrow="Empyrean"
                accentClassName="bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-500"
                accentGlowClassName="bg-gradient-to-r from-transparent via-blue-400/80 to-transparent"
                total={railjackTotal}
                max={railjackMax}
                costTotal={railjackCostTotal}
                costMax={railjackCostMax}
                description="Earned by completing Railjack missions in the Proxima regions. Expand any intrinsic below to review its exact in-game upgrades and the Gunnery Reflex Aim caution."
                mode="proxima"
            />

            <IntrinsicsSection
                title="Duviri Intrinsics"
                eyebrow="Paradox"
                accentClassName="bg-gradient-to-r from-violet-400 via-fuchsia-300 to-amber-300"
                accentGlowClassName="bg-gradient-to-r from-transparent via-fuchsia-400/80 to-transparent"
                total={duviriTotal}
                max={duviriMax}
                costTotal={duviriCostTotal}
                costMax={duviriCostMax}
                description="Earned through Duviri Paradox progression. The sections below match the Duviri intrinsic data shown from the Star Chart and keep every rank unlock in one place."
                mode="duviri"
            />
        </div>
    );
}
