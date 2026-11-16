import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useTrackerStore } from "../../store/store";

type IntrinsicSkill = {
    key: string;
    label: string;
    description: string;
    color: string;
    ranks: string[];
};

type IntrinsicsMode = "proxima" | "duviri";

const RAILJACK_SKILLS: IntrinsicSkill[] = [
    {
        key: "LPS_PILOTING",
        label: "Piloting",
        description: "The Piloting Intrinsics enhances the player's speed and maneuverability while in the Railjack's Pilot seat.",
        color: "blue",
        ranks: [
            "Boost — Hold Shift to boost Engine Speed. Firing pilot guns interrupts boosting.",
            "Vector Maneuver — Tap Shift to burst Directional Thrusters.",
            "Vectored Evasion — Nearby enemy projectiles lose lock-on during Vector Maneuver.",
            "Drift Maneuver — During Vector, press & hold Shift to drift in any direction.",
            "Boosted Scavenger — 3× loot pickup radius while boosting/drifting/dodging. Hidden derelicts marked.",
            "Ram Jammer — 25% chance to jam an incoming Ramsled's targeting, causing it to overshoot and explode.",
            "Necramech Haste — Necramech movement speed +10% (also applies outside Empyrean).",
            "Aeronaut — Archwing speed +20% (also applies outside Empyrean).",
            "Ramming Speed — Incoming damage reduced by 25%. Ramming enemies while Boosting deals 2,000 Impact damage.",
            "Railjack Blink — Double-tap Space to instantly translate the Railjack 1,000m forward, leaving turbulence that slows nearby enemies.",
        ],
    },
    {
        key: "LPS_GUNNERY",
        label: "Gunnery",
        description: "The Gunnery Intrinsics enhances the user's performance of the Railjack's Turrets.",
        color: "orange",
        ranks: [
            "Target Sync — Target lead indicators and ordnance lock-on. Crewship projectiles also lock onto targets.",
            "Phantom Eye — Swivel Turrets gain full 360° combat engagement with no movement restrictions.",
            "Archwing Slingshot — High-velocity Archwing deployment (range 1,850m). Penetrates crewship hulls, depositing Tenno inside.",
            "Archwing Fury — Archwing attraction range +25m, melee range +0.75m, damage +20% (applies outside Empyrean).",
            "Necramech Fury — Necramech gun damage +20% (also applies outside Empyrean).",
            "Cold Trigger — Turret heat accretion reduced by 20%.",
            "Advanced Gunnery — Overheat recovery time reduced by 50%. Slingshot range extended by 50%.",
            "Vengeful Archwing — Archwing damage +25%, ability strength/range/efficiency all +20% (applies outside Empyrean, including Landscapes).",
            "Flush Heat Sinks — Reloading overheated weapons cools them to 0 in 0.5 seconds.",
            "Reflex Aim — Aim snaps turrets to nearest lead indicator for 3s, but turret overheats 20% faster. Many players stop at R9 because the auto-aim behavior is often considered annoying and counterproductive.",
        ],
    },
    {
        key: "LPS_ENGINEERING",
        label: "Engineering",
        description: "The Engineering Intrinsics enhances Omni repair and Resource Forge crafting.",
        color: "green",
        ranks: [
            "Applied Omni — Accelerated hazard suppression and hull repair. Timed repair circle for instant repair.",
            "Rapid Support — Air Support Charges cooldown reduced by 50% (to 5 minutes, also outside Empyrean).",
            "Ordnance Forge — Unlocks ability to craft Ordnance at the Resource Forge mid-mission.",
            "Dome Charge Forge — Unlocks ability to craft Dome Charges at the Resource Forge mid-mission.",
            "Optimized Forge — Forge yields +25%. Unlocks crafting Hull Restores at the Forge.",
            "Forge Accelerator — Forge processing speed +25% (cooldown reduced to 2 min 15 sec).",
            "Full Optimization — Further Forge yields +25% (total +50% with Optimized Forge).",
            "Vigilant Archwing — Archwing health/shields/armor all +30% (also applies outside Empyrean).",
            "Vigilant Necramech — Necramech health/shields both +25% (also applies outside Empyrean).",
            "Anastasis — Remotely repair onboard hazards via the Tactical Menu. Spawns a repair drone (5 sec). Cannot be used during an active Electrical Hazard.",
        ],
    },
    {
        key: "LPS_TACTICAL",
        label: "Tactical",
        description: "The Tactical Intrinsics grants access to the Railjack's Tactical Menu, allowing players to deploy various remote effects as well as teleport from outside and within the vessel.",
        color: "purple",
        ranks: [
            "Tactical System — Deploy Tactical Mods and access crew tracking via Tactical Menu (L). Shows Railjack map, teammate positions, health and shields.",
            "Ability Kinesis & Overseer — Remotely activate crewmates' Warframe abilities from Tactical Menu. View from other players' perspectives.",
            "Command Link — Fast-travel within the Railjack (Bridge, Archwing exits, Turrets, Slingshot, Forge). Issue scripted mission commands to crew.",
            "Recall Warp — Omni gear teleports you back aboard from anywhere after 5 seconds.",
            "Deploy Necramechs — Use Necramech Summon in grounded combat within Railjack missions.",
            "Tactical Efficiency — Battle Mod energy consumption reduced by 25%.",
            "Tactical Response — Tactical Mod cooldown reduced by 20%.",
            "Archwing Tactical Blink & Necramech Cooldown — Archwing Blink cooldown −25%, Necramech summon cooldown −25% (also applies outside Empyrean).",
            "Swift Tactics — Further reduces Tactical Mod cooldown by 20% (combined 36% with Rank 7, stacks multiplicatively).",
            "Join Warp — Warp from ship to a crew member's last location after 5 seconds.",
        ],
    },
    {
        key: "LPS_COMMAND",
        label: "Command",
        description: "The Command Intrinsic affects the Railjack's number of Crew and allows assigning bonus stats to them.",
        color: "amber",
        ranks: [
            "1st Crew Member — Unlocks first crew slot. Hire crew from Ticker in Fortuna.",
            "Competency Gain — Assign 1 competency point to crew members.",
            "2nd Crew Member — Unlocks second crew slot.",
            "Competency Gain — Assign 1 additional competency point to crew members.",
            "3rd Crew Member — Unlocks third crew slot.",
            "Competency Gain — Assign 1 additional competency point to crew members.",
            "Competency Retraining — Redistribute previously assigned competency points.",
            "Unusual Crewmates — Converted Liches become available as crew (Defender role only, no weapons/systems/competency).",
            "On Call — Designate one crew member to be summoned in non-Railjack missions for up to 3 minutes (10 min cooldown, infinite uses).",
            "Elite Crewmates — Stronger crew available from Ticker with 2 extra competency points and a unique random trait.",
        ],
    },
];

const RAILJACK_COST_PER_RANK = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512];

const DUVIRI_SKILLS: IntrinsicSkill[] = [
    {
        key: "LPS_DRIFT_COMBAT",
        label: "Combat",
        description: "The Combat Intrinsics strengthens the Drifter's fighting prowess in Duviri.",
        color: "rose",
        ranks: [
            "Deadly Decrees — Each active Decree grants +10% damage (additive with Serration/Hornet Strike, affects some Warframe abilities).",
            "Adrenaline Surge — In Duviri, Restorative boosts movement speed for 5 seconds.",
            "Transference Sync — Unlock Transference Surge: briefly summon a Warframe in Duviri (press 5 when bar is full, lasts 10 seconds).",
            "Swifter Strike — In Duviri, Drifter Power Strike cooldown reduced by 30%.",
            "Swifter Abilities — In Duviri, Drifter ability cooldown reduced by 20% (Restorative: 12s, Smoke Screen: 48s).",
            "Neural Pulse — Guiding Hand exposes a weakpoint on enemies for 10s. Hitting a weakpoint deals 3× damage.",
            "Weaponmaster — In Duviri, weapon critical hit chance +20% additively (also affects Warframes).",
            "Transference Synergy — Transference Surge duration +50% (increased to 15 seconds).",
            "Muscle Mass — Drifter deals +25% damage. In the Origin System, both Drifter and Operator receive this boost.",
            "Overpowering Abilities — In Duviri, using an Ability increases damage by 150% for 3 seconds.",
        ],
    },
    {
        key: "LPS_DRIFT_RIDING",
        label: "Riding",
        description: "The Riding Intrinsics allows the use of Kaithe riding and provides beneficiary effects while aboard the steed.",
        color: "cyan",
        ranks: [
            "Summon Kaithe — Tap 1 to summon your Kaithe. (Required during The Duviri Paradox quest.)",
            "Cavalier Strength — Increased resistance to being dismounted by enemies.",
            "Hoof Stomp — Press 3 while riding to command your Kaithe to stomp, knocking back enemies and reducing their armor.",
            "Fast Travel — Use the map to fast travel to central Duviri locations and Materliths.",
            "Smooth Path — Plants and rocks are marked on the map when riding your Kaithe.",
            "Steadfast Dismount — Press 4 while riding to dismount and gain 150 Overguard (150 second cooldown).",
            "Endurance Racer — Reduce cooldown between dashes.",
            "Unique Identity — Name your Kaithe.",
            "Equestrian Bond — Receive Kaithe Summon for Origin System Open World missions.",
            "Herd Travel — Use the map to fast travel to other Drifters.",
        ],
    },
    {
        key: "LPS_DRIFT_OPPORTUNITY",
        label: "Opportunity",
        description: "The Opportunity Intrinsics unlocks more available Warframe, weapon, and Decree selections within Duviri.",
        color: "amber",
        ranks: [
            "Expanded Decrees — Decree selections offer one additional option (3 → 4 choices).",
            "Expanded Arsenal — Gain two additional weapon choices in Teshin's Cave (4 → 6 options).",
            "Lucky Opener — Gain a free Decree when you enter Duviri.",
            "Warframe Abundance — One additional Warframe option in Teshin's Cave (3 → 4). Also enables preview of offerings in the Star Chart.",
            "Treasure Finder — +50% chance to receive Rare Decrees.",
            "Fresh Hand — Discard offered Decrees and get a new selection, up to 3 times per Duviri visit.",
            "Maximized Arsenal — Two more weapon choices in Teshin's Cave (further increases to 8 options).",
            "Warframe Diversity — One more Warframe option in Teshin's Cave (further increases to 5 options).",
            "High Value Vendor — Acrithis's stock now includes one Arcane per day. Steel Path Circuit also allows a Riven Mod or Kuva.",
            "Stranger in Black — An unlikely ally occasionally appears in Teshin's Cave. Unlocks Stalker as a playable Warframe option.",
        ],
    },
    {
        key: "LPS_DRIFT_ENDURANCE",
        label: "Endurance",
        description: "The Endurance Intrinsics bolsters the Drifter's survivability in Duviri.",
        color: "green",
        ranks: [
            "Fortifying Decrees — Each active Decree grants +25 Health to Drifter (also affects Warframes).",
            "Restorative Decree — Gaining a Decree fully restores Health and Energy (also affects Warframes).",
            "Determination — One additional Revive available in Duviri (also affects Warframes).",
            "Deft Defender — Parry grants +25 Health. Precise Parry grants +50 Health.",
            "Born Survivor — +50% additional Health.",
            "Precision Power — On Precise Parry, gain extra charge for Transference Surge.",
            "Sharpshooter's Bounty — Landing a headshot restores +10 Health/s for 5s (also affects Warframes).",
            "Tenacity — One additional Revive available in Duviri (also affects Warframes).",
            "Tough As Old Boots — Gain +5 Health/s as Drifter. In the Origin System, both Drifter and Operator receive this boost.",
            "Cheat Death — Fatal damage leaves you at 20% Health and invulnerable for 3 seconds (200s cooldown, also affects Warframes).",
        ],
    },
];

const DUVIRI_COST_PER_RANK = [20, 25, 30, 45, 65, 90, 125, 160, 205, 255];

const COLOR_MAP: Record<string, { bar: string; text: string; border: string; bg: string; hex: string }> = {
    blue:   { bar: "bg-blue-500",   text: "text-blue-300",   border: "border-blue-700/50",   bg: "bg-blue-950/20", hex: "#60a5fa" },
    orange: { bar: "bg-orange-500", text: "text-orange-300", border: "border-orange-700/50", bg: "bg-orange-950/20", hex: "#fb923c" },
    green:  { bar: "bg-green-500",  text: "text-green-300",  border: "border-green-700/50",  bg: "bg-green-950/20", hex: "#4ade80" },
    purple: { bar: "bg-purple-500", text: "text-purple-300", border: "border-purple-700/50", bg: "bg-purple-950/20", hex: "#c084fc" },
    amber:  { bar: "bg-amber-500",  text: "text-amber-300",  border: "border-amber-700/50",  bg: "bg-amber-950/20", hex: "#fbbf24" },
    cyan:   { bar: "bg-cyan-500",   text: "text-cyan-300",   border: "border-cyan-700/50",   bg: "bg-cyan-950/20", hex: "#22d3ee" },
    rose:   { bar: "bg-rose-500",   text: "text-rose-300",   border: "border-rose-700/50",   bg: "bg-rose-950/20", hex: "#fb7185" },
};

const MAX_RANK = 10;

export function getIntrinsicModeData(mode: IntrinsicsMode) {
    return mode === "proxima"
        ? {
            title: "Railjack Intrinsics",
            warning: "Intrinsic investments cannot be reset — choose carefully.",
            skills: RAILJACK_SKILLS,
            costPerRank: RAILJACK_COST_PER_RANK,
        }
        : {
            title: "Duviri Intrinsics",
            warning: "Intrinsic investments cannot be reset — choose carefully.",
            skills: DUVIRI_SKILLS,
            costPerRank: DUVIRI_COST_PER_RANK,
        };
}

export function getCumulativeCost(costPerRank: number[], rank: number) {
    return costPerRank.slice(0, rank).reduce((sum, cost) => sum + cost, 0);
}

export function getTotalCost(costPerRank: number[]) {
    return costPerRank.reduce((sum, cost) => sum + cost, 0);
}

function IntrinsicProgressRing({ rank, color }: { rank: number; color: string }) {
    const segments = Array.from({ length: MAX_RANK }, (_, index) => {
        const start = (-90 + index * 36 + 3) * (Math.PI / 180);
        const end = (-90 + (index + 1) * 36 - 3) * (Math.PI / 180);
        const x1 = 60 + 48 * Math.cos(start);
        const y1 = 60 + 48 * Math.sin(start);
        const x2 = 60 + 48 * Math.cos(end);
        const y2 = 60 + 48 * Math.sin(end);
        return { d: `M ${x1} ${y1} A 48 48 0 0 1 ${x2} ${y2}`, active: index < rank };
    });

    return (
        <svg className="h-36 w-36 drop-shadow-[0_0_16px_rgba(148,163,184,0.08)]" viewBox="0 0 120 120" aria-hidden="true">
            <circle cx="60" cy="60" r="39" fill="rgba(15,23,42,0.55)" stroke="rgba(148,163,184,0.14)" strokeWidth="1" />
            <circle cx="60" cy="60" r="33" fill="none" stroke="rgba(148,163,184,0.12)" strokeWidth="1" />
            {segments.map((segment, index) => (
                <path
                    key={index}
                    d={segment.d}
                    fill="none"
                    stroke={segment.active ? color : "rgba(148,163,184,0.25)"}
                    strokeWidth={segment.active ? 4 : 2.5}
                    strokeLinecap="round"
                />
            ))}
            <path d="M60 36 84 60 60 84 36 60Z" fill="none" stroke={color} strokeOpacity="0.72" strokeWidth="1.5" />
            <path d="M60 46 74 60 60 74 46 60Z" fill={color} fillOpacity="0.22" stroke={color} strokeWidth="1.5" />
            <path d="M60 51 69 60 60 69 51 60Z" fill={color} fillOpacity="0.76" />
            <path d="M28 60h8m48 0h8M60 28v8m0 48v8" stroke={color} strokeOpacity="0.5" strokeWidth="1.5" />
        </svg>
    );
}

function IntrinsicFlipCard({
    mode,
    skill,
    rank,
    costPerRank,
}: {
    mode: IntrinsicsMode;
    skill: IntrinsicSkill;
    rank: number;
    costPerRank: number[];
}) {
    const setIntrinsicRank = useTrackerStore(s => s.setIntrinsicRank);
    const [flipped, setFlipped] = useState(false);
    const [helpOpen, setHelpOpen] = useState(false);
    const frontActionRef = useRef<HTMLButtonElement>(null);
    const backActionRef = useRef<HTMLButtonElement>(null);
    const hasFlippedRef = useRef(false);
    const clr = COLOR_MAP[skill.color] ?? COLOR_MAP.blue;
    const currentCost = getCumulativeCost(costPerRank, rank);
    const nextRank = rank < MAX_RANK ? rank + 1 : null;
    const nextCost = nextRank === null ? null : costPerRank[rank];
    const nextReward = nextRank === null ? null : skill.ranks[rank];
    const totalCost = getTotalCost(costPerRank);

    useEffect(() => {
        if (!hasFlippedRef.current) return;
        if (flipped) backActionRef.current?.focus();
        else frontActionRef.current?.focus();
    }, [flipped]);

    const flip = () => {
        hasFlippedRef.current = true;
        setHelpOpen(false);
        setFlipped(value => !value);
    };
    const handleEscape = (event: ReactKeyboardEvent<HTMLElement>) => {
        if (event.key === "Escape" && helpOpen) {
            event.stopPropagation();
            setHelpOpen(false);
        } else if (event.key === "Escape" && flipped) {
            event.stopPropagation();
            flip();
        }
    };

    return (
        <article className={["relative [perspective:1400px] hover:z-20 focus-within:z-20", helpOpen ? "z-30" : ""].join(" ")}>
            <div
                className="relative h-[29rem] w-full transition-transform duration-500 motion-reduce:transition-none sm:h-[31rem] [transform-style:preserve-3d]"
                style={{ transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
            >
                <section
                    aria-hidden={flipped}
                    inert={flipped}
                    onKeyDown={handleEscape}
                    className={["absolute inset-0 flex flex-col items-center rounded-xl border px-3 pb-4 pt-4 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] [backface-visibility:hidden]", clr.border, clr.bg].join(" ")}
                    style={{ backfaceVisibility: "hidden" }}
                >
                    <div className={["absolute inset-x-0 top-0 h-px opacity-70", clr.bar].join(" ")} />
                    <div className="group/help absolute right-3 top-3 z-10">
                        <button
                            type="button"
                            aria-label={`Quick rank preview for ${skill.label}`}
                            aria-expanded={helpOpen}
                            onClick={() => setHelpOpen(value => !value)}
                            className={["flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300", clr.border, clr.bg, clr.text].join(" ")}
                        >
                            ?
                        </button>
                        <div className={["absolute right-0 top-full mt-2 w-64 max-w-[calc(100vw-2.5rem)] rounded-xl border border-slate-600 bg-slate-950 p-4 text-left shadow-2xl transition-opacity", helpOpen ? "visible pointer-events-auto opacity-100" : "invisible pointer-events-none opacity-0 group-hover/help:visible group-hover/help:pointer-events-auto group-hover/help:opacity-100"].join(" ")}>
                            <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase text-slate-200">
                                <span>{nextRank === null ? "Max rank" : `Rank up · R${nextRank}`}</span>
                                {nextCost !== null && <span className="text-slate-400">◉ {nextCost.toLocaleString()}</span>}
                            </div>
                            <p className="mt-2 text-xs leading-5 text-slate-400">{skill.description}</p>
                            {nextReward && (
                                <div className="mt-3 border-t border-slate-800 pt-3">
                                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Next rank · {nextReward.split(" — ")[0]}</div>
                                    <p className="mt-1 text-xs leading-5 text-slate-200">{nextReward.includes(" — ") ? nextReward.slice(nextReward.indexOf(" — ") + 3) : nextReward}</p>
                                </div>
                            )}
                            <div className="mt-3 border-t border-slate-800 pt-3">
                                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Acquired</div>
                                {rank === 0 ? (
                                    <p className="mt-1 text-xs text-slate-500">No rank rewards acquired yet.</p>
                                ) : (
                                    <ul className="mt-1 max-h-24 space-y-1 overflow-y-auto text-xs text-slate-300">
                                        {skill.ranks.slice(0, rank).map((reward, index) => <li key={index}>{reward.split(" — ")[0]}</li>)}
                                    </ul>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={flip}
                                className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-slate-200 hover:bg-slate-800"
                            >
                                Details <span aria-hidden="true">→</span>
                            </button>
                        </div>
                    </div>

                    <div className={["mt-1 text-xs font-semibold uppercase tracking-[0.2em]", clr.text].join(" ")}>{skill.label}</div>
                    <div className="mt-1 min-h-8 max-w-full px-1 text-[10px] leading-4 text-slate-500">{skill.description}</div>
                    <div className="relative mt-2 flex h-36 w-36 items-center justify-center">
                        <IntrinsicProgressRing rank={rank} color={clr.hex} />
                        <span className="absolute text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-400">{skill.label.slice(0, 3)}</span>
                    </div>
                    <div className="mt-1 flex items-baseline gap-1.5">
                        <span className="font-mono text-4xl font-semibold leading-none text-slate-100">{rank}</span>
                        <span className="font-mono text-xs text-slate-500">/ {MAX_RANK}</span>
                    </div>
                    <div className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950/55 px-3 py-2 text-left">
                        <div className="flex items-center justify-between gap-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            <span>{nextRank === null ? "Max rank" : `Next rank · R${nextRank}`}</span>
                            {nextCost !== null && <span>{nextCost.toLocaleString()} pts</span>}
                        </div>
                        <div className="mt-1 truncate text-[11px] font-semibold text-slate-200">{nextReward ? nextReward.split(" — ")[0] : "All ranks acquired"}</div>
                        <p className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-slate-500">{nextReward && nextReward.includes(" — ") ? nextReward.slice(nextReward.indexOf(" — ") + 3) : nextReward ?? "This discipline is fully ranked."}</p>
                    </div>
                    <div className="mt-1 text-[9px] text-slate-600">{currentCost.toLocaleString()} / {totalCost.toLocaleString()} points invested</div>
                    <button
                        ref={frontActionRef}
                        type="button"
                        onClick={flip}
                        aria-label={`View all ${skill.label} rank details`}
                        className={["mt-auto rounded-lg px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300", clr.text].join(" ")}
                    >
                        View all ranks <span aria-hidden="true">→</span>
                    </button>
                </section>

                <section
                    aria-hidden={!flipped}
                    inert={!flipped}
                    onKeyDown={handleEscape}
                    className={["absolute inset-0 flex flex-col overflow-hidden rounded-xl border bg-slate-950 px-3 pb-3 pt-3 text-left shadow-xl [backface-visibility:hidden]", clr.border].join(" ")}
                    style={{ transform: "rotateY(180deg)", backfaceVisibility: "hidden" }}
                >
                    <header className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
                        <div className="min-w-0">
                            <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500">{mode === "proxima" ? "Railjack" : "Duviri"} · Rank Details</div>
                            <h3 className={["truncate text-sm font-semibold", clr.text].join(" ")}>{skill.label}</h3>
                        </div>
                        <button
                            ref={backActionRef}
                            type="button"
                            onClick={flip}
                            aria-label={`Flip ${skill.label} panel back`}
                            className="shrink-0 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-[9px] font-semibold uppercase tracking-wider text-slate-300 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                        >
                            ← Front
                        </button>
                    </header>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                        <span>Tracked rank <span className="font-mono text-slate-100">{rank}/{MAX_RANK}</span></span>
                        <span>{currentCost.toLocaleString()} pts invested</span>
                    </div>
                    <div className="mt-2 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
                        {skill.ranks.map((description, index) => {
                            const acquired = index < rank;
                            return (
                                <div key={index} className={["rounded-lg border px-2.5 py-2", acquired ? "border-slate-700 bg-slate-900/80" : "border-slate-800 bg-slate-900/35"].join(" ")}>
                                    <div className="flex items-center justify-between gap-2">
                                        <span className={["text-[10px] font-semibold uppercase tracking-wider", acquired ? clr.text : "text-slate-500"].join(" ")}>Rank {index + 1}{acquired ? " · Acquired" : ""}</span>
                                        <span className="shrink-0 text-[9px] font-mono text-slate-500">{costPerRank[index].toLocaleString()} · {getCumulativeCost(costPerRank, index + 1).toLocaleString()}</span>
                                    </div>
                                    <p className={["mt-1 text-[10px] leading-4", acquired ? "text-slate-200" : "text-slate-400"].join(" ")}>{description}</p>
                                </div>
                            );
                        })}
                    </div>
                    <footer className="mt-2 border-t border-slate-800 pt-2">
                        <div className="mb-1.5 flex items-center justify-between text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                            <span>Set tracked rank</span>
                            <span>Rank cost / total</span>
                        </div>
                        <div className="grid grid-cols-6 gap-1" role="group" aria-label={`${skill.label} rank selector`}>
                            {Array.from({ length: MAX_RANK + 1 }, (_, value) => (
                                <button
                                    key={value}
                                    type="button"
                                    aria-label={`Set tracked ${skill.label} rank to ${value}`}
                                    aria-pressed={value === rank}
                                    className={["rounded-md border py-1 text-[9px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300", value === rank ? `${clr.border} ${clr.bg} ${clr.text}` : "border-slate-700 bg-slate-900/40 text-slate-400 hover:border-slate-500 hover:text-slate-200"].join(" ")}
                                    onClick={() => setIntrinsicRank(mode, skill.key, value)}
                                >
                                    R{value}
                                </button>
                            ))}
                        </div>
                    </footer>
                </section>
            </div>
        </article>
    );
}

export function IntrinsicDisciplineBoard({ mode, className }: { mode: IntrinsicsMode; className?: string }) {
    const intrinsics = useTrackerStore(s => s.state.intrinsics);
    const railjack = intrinsics?.railjack ?? {};
    const duviri = intrinsics?.duviri ?? {};
    const { skills, costPerRank } = getIntrinsicModeData(mode);
    const values = mode === "proxima" ? railjack : duviri;
    const columnClass = mode === "proxima" ? "xl:grid-cols-5" : "xl:grid-cols-4";

    return (
        <div className={className}>
            <div className={["grid grid-cols-1 gap-3 sm:grid-cols-2", columnClass].join(" ")}>
                {skills.map((skill) => (
                    <IntrinsicFlipCard
                        key={skill.key}
                        mode={mode}
                        skill={skill}
                        rank={Math.min(values[skill.key] ?? 0, MAX_RANK)}
                        costPerRank={costPerRank}
                    />
                ))}
            </div>
        </div>
    );
}
export function IntrinsicsDetails(props: { mode: IntrinsicsMode; className?: string }) {
    const { mode, className } = props;
    const intrinsics = useTrackerStore(s => s.state.intrinsics);
    const setIntrinsicRank = useTrackerStore(s => s.setIntrinsicRank);
    const railjack = intrinsics?.railjack ?? {};
    const duviri = intrinsics?.duviri ?? {};
    const { skills, costPerRank } = getIntrinsicModeData(mode);
    const values = mode === "proxima" ? railjack : duviri;
    const [expanded, setExpanded] = useState<string | null>(skills[0]?.key ?? null);
    const totalCost = getTotalCost(costPerRank);

    return (
        <div className={["space-y-3", className].filter(Boolean).join(" ")}>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-xs leading-5 text-slate-400">
                Profile import can miss intrinsic ranks for some accounts. You can correct them manually here and the values will be saved locally.
            </div>
            {skills.map((sk) => {
                const rank = Math.min(values[sk.key] ?? 0, MAX_RANK);
                const isExpanded = expanded === sk.key;
                const clr = COLOR_MAP[sk.color] ?? COLOR_MAP.blue;
                const nextCost = rank < MAX_RANK ? costPerRank[rank] : null;
                const nextRank = rank < MAX_RANK ? rank + 1 : null;
                const nextCumulative = nextRank ? getCumulativeCost(costPerRank, nextRank) : null;
                const currentCumulative = getCumulativeCost(costPerRank, rank);
                const costPct = totalCost > 0 ? (currentCumulative / totalCost) * 100 : 0;

                return (
                    <div key={sk.key} className={["rounded-xl border overflow-hidden", clr.border, clr.bg].join(" ")}>
                        <button
                            className="w-full flex items-center gap-3 px-4 py-3 text-left"
                            onClick={() => setExpanded(isExpanded ? null : sk.key)}
                        >
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className={["text-sm font-semibold", clr.text].join(" ")}>{sk.label}</span>
                                    <span className="text-xs text-slate-400 font-mono">R{rank} / {MAX_RANK}</span>
                                    {nextCost && nextRank && nextCumulative && (
                                        <span className="text-[10px] text-slate-500 sm:ml-auto">
                                            R{nextRank}: {nextCost.toLocaleString()} pts · {nextCumulative.toLocaleString()} total
                                        </span>
                                    )}
                                </div>
                                <p className="mt-1 pr-2 text-[11px] leading-relaxed text-slate-400">
                                    {sk.description}
                                </p>
                                <div className="mt-2 space-y-2">
                                    <div>
                                        <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-slate-500">
                                            <span>Rank Progress</span>
                                            <span>{rank}/{MAX_RANK}</span>
                                        </div>
                                        <div className="flex gap-0.5">
                                            {Array.from({ length: MAX_RANK }, (_, i) => (
                                                <div
                                                    key={i}
                                                    className={["h-1.5 flex-1 rounded-sm", i < rank ? clr.bar : "bg-slate-700"].join(" ")}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-slate-500">
                                            <span>Cost Progress</span>
                                            <span>{currentCumulative.toLocaleString()} / {totalCost.toLocaleString()}</span>
                                        </div>
                                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                                            <div
                                                className={["h-full rounded-full", clr.bar].join(" ")}
                                                style={{ width: `${costPct}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <svg
                                className={["w-4 h-4 text-slate-500 transition-transform shrink-0", isExpanded ? "rotate-180" : ""].join(" ")}
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                            >
                                <polyline points="6 9 12 15 18 9" />
                            </svg>
                        </button>

                        {isExpanded && (
                            <div className="border-t border-slate-700/50 px-4 py-3 space-y-1.5">
                                <div className="mb-2 flex flex-wrap gap-1.5">
                                    {Array.from({ length: MAX_RANK + 1 }, (_, value) => (
                                        <button
                                            key={value}
                                            type="button"
                                            className={[
                                                "rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                                                value === rank
                                                    ? `${clr.border} ${clr.bg} ${clr.text}`
                                                    : "border-slate-700 bg-slate-900/40 text-slate-400 hover:border-slate-500 hover:text-slate-200",
                                            ].join(" ")}
                                            onClick={() => setIntrinsicRank(mode, sk.key, value)}
                                        >
                                            R{value}
                                        </button>
                                    ))}
                                </div>
                                {sk.ranks.map((desc, r) => (
                                    <div
                                        key={r}
                                        className={[
                                            "flex items-start gap-2.5 rounded-lg px-3 py-2 text-xs",
                                            r < rank ? "bg-slate-800/60" : "bg-slate-900/40 opacity-50",
                                        ].join(" ")}
                                    >
                                        <div className={["shrink-0 w-5 text-center font-mono", r < rank ? clr.text : "text-slate-600"].join(" ")}>
                                            R{r + 1}
                                        </div>
                                        <div className={r < rank ? "text-slate-200" : "text-slate-500"}>{desc}</div>
                                        <div className="ml-auto shrink-0 text-right text-[10px] text-slate-600 font-mono">
                                            <div>{costPerRank[r].toLocaleString()} pts</div>
                                            <div>{getCumulativeCost(costPerRank, r + 1).toLocaleString()} total</div>
                                        </div>
                                    </div>
                                ))}
                                <div className="text-[10px] text-slate-600 pt-1 text-right">
                                    Invested: {currentCumulative.toLocaleString()} total · Total to max: {costPerRank.reduce((a, b) => a + b, 0).toLocaleString()} total
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

export function IntrinsicsPanel({ mode, onClose }: { mode: IntrinsicsMode; onClose: () => void }) {
    const intrinsics = useTrackerStore(s => s.state.intrinsics);
    const railjack = intrinsics?.railjack ?? {};
    const duviri = intrinsics?.duviri ?? {};
    const { title, warning, skills } = getIntrinsicModeData(mode);
    const values = mode === "proxima" ? railjack : duviri;
    const totalPoints = skills.reduce((sum, sk) => sum + (values[sk.key] ?? 0), 0);
    const totalMax = skills.length * MAX_RANK;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-800 shrink-0">
                    <div>
                        <div className="text-base font-semibold text-slate-100">{title}</div>
                        <div className="text-xs text-slate-400 mt-0.5">
                            {totalPoints} / {totalMax} points invested
                            {!Object.keys(values).length && " — import your profile or enter ranks manually"}
                        </div>
                        <div className="text-[11px] text-amber-400/80 mt-1 flex items-center gap-1">
                            <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                <line x1="12" y1="9" x2="12" y2="13" />
                                <line x1="12" y1="17" x2="12.01" y2="17" />
                            </svg>
                            {warning}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                    >
                        Close
                    </button>
                </div>

                <div className="overflow-y-auto flex-1 p-4">
                    <IntrinsicsDetails mode={mode} />
                </div>
            </div>
        </div>
    );
}
