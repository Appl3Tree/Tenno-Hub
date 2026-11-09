// src/pages/Handbook.tsx  (Tenno's Handbook)
//
// Player guidance for game mechanics, quest progression, and farming.
// Content is static — no store reads needed.

import { useState } from "react";
import { WorkspaceHero, WorkspaceStat } from "../components/workspace/WorkspaceChrome";

// ─────────────────────────────────────────────────────────────────────────────
// Layout primitives
// ─────────────────────────────────────────────────────────────────────────────

function Card({ title, summary, children }: { title: string; summary: string; children: React.ReactNode }) {
    return (
        <article className="rounded-[28px] border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-1)] p-5 shadow-[var(--wf-shadow-panel)] sm:p-7">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--wf-accent-primary)]">
                Handbook Entry
            </div>
            <h2 className="mt-2 text-2xl font-semibold text-[color:var(--wf-text-strong)]">{title}</h2>
            <p className="mt-2 max-w-3xl text-sm text-[color:var(--wf-text-muted)]">{summary}</p>
            <div className="mt-6 space-y-5 text-sm leading-relaxed text-[color:var(--wf-text)]">{children}</div>
        </article>
    );
}

function P({ children }: { children: React.ReactNode }) {
    return <p className="leading-7 text-[color:var(--wf-text)]">{children}</p>;
}

function B({ children }: { children: React.ReactNode }) {
    return <span className="font-semibold text-[color:var(--wf-text-strong)]">{children}</span>;
}

function Tag({ children }: { children: React.ReactNode }) {
    return (
        <span className="inline-block whitespace-nowrap rounded-full border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] px-2 py-1 text-xs font-mono text-[color:var(--wf-text-muted)]">
            {children}
        </span>
    );
}

function Steps({ items }: { items: React.ReactNode[] }) {
    return (
        <ol className="ml-5 space-y-2.5 list-decimal marker:text-[color:var(--wf-text-dim)]">
            {items.map((item, i) => (
                <li key={i} className="leading-relaxed pl-1">{item}</li>
            ))}
        </ol>
    );
}

function Bullets({ items }: { items: React.ReactNode[] }) {
    return (
        <ul className="ml-5 space-y-2.5 list-disc marker:text-[color:var(--wf-text-dim)]">
            {items.map((item, i) => (
                <li key={i} className="leading-relaxed pl-1">{item}</li>
            ))}
        </ul>
    );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
    return <p className="pt-1 text-sm font-semibold text-[color:var(--wf-text-strong)]">{children}</p>;
}

function Callout({ children, color = "blue" }: { children: React.ReactNode; color?: "blue" | "amber" | "green" | "red" }) {
    const classes: Record<string, string> = {
        blue: "border-cyan-900/40 bg-cyan-950/20 text-cyan-100",
        amber: "border-amber-900/40 bg-amber-950/20 text-amber-100",
        green: "border-emerald-900/40 bg-emerald-950/20 text-emerald-100",
        red: "border-rose-900/40 bg-rose-950/20 text-rose-100",
    };
    return (
        <div className={`rounded-lg border px-4 py-3 text-sm leading-relaxed ${classes[color]}`}>
            {children}
        </div>
    );
}

function TableWrap({ children }: { children: React.ReactNode }) {
    return <div className="overflow-x-auto rounded-2xl border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)]">{children}</div>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Quest types and components
// ─────────────────────────────────────────────────────────────────────────────

type QuestType = "main" | "side" | "warframe";
type Chapter = { name: string; note: string };
type Quest = {
    name: string;
    type: QuestType;
    note: string;
    chapters?: Chapter[];
    unlocks?: string[];
    keyGate?: string;
};

const TYPE_BADGE_CLASS: Record<QuestType, string> = {
    main: "bg-sky-900/40 text-sky-300 border border-sky-800/50",
    side: "bg-amber-900/40 text-amber-300 border border-amber-800/50",
    warframe: "bg-violet-900/40 text-violet-300 border border-violet-800/50",
};

const TYPE_LABEL: Record<QuestType, string> = {
    main: "Main",
    side: "Side",
    warframe: "Warframe",
};

function QuestBadge({ type }: { type: QuestType }) {
    return (
        <span className={`inline-block shrink-0 rounded px-1.5 py-0.5 text-xs font-mono ${TYPE_BADGE_CLASS[type]}`}>
            {TYPE_LABEL[type]}
        </span>
    );
}

function QuestEntry({ quest, index }: { quest: Quest; index: number }) {
    return (
        <li className="py-3 border-b border-slate-800/40 last:border-0">
            <div className="flex items-start gap-2">
                <span className="text-slate-600 text-xs tabular-nums w-6 shrink-0 text-right mt-0.5">{index}.</span>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-100 text-sm">{quest.name}</span>
                        <QuestBadge type={quest.type} />
                    </div>
                    <p className="mt-1 text-xs text-slate-400 leading-relaxed">{quest.note}</p>
                    {quest.unlocks && quest.unlocks.length > 0 && (
                        <p className="mt-1.5 text-xs text-amber-300/90">
                            <span className="font-semibold">Unlocks: </span>
                            {quest.unlocks.join(", ")}
                        </p>
                    )}
                    {quest.keyGate && (
                        <p className="mt-1.5 text-xs text-sky-300/90">
                            <span className="font-semibold">Key Gate: </span>
                            {quest.keyGate}
                        </p>
                    )}
                    {quest.chapters && (
                        <ul className="mt-2.5 space-y-2 pl-3 border-l border-slate-700/40">
                            {quest.chapters.map((ch, i) => (
                                <li key={i}>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-xs font-medium text-slate-200">{ch.name}</span>
                                        <span className="text-xs text-slate-600">Part {i + 1}</span>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{ch.note}</p>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </li>
    );
}


// ─────────────────────────────────────────────────────────────────────────────
// Unified quest list — in chronological order of availability
// ─────────────────────────────────────────────────────────────────────────────

const QUESTS: Quest[] = [
    {
        name: "Awakening",
        type: "main",
        note: "Opening cinematic; your Tenno awakens from the Reservoir for the first time.",
    },
    {
        name: "Vor's Prize",
        type: "main",
        note: "Tutorial quest teaching movement and combat. Unlocks the full Star Chart and your Orbiter.",
        keyGate: "Unlocks the full Star Chart, your Orbiter, and access to all planet navigation.",
    },
    {
        name: "The Teacher",
        type: "main",
        note: "Introduces Cephalon Simaris and the Synthesis scanner system.",
    },
    {
        name: "Howl of the Kubrow",
        type: "side",
        note: "Unlocks Kubrow companion breeding via the Incubator Segment. Available after completing the Mercury Junction on Venus.",
    },
    {
        name: "A Man of Few Words",
        type: "side",
        note: "Unlocks repeatable weekly Clem missions from Darvo. Visit Darvo in any Relay and select \"What's the job?\" — available as soon as you have Relay access.",
    },
    {
        name: "Saya's Vigil",
        type: "side",
        note: "Unlocks Cetus, the Ostron syndicate, and the Plains of Eidolon open world on Earth. Rewards the Gara Warframe blueprint.",
        keyGate: "Required to access the Plains of Eidolon — necessary for Eidolon hunting later in the game.",
    },
    {
        name: "Vox Solaris",
        type: "main",
        note: "Unlocks the Fortuna hub on Venus and access to the Vox Solaris syndicate.",
        unlocks: ["The Waverider (requires MR 3)"],
    },
    {
        name: "The Waverider",
        type: "warframe",
        note: "Unlocks Yareli; involves completing K-Drive trick challenges in Fortuna. Requires Vox Solaris completion + Mastery Rank 3.",
    },
    {
        name: "Once Awake",
        type: "main",
        note: "Short early quest involving Alad V; unlocks Corpus missions on the Star Chart.",
    },
    {
        name: "Heart of Deimos",
        type: "main",
        note: "Unlocks the Necralisk hub, Cambion Drift open world, and the Entrati syndicate.",
        keyGate: "Begin farming Necramech parts here as soon as possible — a Necramech is required to complete The New War.",
    },
    {
        name: "The Archwing",
        type: "main",
        note: "Awards the Archwing Launcher and unlocks Archwing flight missions.",
        unlocks: ["Stolen Dreams → The New Strange"],
    },
    {
        name: "Stolen Dreams",
        type: "side",
        note: "Unlocks the Arcane Codex system. Directly unlocks The New Strange upon completion.",
        unlocks: ["The New Strange"],
    },
    {
        name: "The New Strange",
        type: "warframe",
        note: "Unlocks Chroma; a multi-tileset investigation with Cephalon Simaris. Requires Stolen Dreams.",
    },
    {
        name: "The Limbo Theorem",
        type: "warframe",
        note: "Unlocks Limbo component blueprints. Available after completing the Jupiter → Europa Junction. Note: the main Limbo blueprint must be purchased from the Market or Cephalon Simaris separately.",
    },
    {
        name: "The Deadlock Protocol",
        type: "warframe",
        note: "Unlocks Protea and the Corpus Ship Railjack tileset. Unlocked as a reward for completing the Saturn Junction. Requires Mastery Rank 4.",
    },
    {
        name: "The Duviri Paradox",
        type: "main",
        note: "Unlocks the Duviri open world, The Circuit game mode, and the Incarnon Genesis weapon system. Can be played early as an alternate entry point (\"Arc 0\") or in story order here.",
    },
    {
        name: "Natah",
        type: "main",
        note: "Investigates the Lotus's true origins; required gate before The Second Dream.",
    },
    {
        name: "The Second Dream",
        type: "main",
        note: "Reveals the Tenno's nature; unlocks Operator mode and the Focus school system. One of the most important story milestones.",
        keyGate: "Unlocks your Operator, Void Dash, Amp crafting via the Quills, and the Focus school system. Required before Eidolon hunting.",
        unlocks: ["Octavia's Anthem", "The Silver Grove"],
    },
    {
        name: "Octavia's Anthem",
        type: "warframe",
        note: "Unlocks Octavia; features a unique music-composition puzzle in the Orokin Moon. Requires The Second Dream.",
    },
    {
        name: "The Silver Grove",
        type: "warframe",
        note: "Unlocks Titania; introduces Apothic crafting and Silver Grove Specter encounters. Requires The Second Dream.",
    },
    {
        name: "Mask of the Revenant",
        type: "warframe",
        note: "Unlocks Revenant; set primarily on the Plains of Eidolon at night. Requires reaching Rank 2 (Observer) with The Quills syndicate, earned by hunting Eidolons and turning in Eidolon Shards.",
    },
    {
        name: "The War Within",
        type: "main",
        note: "Expands Operator Transference abilities and unlocks the Kuva Fortress, Sorties, and Kuva Siphons.",
        keyGate: "Unlocks Sorties, Kuva Siphons, the Kuva Fortress, and the Kuva Lich nemesis system.",
        unlocks: ["The Glast Gambit"],
    },
    {
        name: "The Glast Gambit",
        type: "warframe",
        note: "Unlocks Nidus; set in the Infested Salvage tileset. Requires The War Within.",
    },
    {
        name: "Sands of Inaros",
        type: "warframe",
        note: "Unlocks Inaros; requires a special vessel purchased from Baro Ki'Teer (100 Ducats + 25,000 Credits) or the Market bundle. Baro visits relays every two weeks — plan ahead. Requires Mastery Rank 5.",
    },
    {
        name: "Hidden Messages",
        type: "warframe",
        note: "Unlocks Mirage component blueprints by solving riddles hidden in Warframe's Codex entries. Requires the Eris → Sedna Junction. The main Mirage blueprint must be purchased from the Market separately.",
    },
    {
        name: "Patient Zero",
        type: "side",
        note: "Unlocks the Mutalist Alad V boss fight on Eris, whose assassination node drops Mesa's Neuroptics blueprint. Requires the Pluto → Eris Junction.",
    },
    {
        name: "The Jordas Precept",
        type: "warframe",
        note: "Unlocks Atlas; an Archwing-heavy quest ending in the Jordas Golem assassination. Requires the Pluto → Eris Junction and an Archwing.",
    },
    {
        name: "Rising Tide",
        type: "main",
        note: "Build your personal Railjack ship in a Clan Dojo Dry Dock.",
        keyGate: "A Railjack is required to complete The New War and Call of the Tempestarii. Build this early.",
    },
    {
        name: "Call of the Tempestarii",
        type: "warframe",
        note: "Unlocks Sevagoth; a major Railjack story quest. Requires The Deadlock Protocol + a Railjack (Rising Tide) + Mastery Rank 4.",
    },
    {
        name: "Chains of Harrow",
        type: "main",
        note: "Unlocks Harrow; set aboard an Infested prison ship on the Defection tileset.",
    },
    {
        name: "Apostasy Prologue",
        type: "main",
        note: "Short cinematic quest bridging The War Within and The Sacrifice storylines.",
    },
    {
        name: "The Sacrifice",
        type: "main",
        note: "Unlocks Excalibur Umbra and the Skiajati nikana; a major emotional turning point in the story.",
    },
    {
        name: "Prelude to War",
        type: "main",
        note: "Three-chapter quest series that directly leads into The New War. All three parts must be completed before The New War unlocks.",
        keyGate: "Chimera Prologue unlocks all Lua and Kuva Fortress Star Chart nodes. Completing all three chapters unlocks The New War.",
        chapters: [
            { name: "Chimera Prologue", note: "Adds the Ropalolyst assassination node to Jupiter. Also unlocks Lua and Kuva Fortress nodes on the Star Chart — needed for Steel Path completion." },
            { name: "Erra", note: "The Sentient invasion escalates; the Lotus's true allegiance is brought into question." },
            { name: "The Maker", note: "Final chapter of Prelude to War. Completing this unlocks The New War." },
        ],
    },
    {
        name: "The New War",
        type: "main",
        note: "Feature-length cinematic quest requiring both a Railjack and a Necramech. Unlocks Kahl-175 weekly missions and all post-New-War content.",
        keyGate: "Requires a Railjack (Rising Tide) and a Necramech (Isolation Vaults on Deimos). Build both well before attempting this quest.",
        unlocks: ["Angels of the Zariman", "Veilbreaker", "Jade Shadows"],
    },
    {
        name: "Veilbreaker",
        type: "side",
        note: "Unlocks Kahl-175 weekly missions and the Kahl mission hub. Requires The New War.",
    },
    {
        name: "Angels of the Zariman",
        type: "main",
        note: "Unlocks the Chrysalith hub, the Holdfasts syndicate, and Zariman tileset missions.",
    },
    {
        name: "Jade Shadows",
        type: "main",
        note: "Unlocks Jade Warframe; set in the aftermath of The New War.",
    },
    {
        name: "Whispers in the Walls",
        type: "main",
        note: "Unlocks the Sanctum Anatomica hub on Deimos and the Cavia syndicate.",
    },
    {
        name: "The Lotus Eaters",
        type: "main",
        note: "Direct story continuation following the events of Whispers in the Walls.",
    },
    {
        name: "The Hex",
        type: "main",
        note: "Unlocks Höllvania (the 1999 open world), The Hex syndicate, and the Technocyte Coda adversary system.",
    },
    {
        name: "The Old Peace",
        type: "main",
        note: "Most recent main story quest (Update 41, December 2025).",
    },
];


// ─────────────────────────────────────────────────────────────────────────────
// Quest order section — owns its own filter state
// ─────────────────────────────────────────────────────────────────────────────

function QuestOrderSection() {
    const [filter, setFilter] = useState<"all" | QuestType>("all");

    const counts = {
        all: QUESTS.length,
        main: QUESTS.filter((q) => q.type === "main").length,
        side: QUESTS.filter((q) => q.type === "side").length,
        warframe: QUESTS.filter((q) => q.type === "warframe").length,
    };

    const filterBtnCls = (f: "all" | QuestType) =>
        f === filter
            ? "shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold border border-slate-500 bg-slate-700 text-slate-100 transition-colors"
            : "shrink-0 rounded-md px-3 py-1.5 text-xs font-medium border border-slate-700/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors";

    return (
        <>
            {/* Legend */}
            <div className="flex flex-wrap gap-2 text-xs">
                <span className={`rounded px-2 py-1 font-mono ${TYPE_BADGE_CLASS.main}`}>Main — primary storyline</span>
                <span className={`rounded px-2 py-1 font-mono ${TYPE_BADGE_CLASS.side}`}>Side — unlocks systems & hubs</span>
                <span className={`rounded px-2 py-1 font-mono ${TYPE_BADGE_CLASS.warframe}`}>Warframe — rewards a specific Warframe</span>
            </div>

            {/* Filter buttons */}
            <div className="flex flex-wrap gap-2">
                <button onClick={() => setFilter("all")}      className={filterBtnCls("all")}>All ({counts.all})</button>
                <button onClick={() => setFilter("main")}     className={filterBtnCls("main")}>Main ({counts.main})</button>
                <button onClick={() => setFilter("side")}     className={filterBtnCls("side")}>Side ({counts.side})</button>
                <button onClick={() => setFilter("warframe")} className={filterBtnCls("warframe")}>Warframe ({counts.warframe})</button>
            </div>

            {/* Quest list — global index always preserved so position-in-story is visible */}
            <ol className="list-none m-0 p-0">
                {QUESTS.map((q, i) =>
                    filter === "all" || q.type === filter
                        ? <QuestEntry key={q.name} quest={q} index={i + 1} />
                        : null
                )}
            </ol>
        </>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section definitions
// ─────────────────────────────────────────────────────────────────────────────

type Section = {
    id: string;
    title: string;
    summary: string;
    content: React.ReactNode;
};

const SECTIONS: Section[] = [
    {
        id: "quest-order",
        title: "Quest Order",
        summary: "All quests in chronological order of availability — main, side, and Warframe quests woven together.",
        content: <QuestOrderSection />,
    },
    {
        id: "lich-sisters",
        title: "Nemesis Systems",
        summary: "Kuva Liches, Sisters of Parvos, and Technocyte Codas — personal nemesis enemies holding unique weapon variants.",
        content: (
            <>
                <P>
                    Warframe has three nemesis systems. Each lets you hunt a personal enemy, decode their
                    weaknesses, then choose to <B>Vanquish</B> them (claim their weapon/reward) or{" "}
                    <B>Convert</B> them (make them a mission ally). All three share this core loop but
                    differ significantly in how you crack their defenses.
                </P>

                <SectionHeading>Kuva Lich (Grineer)</SectionHeading>
                <Steps items={[
                    "Run a Grineer Exterminate mission on the Star Chart. A Larvling will spawn — down them and Mercy-kill with your Parazon. The weapon they carry is shown before you confirm, so choose carefully if farming a specific weapon.",
                    "Farm Murmurs by running missions inside their territory until three Requiem hints are revealed.",
                    "Equip the three matching Requiem mods on your Parazon in the correct order. When the Lich appears in a mission, let them downed you once to reveal if a slot is wrong.",
                    "Once the full order is confirmed, Vanquish (gain the weapon) or Convert (make them an ally you can trade).",
                ]} />

                <SectionHeading>Sister of Parvos (Corpus)</SectionHeading>
                <P>
                    Functionally identical to the Kuva Lich loop above, but created from Corpus missions.
                    Find a Candidate, Mercy-kill them to spawn the Sister, then use the same Requiem murmur
                    system to discover the correct 3-mod order. Sisters carry Tenet weapons instead of Kuva weapons.
                </P>
                <Callout>
                    <B>Oull</B> is a wildcard Requiem mod that fills any unknown slot — useful when you
                    have two slots confirmed. <B>Warning:</B> a wrong stab permanently increases your
                    Lich/Sister's level, making future missions harder.
                </Callout>

                <SectionHeading>Technocyte Coda (Höllvania / 1999)</SectionHeading>
                <P>
                    Unlocked after completing <B>The Hex</B>. The Coda is an Infested boy band — five
                    members named Zeke, Drillbit, Harddrive, DJ RoM, and Packet. Requires Mastery Rank 5
                    and no currently active Lich or Sister.
                </P>
                <Steps items={[
                    "In a Höllvania Exterminate, Hell-Scrubs, or Legacyte mission, a Techrot enemy drops a unique item. Pick it up and carry it to a virus-riddled PC in the mission to run \"Technocyte-Coda.exe\". Complete the hacking puzzle to spawn your Coda.",
                    "You can extract immediately after creation — you do not need to finish the mission.",
                    "Farm Antivirus Mods from Techrot Bounties at Höllvania Mall. There are 8 total. Unlike Requiem mods, you only need 1 correct mod equipped in any of your 3 slots — position does not matter.",
                    "Confront your Coda in Höllvania missions (overtaken nodes glow green). Each encounter is a \"duet\" — two random members of the band fight you together.",
                    "Each successful stab adds 5% to the Malware Disinfection bar (up to 35% with Potency Mods). Failing a stab has no penalty — just no progress.",
                    "Once the bar reaches 100%, the Coda flees to Earth Proxima for a final Railjack Empyrean Skirmish showdown.",
                    "Vanquish (earn resources to buy Coda weapons from Eleanor) or Convert (ally or trade at Crimson Branch in the Dojo).",
                ]} />
                <TableWrap>
                    <table className="w-full text-xs min-w-[480px]">
                        <thead className="bg-slate-900/60">
                            <tr>
                                <th className="text-left px-3 py-2.5 text-slate-300">Feature</th>
                                <th className="text-left px-3 py-2.5 text-slate-300">Kuva Lich / Sister</th>
                                <th className="text-left px-3 py-2.5 text-slate-300">Technocyte Coda</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                ["Mod system", "3 Requiem mods, correct order required", "1 of 8 Antivirus mods, any slot"],
                                ["Fail penalty", "Nemesis permanently levels up", "No penalty — just no progress"],
                                ["Passive effect", "Taxes resources from influenced nodes", "Cosmetic Technocyte Cyst on your Warframes"],
                                ["Final fight", "Ground mission in Proxima space", "Railjack Empyrean Skirmish"],
                                ["Weapon source", "Drops directly on Vanquish", "Resource from Vanquish → buy from Eleanor"],
                            ].map(([f, ks, tc]) => (
                                <tr key={f} className="border-t border-slate-800/60">
                                    <td className="px-3 py-2 font-semibold text-slate-200">{f}</td>
                                    <td className="px-3 py-2 text-slate-400">{ks}</td>
                                    <td className="px-3 py-2 text-slate-300">{tc}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </TableWrap>
            </>
        ),
    },
    {
        id: "kuva",
        title: "Kuva",
        summary: "Kuva Siphons, Floods, and Guardians — how to destroy the braid, strip Guardian armor, and farm this resource efficiently.",
        content: (
            <>
                <P>
                    <B>Kuva</B> is a resource used to reroll <B>Riven mods</B> (each reroll costs
                    increasing amounts). It is obtained by destroying Kuva Siphons and Kuva Floods, or
                    passively from certain missions. Requires completing <B>The War Within</B> and
                    reaching <B>Mastery Rank 5</B> to access Siphon missions.
                </P>

                <SectionHeading>Kuva Siphons and Floods — where they spawn</SectionHeading>
                <P>
                    Kuva Siphon missions appear on <B>up to two planets nearest the Kuva Fortress</B> as
                    it drifts around the Star Chart. Up to six Siphon missions rotate across those two
                    planets. <B>Five</B> of them are standard Siphons (enemy level 25–35, ~550–700 Kuva).
                    The <B>sixth is always a Kuva Flood</B> (enemy level 80–100, ~1,100–1,400 Kuva) —
                    same mechanic, much harder enemies.
                </P>

                <SectionHeading>Destroying a Kuva Siphon — step by step</SectionHeading>
                <P>
                    The Siphon is a secondary objective layered on top of the normal mission. It has
                    four <B>Braids</B> that must be destroyed. A meter under your minimap tracks how
                    many braids you've destroyed.
                </P>
                <Steps items={[
                    <>
                        Locate the Siphon (marked by a special Kuva icon; nearby rooms gain a reddish-pink
                        hue). Approaching it triggers an activation horn and spawns <B>Kuva Guardians</B>{" "}
                        and Kuva Jesters to defend it.
                    </>,
                    <>
                        Wait for the Siphon to raise one of its Braids and begin attracting a{" "}
                        <B>Kuva cloud</B> (a dark red-black mass with a distinctive shrieking noise).
                        The raised Braid points toward the incoming cloud — use that to locate it.
                    </>,
                    <>
                        Switch to <B>Operator mode</B> (Transference) and either{" "}
                        <B>Void Dash through the cloud</B> or <B>shoot it with your Amp</B> to
                        destroy that Braid. You need to do this for all <B>4 Braids</B>.
                    </>,
                    <>
                        <B>Caution:</B> The Siphon also has a row of 8 diamonds under your minimap.
                        Each time the Siphon successfully absorbs a cloud before you intervene, one
                        diamond turns red. If it absorbs <B>8 clouds</B> it escapes — you only receive
                        partial Kuva (up to 350, based on braids already destroyed). Destroy braids
                        quickly to prevent this.
                    </>,
                    "After all 4 Braids are destroyed the Siphon explodes — every squad member receives the Kuva reward automatically.",
                ]} />
                <Callout color="blue">
                    <B>Tip:</B> Your Amp range is good — you don't need to be adjacent to the cloud.
                    Void Dash is faster if you can path straight through it. You receive the same Kuva
                    reward regardless of how many clouds the Siphon managed to absorb while it was active,
                    as long as you destroy all 4 Braids before it escapes.
                </Callout>

                <SectionHeading>Kuva Guardians — how to damage them</SectionHeading>
                <P>
                    Kuva Guardians are heavy Grineer units carrying a Kuva-infused <B>Kesheg</B> (polearm).
                    While they are holding this weapon they are <B>completely immune to all conventional
                    damage and crowd control</B>. You must disarm them first.
                </P>
                <Steps items={[
                    <>
                        Switch to <B>Operator mode</B> (Transference). Use <B>Void Sling</B> — hold
                        Crouch and press Jump, or press Jump while in mid-air — to knock the Kesheg
                        out of their hands. The Guardian will briefly stagger.
                    </>,
                    "Return to your Warframe and kill the Guardian normally with weapons while it is disarmed.",
                ]} />
                <Callout color="amber">
                    <B>Common mistake:</B> Shooting Kuva Guardians before disarming them — all damage
                    is absorbed. The disarm is Void Sling (the midair/crouched jump), not Void Blast.
                    If a Guardian re-arms itself, you need to Void Sling them again.
                </Callout>

                <SectionHeading>Kuva Farming Summary</SectionHeading>
                <Bullets items={[
                    <><B>Taveuni</B> (Kuva Fortress, Survival) — best dedicated farm; Kuva scales with time spent.</>,
                    <><B>Kuva Floods</B> — 1,100–1,400 Kuva per completion; level 80–100 enemies. One always active near the Fortress.</>,
                    <><B>Kuva Siphons</B> — 550–700 Kuva per completion; level 25–35, faster runs.</>,
                    <><B>Steel Path (any node)</B> — flat 2,000 Kuva bonus added to every mission completion.</>,
                    <><B>Daily Sortie</B> — can reward Kuva as a completion bonus.</>,
                ]} />
            </>
        ),
    },
    {
        id: "eidolons",
        title: "Eidolon Hunting",
        summary: "Hunting the three Eidolons on the Plains of Eidolon is the primary way to earn Arcanes and Quills Standing.",
        content: (
            <>
                <P>
                    Eidolons are massive boss creatures that roam the Plains of Eidolon (Earth) only at
                    night. A full day/night cycle lasts about 50 real-time minutes; the huntable night
                    window is roughly 9 minutes — efficiency matters a lot.
                </P>

                <SectionHeading>Requirements before you start:</SectionHeading>
                <Steps items={[
                    "Complete The Second Dream to unlock your Operator.",
                    "Build an Amp — the default Mote Amp is very weak. Upgrade via The Quills syndicate in Cetus as soon as possible. The Amp is your primary tool for stripping Eidolon shields.",
                ]} />
                <SectionHeading>Helpful but not required:</SectionHeading>
                <Bullets items={[
                    "Bring a support Warframe. Trinity (energy restore + shield drain prevention), Harrow (damage buff + critical chance + shield regen lock), and Wisp (healing + speed buff) are the most common picks — but any Warframe can technically hunt Eidolons.",
                    "Madurai Focus school gives a bonus Amp damage buff after exiting Void Mode, making shield-stripping faster. Zenurik is a solid alternative if you need the energy sustain. Neither is mandatory.",
                ]} />

                <SectionHeading>Lure mechanics — the most confusing part for new hunters:</SectionHeading>
                <P>
                    Capturing an Eidolon (rather than killing it) is required to spawn the next Eidolon
                    in the chain and to earn Brilliant Eidolon Shards. Lures are what make a capture possible.
                </P>
                <Steps items={[
                    <>Locate a Lure on the Plains — they are <B>small floating machines</B> that drift around the field at night. They appear marked on the minimap.</>,
                    <>Destroy the Lure (shoot it until its health reaches zero), then <B>hack it</B> to take control of it. It will then follow you.</>,
                    <>Find Vomvalysts — the small, floating Eidolon fragments that drift around the Plains. Shoot them near your Lure until they transition into their spectral (ghost) form, at which point the Lure will automatically absorb them.</>,
                    <>After absorbing roughly 3 Vomvalysts, the <B>Lure icon on your HUD shifts from yellow to blue</B>, indicating it is fully charged. The Lure itself does not visually change — watch the icon.</>,
                    <>Take a charged (blue) Lure next to the Eidolon and position it near a Synovia (weak point / glowing joint) that you have already destroyed. The Lure will tether to it, preventing the Eidolon from regenerating that limb's shield.</>,
                    "Repeat with additional Lures until all Synovias are destroyed and the required number of charged Lures are attached, then deliver the killing blow with your Operator Amp to trigger a capture.",
                ]} />
                <Callout color="amber">
                    You need <B>2 fully charged Lures</B> attached to capture the Teralyst, and <B>3 fully charged Lures</B>{" "}
                    for both the Gantulyst and Hydrolyst. Running into a fight without pre-charged Lures
                    is the number-one cause of failed captures. Charge them before the Eidolon spawns.
                </Callout>

                <SectionHeading>Kill order and chain progression:</SectionHeading>
                <Steps items={[
                    "Teralyst (Terry) — easiest. Capturing it drops Eidolon Shards. Take those Shards to the Altar at Gara Toht Lake and use them to summon the next Eidolon.",
                    "Gantulyst (Gary) — harder. Summoned at the Altar using Teralyst Shards. Capturing it drops Greater Shards used to summon the Hydrolyst at the same Altar.",
                    "Hydrolyst (Harry) — hardest. Summoned at the Altar using Gantulyst Shards. Drops the best rewards and Arcanes.",
                ]} />
                <P>
                    For each Eidolon: use <B>Void damage</B> (Operator Amp) to strip its rotating shield,
                    then switch to your primary weapon to destroy the glowing <B>Synovias</B> before the
                    shield comes back. Shields regenerate quickly unless you have a Trinity or Harrow
                    suppressing it.
                </P>
                <Callout>
                    <B>Brilliant Eidolon Shards</B> only drop from <B>captures</B>, not kills. They are
                    specifically needed for purchasing Way-Bound passive nodes in your Focus school — so
                    always aim to capture rather than just kill Eidolons.
                </Callout>
            </>
        ),
    },
    {
        id: "steel-path",
        title: "Steel Path",
        summary: "A harder replay of every Star Chart mission. Requires clearing the full Star Chart first.",
        content: (
            <>
                <P>
                    <B>Steel Path</B> adds +100 to enemy level scaling and +150% to enemy health, armor,
                    and shields (making them 2.5× as tough). It unlocks by completing every node on the
                    Star Chart that was accessible before The New War (Zariman, Deimos labs, and Höllvania
                    nodes are not required).
                </P>

                <SectionHeading>Commonly missed nodes that block Steel Path unlock:</SectionHeading>
                <Bullets items={[
                    <>
                        <B>Lua nodes</B> — only become available after completing Chimera Prologue (part of Prelude to War). Very easy to miss if you delay that quest.
                    </>,
                    <>
                        <B>Kuva Fortress nodes</B> — same unlock condition as Lua (requires Chimera Prologue).
                    </>,
                    <>
                        <B>Ropalolyst (Jupiter)</B> — quest-locked assassination node, also unlocked by Chimera Prologue.
                    </>,
                    <>
                        <B>Tyana Pass (Mars)</B> — a quest-locked node many players skip past without realizing.
                    </>,
                    <>
                        <B>Oro (Earth, Vay Hek assassination)</B> — requires Mastery Rank 5 to access.
                    </>,
                    <>
                        <B>Saya's Visions (Earth)</B> — node tied to the Plains of Eidolon, unlocked via Saya's Vigil.
                    </>,
                    <>
                        <B>Deepmines (Venus)</B> — cave network bounties added in Update 40. A bug previously caused these to incorrectly block Steel Path unlock, patched in Hotfix 38.5.3. They are not confirmed to be a hard blocker currently, but players going for full Venus completion on Steel Path will still need to complete these bounties. If Venus shows incomplete, check with <B>Nightcap</B> in Fortuna.
                    </>,
                ]} />
                <Callout color="amber">
                    Speak to <B>Teshin</B> in any Relay and select "Steel Path?" — he will list every
                    node you're still missing and why. Use this before hunting manually.
                </Callout>

                <SectionHeading>Unique Steel Path rewards:</SectionHeading>
                <Bullets items={[
                    "Steel Essence — primary currency, earned from missions and Teshin's weekly Steel Path Honors rotation.",
                    "Arcane Adapters — bought from Teshin's shop using Steel Essence.",
                    "Flat 2,000 Kuva per mission completion on any node — efficient passive Kuva farming.",
                    "Acolytes — elite enemies that spawn randomly during missions, drop Steel Essence on kill, and have fixed elemental weaknesses.",
                ]} />
            </>
        ),
    },
    {
        id: "railjack",
        title: "Railjack",
        summary: "Space-combat mode. Requires building your own Railjack ship in a Clan Dojo Dry Dock.",
        content: (
            <>
                <P>
                    <B>Railjack</B> is Warframe's space-combat system. You pilot a large ship through a
                    mission area, destroying Corpus or Grineer objectives while boarding enemy crewships
                    on foot.
                </P>
                <SectionHeading>Getting started:</SectionHeading>
                <Steps items={[
                    "Join a Clan with a Dry Dock, or build your own Dry Dock room in your Clan Dojo.",
                    "Complete the Rising Tide quest — it provides all the Railjack component blueprints you need.",
                    "Build the Fuselage, Propulsion, and Hull sections, then combine them in the Dry Dock.",
                    "Upgrade components and weapons as you complete missions and earn wreckage drops.",
                ]} />
                <P>
                    You can join public Railjack missions as a crew member without owning a ship — just
                    enter any Railjack node from the Star Chart and select a public squad.
                </P>
                <Callout>
                    <B>Call of the Tempestarii</B> and <B>The New War</B> both require a Railjack.
                    Complete Rising Tide early so you're not scrambling before those quests.
                </Callout>
            </>
        ),
    },
    {
        id: "necramech",
        title: "Necramech Acquisition",
        summary: "A combat mech required for The New War. Parts drop from Isolation Vaults on Deimos.",
        content: (
            <>
                <P>
                    <B>Necramechs</B> are heavy combat mechs piloted by your Operator. Two variants exist:
                    Voidrig (offense/turret) and Bonewidow (defense/melee). Either satisfies The New War requirement.
                </P>
                <SectionHeading>Building one from parts:</SectionHeading>
                <Steps items={[
                    "Complete Heart of Deimos to unlock the Necralisk and Cambion Drift.",
                    "Reach Entrati Standing Rank 2 (Stranger) to unlock Isolation Vault bounties.",
                    "Run Isolation Vault bounties — Necramech component parts drop from vault enemies and the Jugulus boss.",
                    "Purchase the main Necramech blueprint from Father (Entrati vendor in the Necralisk).",
                    "Build the Systems, Carapace, Capsule, and Engine components, then assemble the main blueprint. Note: Orokin Matrix (required) only drops from Tier 3 Isolation Vaults.",
                ]} />
                <Callout color="amber">
                    <B>Many players recommend buying your first Necramech with Platinum</B> rather than
                    farming all the parts — it can take a very long time to collect everything, and The
                    New War is gated behind having one. A practical approach is to sell unneeded Prime
                    parts, mods, or Rivens on <B>warframe.market</B> to earn the Platinum needed to
                    simply buy one from the in-game Market. For players with limited time, this is often
                    the most efficient path forward.
                </Callout>
            </>
        ),
    },
    {
        id: "focus",
        title: "Focus Schools",
        summary: "Passive ability trees for your Operator unlocked after The Second Dream. Choose your primary school early.",
        content: (
            <>
                <P>
                    There are five Focus schools, each giving different passive bonuses to your Operator
                    and Warframe. Focus points are earned <B>passively in every mission</B> via{" "}
                    <B>Focus Lenses</B> — items installed on Warframes or weapons that convert a percentage
                    of earned Affinity into Focus points for the lens's school.
                </P>
                <SectionHeading>How Focus is earned</SectionHeading>
                <Bullets items={[
                    <>Install a <B>Focus Lens</B> on a Warframe or weapon. The school of the lens determines which Focus school receives points. Each item can only hold one lens.</>,
                    <>Affinity earned from <B>Warframe-power kills</B> (100% to the Warframe) is fully converted through the Warframe's lens.</>,
                    <>Affinity from <B>weapon kills</B> is split 50% to the weapon and 50% to the Warframe. If the Warframe has no lens, the 50% going to it is wasted.</>,
                    <>Affinity from <B>ally kills</B> is split 25% to the Warframe and 75% shared among all equipped weapons. Rank-30 weapons without a lens waste their share.</>,
                    <>
                        <B>Convergence Orbs</B> — glowing <B>yellow</B> pickups that spawn periodically (only while you have a Lens equipped). Picking one up instantly grants <B>5,000 Focus</B> to your active school and applies a <B>10× Focus multiplier</B> for up to <B>45 seconds</B> — or until you die or hit the daily cap, whichever comes first. The orb despawns if not collected within 1 minute; a summary is displayed when the buff expires.
                    </>,
                    <><B>Daily cap:</B> 250,000 Focus points, scaling up by 5,000 per Mastery Rank. Resets at 00:00 UTC.</>,
                    <>
                        <B>Eidolon Shards</B> can also be converted to Focus directly in the Focus Trees menu — these conversions are <B>not limited by the daily cap</B>:
                        <span className="block mt-1.5 ml-3 space-y-0.5 text-slate-400">
                            <span className="block">Eidolon Shard → 2,500 Focus</span>
                            <span className="block">Synthetic Eidolon Shard → 5,000 Focus</span>
                            <span className="block">Brilliant Eidolon Shard → 25,000 Focus</span>
                            <span className="block">Radiant Eidolon Shard → 40,000 Focus</span>
                        </span>
                    </>,
                ]} />
                <Callout color="blue">
                    <B>Tip:</B> Equip lenses on your most-used Warframe and primary weapon first. A lens on a Rank-30 weapon means all ally-kill affinity going to that weapon slot is converted rather than wasted.
                </Callout>
                <TableWrap>
                    <table className="w-full text-xs min-w-[420px]">
                        <thead className="bg-slate-900/60">
                            <tr>
                                <th className="text-left px-3 py-2.5 text-slate-300">School</th>
                                <th className="text-left px-3 py-2.5 text-slate-300">Identity</th>
                                <th className="text-left px-3 py-2.5 text-slate-300">Key Passive</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                ["Zenurik", "Energy / caster", "Energizing Dash — Void Dash restores Warframe energy over time"],
                                ["Vazarin", "Healing / support", "Protective Sling — Void Sling through allies heals them and grants brief invulnerability"],
                                ["Naramon", "Combo / melee", "Power Spike — melee combo counter decays slowly instead of resetting"],
                                ["Unairu", "Armor strip / survival", "Caustic Strike — radial armor strip on Void Blast"],
                                ["Madurai", "Amp damage / Eidolons", "Phoenix Talons — Amp damage bonus after exiting Void Mode"],
                            ].map(([school, identity, passive]) => (
                                <tr key={school} className="border-t border-slate-800/60">
                                    <td className="px-3 py-2 font-semibold text-slate-100">{school}</td>
                                    <td className="px-3 py-2 text-slate-400">{identity}</td>
                                    <td className="px-3 py-2 text-slate-300">{passive}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </TableWrap>
                <P>
                    Each school has two <B>Way-Bound</B> passives that remain active permanently even after
                    switching to a different school. Once unlocked, they benefit all schools.
                </P>
                <TableWrap>
                    <table className="w-full text-xs min-w-[500px]">
                        <thead className="bg-slate-900/60">
                            <tr>
                                <th className="text-left px-3 py-2.5 text-slate-300">School</th>
                                <th className="text-left px-3 py-2.5 text-slate-300">Way-Bound 1</th>
                                <th className="text-left px-3 py-2.5 text-slate-300">Way-Bound 2</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                ["Zenurik", "Void Flow — increases Operator Void Energy capacity", "Temporal Step — grants an additional Void Sling charge"],
                                ["Vazarin", "Protective Sling — ally heal and invulnerability on Void Sling", "Rejuvenating Tides — Operator health regenerates faster after damage"],
                                ["Naramon", "Shadow Step — Void Sling briefly cloaks your Warframe", "Surging Dash — Void Sling adds to Melee Combo Counter"],
                                ["Unairu", "Stone Skin — increases Operator armor while not in Void Mode", "Poise — Operator becomes immune to knockdown"],
                                ["Madurai", "Phoenix Penumbra — entering Void Mode briefly cloaks your Warframe", "Swift Specter — Specters summon faster and last longer"],
                            ].map(([school, wb1, wb2]) => (
                                <tr key={school} className="border-t border-slate-800/60">
                                    <td className="px-3 py-2 font-semibold text-slate-100">{school}</td>
                                    <td className="px-3 py-2 text-slate-300">{wb1}</td>
                                    <td className="px-3 py-2 text-slate-300">{wb2}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </TableWrap>
                <Callout>
                    <B>Brilliant Eidolon Shards are only required for Way-Bound node purchases</B> — regular
                    school progression uses Focus points earned in-mission. Prioritize capturing (not just
                    killing) Eidolons to stockpile Brilliant Shards specifically for Way-Bound unlocks.
                </Callout>
                <P>
                    <B>Zenurik</B> is the most universally useful school for beginners — free energy
                    removes dependence on Energy Pads. <B>Madurai</B> is essential for serious Eidolon
                    hunting. Unlock Way-Bounds from multiple schools over time as they stack permanently.
                </P>
            </>
        ),
    },
    {
        id: "farming",
        title: "Common Farming Strategies",
        summary: "Best nodes for resources, and which Warframes make loot farming dramatically more efficient.",
        content: (
            <>
                <SectionHeading>Farming Warframes & required mods:</SectionHeading>
                <P>
                    These Warframes have abilities that cause enemies to drop additional loot. Combining
                    two or more in a squad multiplies yield significantly.
                </P>
                <Bullets items={[
                    <>
                        <B>Nekros</B> — <Tag>Desecrate</Tag> (innate ability, no augment needed) forces
                        dead enemies to drop additional loot. Keep him in range of corpses.
                        Key mods: <Tag>Stretch</Tag> / <Tag>Overextended</Tag> for range so Desecrate
                        reaches more bodies, <Tag>Equilibrium</Tag> to convert health orbs into energy
                        so he never runs out.
                    </>,
                    <>
                        <B>Hydroid</B> — <Tag>Pilfering Swarm</Tag> augment mod (from Steel Meridian or
                        Red Veil syndicates) makes Tentacle Swarm drop extra loot from grabbed enemies.
                        Key mods: <Tag>Pilfering Swarm</Tag> (required), <Tag>Stretch</Tag> /{" "}
                        <Tag>Overextended</Tag> for tentacle reach, <Tag>Streamline</Tag> /{" "}
                        <Tag>Fleeting Expertise</Tag> for energy efficiency.
                    </>,
                    <>
                        <B>Khora</B> — <Tag>Pilfering Strangledome</Tag> augment mod (from New Loka or
                        Red Veil syndicates) gives Strangledome a chance to double enemy loot drops.
                        Generally considered the strongest loot Warframe.
                        Key mods: <Tag>Pilfering Strangledome</Tag> (required), <Tag>Stretch</Tag> /{" "}
                        <Tag>Overextended</Tag> for dome size, duration mods to keep it active longer.
                    </>,
                    <>
                        <B>Smeeta Kavat</B> (companion) — the <Tag>Charm</Tag> mod randomly doubles all
                        resource pickups for 30 seconds. Stacks with Nekros/Hydroid/Khora and Resource
                        Boosters. One of the most impactful farming companions in the game.
                    </>,
                ]} />
                <Callout color="green">
                    <B>Optimal stack:</B> Nekros + Khora (or Hydroid) in the same squad + Smeeta Kavat
                    + an active Resource Booster. Run any high-density survival or defense node and
                    kills will yield dramatically more loot per run.
                </Callout>

                <SectionHeading>Prime Relics by tier:</SectionHeading>
                <Bullets items={[
                    "Lith — Hepit (Void, Capture): fastest Lith farm. Everest (Earth, Excavation) for variety.",
                    "Meso — Io (Jupiter, Defense): popular leveling node. Ukko (Void, Capture) for quick solo runs.",
                    "Neo — Hydron (Sedna, Defense): go-to XP and Neo node. Xini (Eris, Interception) drops both Neo and Axi.",
                    "Axi — Mot (Void, Survival), Apollo (Lua, Disruption), Xini (Eris, Interception).",
                ]} />

                <SectionHeading>Credits:</SectionHeading>
                <Bullets items={[
                    "Neso (Neptune, The Index) — ~200k per high-risk run; the standard credit farm.",
                    "Profit-Taker Phase 4 (Orb Vallis) — large credit payout plus Toroid drops. Requires Vox Solaris rank 4.",
                ]} />

                <SectionHeading>Endo (mod leveling):</SectionHeading>
                <Bullets items={[
                    "Arbitrations — rotating endless missions with scaling Endo rewards.",
                    "Apollo (Lua, Disruption) — consistent Endo and good relic cracking simultaneously.",
                    "Vodyanoi (Sedna, Interception, Steel Path) — fastest Endo/hour, requires Steel Path.",
                ]} />

                <SectionHeading>Kuva (Riven rerolling):</SectionHeading>
                <Bullets items={[
                    "Taveuni (Kuva Fortress, Survival) — the primary dedicated Kuva farm.",
                    "Kuva Floods — 1,200 Kuva each; found on rotating Grineer nodes.",
                    "Kuva Siphons — 550 Kuva each; lower time per run.",
                    "Steel Path (any node) — flat 2,000 Kuva added to every mission completion.",
                ]} />

                <SectionHeading>Common resources:</SectionHeading>
                <Bullets items={[
                    "Plastids — Ophelia (Uranus), Piscinas (Saturn), Memphis (Phobos). All Survival.",
                    "Neurodes — Tikal (Earth, Excavation), Magnacidium (Deimos, Survival).",
                    "Neural Sensors — Io or Sinai (Jupiter, Defense), Elara (Jupiter, Survival).",
                    "Orokin Cells — Gabii (Ceres, Survival), Seimeni (Ceres, Defense), Titan (Saturn, Survival).",
                    "Argon Crystal — Oxomoco (Void, Exterminate) or Marduk (Void, Sabotage). Argon decays after ~24h real-time — farm just before you need it.",
                    "Polymer Bundle — Ophelia or Assur (Uranus, Survival).",
                    "Nano Spores — Ophelia (Uranus), or any Deimos/Eris survival node.",
                ]} />
            </>
        ),
    },
    {
        id: "rotations",
        title: "Mission Rotations",
        summary: "How reward rotations work in endless missions — the AABC cycle, when each rotation fires, and the special rules for Disruption and Arbitrations.",
        content: (
            <>
                <P>
                    Most <B>endless missions</B> (Defense, Survival, Interception, etc.) award a reward
                    at a regular interval. These rewards follow an <B>AABC</B> cycle — meaning you receive
                    two consecutive Rotation A rewards, then one B, then one C, then it repeats. The{" "}
                    <B>C rotation</B> contains the rarest and most valuable drops (Prime parts, high-tier
                    mods), so knowing when it lands helps you decide when to extract.
                </P>

                {/* AABC cycle visual reference */}
                <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 overflow-x-auto">
                    <div className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">AABC Cycle — repeating pattern</div>
                    <table className="w-full text-xs min-w-[360px]">
                        <thead>
                            <tr className="border-t border-slate-800/60">
                                <td className="px-3 py-1.5 text-slate-500 font-medium whitespace-nowrap">Interval</td>
                                {["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"].map((n) => (
                                    <td key={n} className="px-2 py-1.5 text-center text-slate-400 font-mono">{n}</td>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="border-t border-slate-800/60">
                                <td className="px-3 py-1.5 text-slate-500 font-medium">Rotation</td>
                                {["A", "A", "B", "C", "A", "A", "B", "C"].map((r, i) => (
                                    <td key={i} className={`px-2 py-1.5 text-center font-bold font-mono ${
                                        r === "C" ? "text-amber-400" : r === "B" ? "text-sky-400" : "text-slate-300"
                                    }`}>{r}</td>
                                ))}
                            </tr>
                        </tbody>
                    </table>
                    <p className="px-3 pb-2.5 text-[11px] text-slate-500">Pattern repeats from the 5th interval onward.</p>
                </div>

                <SectionHeading>Standard AABC missions — reward trigger per mission type</SectionHeading>
                <TableWrap>
                    <table className="w-full text-xs min-w-[480px]">
                        <thead className="bg-slate-900/60">
                            <tr>
                                <th className="text-left px-3 py-2.5 text-slate-300">Mission type</th>
                                <th className="text-left px-3 py-2.5 text-slate-300">One interval =</th>
                                <th className="text-left px-3 py-2.5 text-slate-300">First C rotation at</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                ["Defense",              "Every 3 waves",                          "Wave 12 (4th interval)"],
                                ["Survival",             "Every 5 minutes",                        "20 minutes (4th interval)"],
                                ["Interception",         "Every completed round",                  "Round 4 (4th interval)"],
                                ["Excavation",           "Every completed excavator (100 Cryotic)", "4th excavator (4th interval)"],
                                ["Defection",            "Every 2 squads safely escorted",         "8 squads total (4th interval)"],
                                ["Infested Salvage",     "Every round (manifest decoded)",         "Round 4 (4th interval)"],
                                ["Sanctuary Onslaught",  "Every 2 zones cleared",                  "Zones 8, 16, 24… (4th interval)"],
                                ["Void Armageddon",      "Every 3 waves + Void Angel kill",        "4th angel kill (4th interval)"],
                                ["Void Cascade",         "Every 4 Exolizers retired",              "16 Exolizers (4th interval)"],
                                ["Void Flood",           "Every 3 Void Ruptures sealed",           "12 ruptures (4th interval)"],
                                ["Alchemy (Höllvania)",  "Every crucible filled",                  "4th crucible (4th interval)"],
                                ["Legacyte Harvest",     "Every Legacyte captured",                "4th Legacyte (4th interval)"],
                                ["Mobile Defense",       "Mission completion",                      "Single reward — no rotation"],
                                ["Capture / Exterminate","Mission completion",                      "Single reward — no rotation"],
                                ["Spy",                  "Per vault successfully hacked",           "Up to 3 rewards (one per vault) — no cycle"],
                                ["Sabotage (caches)",    "Per cache opened",                       "Up to 3 rewards (one per cache) — no cycle"],
                                ["Rush (Archwing)",      "Per transport destroyed",                "3 transports = all 3 rotations in one run"],
                                ["Skirmish (Railjack)",  "Per mission run completed",              "Run 4 (4th interval across runs)"],
                            ].map(([type, trigger, firstC]) => (
                                <tr key={type} className="border-t border-slate-800/60">
                                    <td className="px-3 py-2 font-semibold text-slate-100">{type}</td>
                                    <td className="px-3 py-2 text-slate-400">{trigger}</td>
                                    <td className="px-3 py-2 text-amber-300/90 font-medium">{firstC}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </TableWrap>

                <SectionHeading>Non-standard rotation missions</SectionHeading>
                <P>
                    A few missions use reward systems that don't follow standard AABC:
                </P>
                <Bullets items={[
                    <><B>The Circuit (Duviri)</B> — tier-based progression, not AABC. Each run advances through numbered tiers with fixed rewards. Includes Warframe blueprint parts at tiers 2, 5, 8, and 10, and Incarnon Genesis adapters at higher tiers. Resets weekly (Monday 00:00 UTC).</>,
                    <><B>The Perita Rebellion (Höllvania)</B> — Rotation B drops every completed Order; Rotation A drops as a bonus every 3rd Order; Rotation C drops once at mission completion.</>,
                ]} />

                <SectionHeading>Disruption — unique rotation system</SectionHeading>
                <P>
                    Disruption does <B>not</B> use the standard AABC cycle. Each round has 4 conduits;
                    the rotation you receive depends on <B>both the round number and how many conduits
                    you successfully defend</B> that round. Defend more conduits to get better rotations.
                </P>
                <TableWrap>
                    <table className="w-full text-xs min-w-[420px]">
                        <thead className="bg-slate-900/60">
                            <tr>
                                <th className="text-left px-3 py-2.5 text-slate-300">Round</th>
                                <th className="text-center px-3 py-2.5 text-slate-300">1 conduit</th>
                                <th className="text-center px-3 py-2.5 text-slate-300">2 conduits</th>
                                <th className="text-center px-3 py-2.5 text-slate-300">3 conduits</th>
                                <th className="text-center px-3 py-2.5 text-slate-300">4 conduits</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                ["Round 1", "A", "A", "A", "B"],
                                ["Round 2", "A", "A", "B", "B"],
                                ["Round 3", "A", "B", "B", "C"],
                                ["Round 4+", "B", "B", "C", "C"],
                            ].map(([round, c1, c2, c3, c4]) => (
                                <tr key={round} className="border-t border-slate-800/60">
                                    <td className="px-3 py-2 font-semibold text-slate-100">{round}</td>
                                    {[c1, c2, c3, c4].map((rot, i) => (
                                        <td key={i} className={`px-3 py-2 text-center font-bold font-mono ${
                                            rot === "C" ? "text-amber-400" : rot === "B" ? "text-sky-400" : "text-slate-400"
                                        }`}>{rot}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </TableWrap>
                <Callout color="blue">
                    Defend all 4 conduits every round and you reach <B>Rotation C</B> from Round 3
                    onward — skipping A almost entirely. Disruption is one of the best ways to farm
                    Rotation C drops per unit of time.
                </Callout>

                <SectionHeading>Arbitrations — AABB then endless C</SectionHeading>
                <P>
                    Arbitrations use a different cadence: <B>AABB</B> for the first four rewards, then
                    every subsequent reward is <B>Rotation C</B> indefinitely. The interval is also
                    different: <B>Defense</B> rotates every 5 waves (not 3); <B>Survival</B> every
                    5 minutes; <B>Excavation</B> every 2 completed excavators.
                </P>
                <Callout color="amber">
                    In Arbitrations you <B>cannot revive yourself</B> — you are revived by a Revive Drone
                    ally unit that other players can pick up. Dying and not being revived means losing all
                    progress for that run.
                </Callout>

                <SectionHeading>Practical extraction timing</SectionHeading>
                <Bullets items={[
                    <>If you only need <B>Rotation C</B> drops (e.g. rare relics, prime parts), stay until wave 12, minute 20, or round 4 and then extract. Re-running from scratch is often faster than continuing past C.</>,
                    <>For Disruption, extract after any round where you scored Rotation C — then restart if you only need C-tier drops.</>,
                    <>For Survival, the <B>20-minute mark</B> gives the first C-rotation. Many players use a "20-minute run" as the standard farming session length.</>,
                    <>Void Fissures follow the same rotation cycle as their base mission type but also grant a Relic reward on top of the rotation reward at each interval.</>,
                ]} />
            </>
        ),
    },
    {
        id: "modding",
        title: "Modding Basics",
        summary: "How the mod system works — the single most important system to understand for building effective Warframes and weapons.",
        content: (
            <>
                <P>
                    Every Warframe and weapon has <B>mod slots</B>. Mods fill those slots with stats or
                    bonuses, but each mod has a <B>drain</B> value — your total drain cannot exceed your
                    mod capacity (base 30 for all gear).
                </P>
                <SectionHeading>Doubling your mod capacity:</SectionHeading>
                <Bullets items={[
                    <>Install an <B>Orokin Reactor</B> in a Warframe or <B>Orokin Catalyst</B> in a weapon to double capacity from 30 to 60. The community calls these "Potatoes." Free ones appear occasionally via alerts, Nightwave rewards, and login bonuses — always install them on your primary gear.</>,
                    <>
                        The <B>Aura mod slot</B> (Warframe only) always <B>adds</B> capacity rather than spending it.
                        A matching Aura polarity doubles the amount added — e.g. an Aura with a base value of 6
                        grants +12 capacity in a matching slot, but only +3 in a mismatched one (halved, rounded down).
                        Blank (unset) Aura slots always use the halved value regardless of the mod's polarity symbol.
                    </>,
                ]} />
                <SectionHeading>Polarity slots:</SectionHeading>
                <P>
                    A slot with a polarity symbol <B>halves</B> the drain of a matching mod (rounded up).
                    A mismatched mod in a polarity slot costs <B>more</B> instead. Use <B>Forma</B> to
                    add or change a slot's polarity — but Forma resets the item to rank 0 and you must
                    level it again.
                </P>
                <SectionHeading>Essential mods to prioritize first:</SectionHeading>
                <TableWrap>
                    <table className="w-full text-xs min-w-[360px]">
                        <thead className="bg-slate-900/60">
                            <tr>
                                <th className="text-left px-3 py-2.5 text-slate-300">Mod</th>
                                <th className="text-left px-3 py-2.5 text-slate-300">Used In</th>
                                <th className="text-left px-3 py-2.5 text-slate-300">Effect (max rank)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                ["Serration", "Rifle", "+165% base damage"],
                                ["Hornet Strike", "Pistol", "+220% base damage"],
                                ["Pressure Point", "Melee", "+120% base damage"],
                                ["Point Blank", "Shotgun", "+90% base damage"],
                                ["Vitality", "Warframe", "+440% health"],
                                ["Redirection", "Warframe", "+440% shields"],
                                ["Steel Fiber", "Warframe", "+110% armor"],
                                ["Continuity", "Warframe", "+30% ability duration"],
                                ["Streamline", "Warframe", "+30% ability efficiency"],
                                ["Stretch", "Warframe", "+45% ability range"],
                            ].map(([mod, type, effect]) => (
                                <tr key={mod} className="border-t border-slate-800/60">
                                    <td className="px-3 py-2 font-semibold text-slate-100">{mod}</td>
                                    <td className="px-3 py-2 text-slate-400">{type}</td>
                                    <td className="px-3 py-2 text-slate-300">{effect}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </TableWrap>
                <Callout>
                    <B>Corrupted mods</B> (from Orokin Derelict vaults) offer a powerful bonus paired with
                    a penalty — e.g., <Tag>Blind Rage</Tag> gives huge ability strength but reduces efficiency.
                    These are core to many endgame builds. <B>Primed mods</B> (from Baro Ki'Teer) are
                    simply stronger versions of standard mods with extra ranks — always equip them over
                    the base version when available.
                </Callout>
            </>
        ),
    },
    {
        id: "daily-weekly",
        title: "Daily & Weekly Loop",
        summary: "What to do each day and week to maximize standing, rewards, and passive progress.",
        content: (
            <>
                <Callout color="green">
                    The <B>Dashboard</B> includes a Daily/Weekly reset tracker that lists everything
                    you can do right now based on your progression goals. It automatically hides
                    activities you haven't unlocked yet. If something is missing or shouldn't be there,
                    use the <B>Customize</B> button on the tracker to adjust what shows up for you.
                </Callout>
                <P>
                    Below is a brief overview of what each activity is, for context when you see it
                    listed on the Dashboard.
                </P>
                <SectionHeading>Daily resets:</SectionHeading>
                <Bullets items={[
                    <><B>Daily Sortie</B> — three chained missions with escalating difficulty modifiers. Rewards include Riven mods, Endo, Kuva, and Ayatan sculptures. Requires completing The War Within.</>,
                    <><B>Cephalon Simaris Synthesis Target</B> — scan the target creature with a Synthesis Scanner (not a Codex Scanner) for bonus Simaris Standing. Used to buy mods, blueprints, and Sanctuary Onslaught access.</>,
                    <><B>Maroo's Ayatan Run</B> — a short mission from Maroo rewarding an Ayatan Sculpture. Fill sculptures with Ayatan Stars and sell to Maroo for Endo, or trade to players for Platinum.</>,
                    <><B>Syndicate Standing cap</B> — Daily cap is 16,000 + 500 × Mastery Rank. 15% of all Affinity earned converts to Standing automatically for your pledged faction. Run Syndicate Alerts for bonus Standing. Medallions can be turned in at any time and do not count against the cap.</>,
                ]} />
                <SectionHeading>Weekly resets:</SectionHeading>
                <Bullets items={[
                    <><B>Nightwave challenges</B> — complete weekly and daily Nightwave tasks for Nightwave Credits, redeemable for Orokin Reactors/Catalysts, Nitain Extract, and exclusive cosmetics.</>,
                    <><B>Archon Hunt</B> — three-mission set ending in an Archon boss fight. Rewards Archon Shards (socket into Warframes for powerful passive bonuses) and Lua Thrax Plasm.</>,
                    <><B>Steel Path Honors rotation</B> — Teshin's shop stock cycles weekly. Spend Steel Essence on Arcane Adapters, exclusive mods, and cosmetics.</>,
                    <><B>Kahl-175 missions</B> (post-New War / Veilbreaker) — weekly missions for Pathos Clamps and Veilbreaker standing. Used to unlock Grendel Prime parts and other items.</>,
                    <><B>Deep Archimedea</B> (post-Whispers in the Walls) — high-difficulty weekly with randomized modifiers. Rewards Cavia Standing and Invigoration charges.</>,
                ]} />
            </>
        ),
    },
    {
        id: "trading",
        title: "Trading & Platinum",
        summary: "How to earn Platinum without spending real money — the foundation of Warframe's free-to-play economy.",
        content: (
            <>
                <P>
                    Platinum is Warframe's premium currency, but it can be earned entirely for free by
                    trading with other players. You do not need to spend real money to obtain Warframes,
                    weapons, or cosmetics — though buying Platinum directly speeds things up.
                </P>
                <SectionHeading>What to sell:</SectionHeading>
                <Bullets items={[
                    <><B>Prime Warframe and weapon parts</B> — farm Void Fissure missions, crack relics, and sell the rare/uncommon drops. Check warframe.market for current going rates before listing.</>,
                    <><B>Riven mods</B> — rewarded from Daily Sorties. Unveiled Rivens for popular weapons (Kuva Bramma, Rubico Prime, Catchmoon, etc.) can sell for large amounts. Always unveil before listing.</>,
                    <><B>Arcanes</B> — crafted from Eidolon Shards or dropped from Eidolons. High-tier Arcanes like Arcane Energize and Arcane Grace are consistently valuable.</>,
                    <><B>Syndicate mods and weapons</B> — buy them from your aligned syndicates and sell to players in opposing factions who can't obtain them directly.</>,
                    <><B>Ayatan Sculptures</B> (fully filled with stars) — trade to other players for Platinum, or exchange with Maroo for Endo if you just need the Endo.</>,
                ]} />
                <SectionHeading>How to trade:</SectionHeading>
                <Steps items={[
                    <>List items on <B>warframe.market</B> — the standard third-party trading site. Set your account status to Online in-game while listings are active so buyers can invite you.</>,
                    "Trading happens at a Clan Dojo Trading Post or at Maroo's Bazaar (Asteroid, Mars). Both players must be present.",
                    "Both players pay a Credit tax per trade. Tax scales with item value — high-value Riven trades cost millions of Credits, so keep a large Credit buffer.",
                ]} />
                <Callout color="amber">
                    <B>Trade limits scale with Mastery Rank.</B> You must reach at least MR 2 to trade.
                    Your daily trade limit equals your Mastery Rank — MR 2 = 2 trades/day, MR 10 = 10
                    trades/day, up to 30/day at MR 30. If you hit your daily limit, you'll need to wait
                    until the next UTC midnight reset. Ranking up is the only way to increase this cap.
                </Callout>
            </>
        ),
    },
    {
        id: "hex-relationships",
        title: "Hex Relationships",
        summary: "Dating guide for the six Protoframe members of The Hex in Höllvania — chemistry activities, birthdays, standing levels, and the New Year's Eve finale.",
        content: (
            <>
                <Callout color="blue">
                    <B>Prerequisite:</B> Complete both <B>The Duviri Paradox</B> and <B>The Hex</B> mainline quests before any relationship content is available.
                </Callout>

                <SectionHeading>The Hex — dateable members</SectionHeading>
                <TableWrap>
                    <table className="w-full text-xs min-w-[520px]">
                        <thead className="bg-slate-900/60">
                            <tr>
                                <th className="text-left px-3 py-2.5 text-slate-300">Name</th>
                                <th className="text-left px-3 py-2.5 text-slate-300">Alias / Handle</th>
                                <th className="text-left px-3 py-2.5 text-slate-300">Protoframe of</th>
                                <th className="text-left px-3 py-2.5 text-slate-300">Birthday</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                ["Arthur",  "Broadsword",       "Excalibur", "November 3"],
                                ["Eleanor", "Salem",            "Nyx",       "November 2"],
                                ["Lettie",  "Belladonna",       "Trinity",   "February 14 (Valentine's Day)"],
                                ["Amir",    "H16h V0l7463",     "Volt",      "May 23"],
                                ["Aoi",     "xX GLIMMER Xx",   "Mag",       "July 10"],
                                ["Quincy",  "Soldja1Shot1kil",  "Cyte-09",   "December 4"],
                            ].map(([name, alias, frame, bday]) => (
                                <tr key={name} className="border-t border-slate-800/60">
                                    <td className="px-3 py-2 font-semibold text-slate-100">{name}</td>
                                    <td className="px-3 py-2 text-slate-400 font-mono text-[10px]">{alias}</td>
                                    <td className="px-3 py-2 text-slate-300">{frame}</td>
                                    <td className="px-3 py-2 text-pink-300">{bday}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </TableWrap>
                <SectionHeading>Techrot Encore additions — not dateable</SectionHeading>
                <P>
                    Four new Protoframes joined The Roundtable in the Techrot Encore update. They have birthdays that appear on the 1999 Calendar, but you <B>cannot date</B> any of them.
                </P>
                <TableWrap>
                    <table className="w-full text-xs min-w-[420px]">
                        <thead className="bg-slate-900/60">
                            <tr>
                                <th className="text-left px-3 py-2.5 text-slate-300">Name</th>
                                <th className="text-left px-3 py-2.5 text-slate-300">Protoframe of</th>
                                <th className="text-left px-3 py-2.5 text-slate-300">Birthday</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                ["Kaya Velasco",      "Nova",   "January 1"],
                                ["Minerva Hendricks", "Saryn",  "March 15"],
                                ["Flare Varleon",     "Temple", "June 15"],
                                ["Velimir Volkov II", "Frost",  "December 21"],
                            ].map(([name, frame, bday]) => (
                                <tr key={name} className="border-t border-slate-800/60">
                                    <td className="px-3 py-2 font-semibold text-slate-300">{name}</td>
                                    <td className="px-3 py-2 text-slate-400">{frame}</td>
                                    <td className="px-3 py-2 text-pink-300/70">{bday}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </TableWrap>

                <SectionHeading>Relationship status words</SectionHeading>
                <P>
                    Each Hex member has an individual relationship status that progresses independently of The Hex syndicate standing level. Check it by opening their <B>Profile</B> before chatting — the one-word status is the key indicator. Progression order:
                </P>
                <P>
                    <span className="font-mono text-slate-400">Neutral → Friendly → Liked → Trusted → Close → Best Friends → Loved</span>
                </P>
                <Bullets items={[
                    <><B>Liked</B> by every member — required to unlock the Hex Finale quest.</>,
                    <><B>Close</B> — minimum status to date someone and receive the New Year's Eve kiss.</>,
                    <><B>Loved</B> — maximum status; they move into your Backroom.</>,
                ]} />
                <Callout color="amber">
                    Always check a character's <B>Profile</B> before chatting — it shows their personality, gift preferences, and their current status word toward you. It updates after each conversation.
                </Callout>

                <SectionHeading>Gift preferences</SectionHeading>
                <TableWrap>
                    <table className="w-full text-xs min-w-[480px]">
                        <thead className="bg-slate-900/60">
                            <tr>
                                <th className="text-left px-3 py-2.5 text-slate-300">Name</th>
                                <th className="text-left px-3 py-2.5 text-slate-300">Buy these</th>
                                <th className="text-left px-3 py-2.5 text-slate-300">Notes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                ["Arthur",  "Food / cooking items (toaster, etc.)",         "Do NOT buy coffee-related items for him"],
                                ["Lettie",  "Coffee-related items only",                    "—"],
                                ["Eleanor", "Paper, pen, pencil, sticky notes, highlighter","She coined the term Techrot — journalist supplies"],
                                ["Quincy",  "Entrati poster",                               "Best current option"],
                                ["Amir",    "Tech & games (air hockey, GPU, headphones…)",  "Anything tech or game related"],
                                ["Aoi",     "Bicycle (80,000 Hollars)",                     "Instantly jumps her to Liked status"],
                            ].map(([name, buy, note]) => (
                                <tr key={name} className="border-t border-slate-800/60">
                                    <td className="px-3 py-2 font-semibold text-slate-100">{name}</td>
                                    <td className="px-3 py-2 text-slate-300">{buy}</td>
                                    <td className="px-3 py-2 text-slate-500">{note}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </TableWrap>

                <SectionHeading>Building chemistry</SectionHeading>
                <P>
                    Chemistry points are earned through four daily activities. Do all four every day to maximize Standing gain:
                </P>
                <Bullets items={[
                    <><B>Chat on KIM</B> — Fast Travel to the Backroom and use the computer on the <B>second floor</B>. Be kind, ask about their hobbies, and pick options that show you care. Eleanor is the only one who enjoys very long conversations.</>,
                    <><B>Send gifts</B> — buy from Höllvania vendors and match each character's preferences (see table above) for a bonus.</>,
                    <><B>Complete bounties</B> — run Höllvania bounties with the person you like most. Check the <B>Calendar</B> on the garage computer first — prioritize Wrench Boost days and select the boost for the character you're pursuing.</>,
                    <><B>Celebrate birthdays</B> — when a birthday appears on the 1999 Calendar, interact with that character on that day for a large chemistry bonus.</>,
                ]} />

                <SectionHeading>Standing levels</SectionHeading>
                <P>
                    There are five standing levels per character. Two are key gates:
                </P>
                <Bullets items={[
                    <><B>Level 3 — "2-For-1":</B> Required to unlock the Hex Finale quest. Reach this with the person you want to kiss before attempting the finale.</>,
                    <><B>Level 5 — "Pizza Party":</B> Maximum relationship. The character will move into your Backroom (not your Orbiter or Drifter's Camp) and be close enough for the New Year's Eve kiss.</>,
                ]} />

                <SectionHeading>New Year's Eve finale</SectionHeading>
                <Steps items={[
                    <>Reach <B>Standing Level 3</B> with your chosen person to unlock the Hex Finale quest.</>,
                    <>Continue building chemistry to reach <B>Standing Level 5</B> before in-game January arrives.</>,
                    <>When January comes around in-game, you get the opportunity to kiss the person you've built max relationship with.</>,
                    <>After the kiss, a prompt appears: <B>REMEMBER</B> (continue dating that person exclusively) or <B>FORGET</B> (free to pursue someone else next cycle).</>,
                ]} />
                <Callout color="amber">
                    Only one person can move into your Backroom at a time. If you want to date a different character in a future season, select <B>FORGET</B> when prompted.
                </Callout>
                <Callout color="red">
                    <B>Breaking up</B> resets that character's relationship status all the way back to <B>Neutral</B> — you will have to rebuild from scratch.
                </Callout>
            </>
        ),
    },
    {
        id: "syndicates",
        title: "Syndicates",
        summary: "Faction reputation systems that reward exclusive mods, augments, and weapons. Which ones you choose early matters.",
        content: (
            <>
                <Callout color="green">
                    The <B>Syndicates page</B> in this app includes a simulator that helps you identify
                    which factions to pledge to, preview rank-up requirements, and browse the full
                    offerings available at each rank — plan which augments and weapons you're working
                    toward before committing your daily Standing.
                </Callout>
                <P>
                    Syndicates are factions you earn <B>Standing</B> with by pledging to them. Once
                    pledged, <B>15% of all Affinity</B> (experience) you earn in missions is automatically
                    converted into Standing for your pledged faction — no extra steps needed. Standing
                    can also be earned by completing daily <B>Syndicate Alert</B> missions, or by
                    collecting and turning in <B>Syndicate Medallions</B> found hidden throughout
                    Syndicate Alert missions. Higher ranks unlock better rewards — including Warframe
                    augment mods that dramatically change playstyle.
                </P>
                <P>
                    The six major syndicates exist in opposing pairs. Supporting one faction also penalizes
                    its enemy:
                </P>
                <TableWrap>
                    <table className="w-full text-xs min-w-[500px]">
                        <thead className="bg-slate-900/60">
                            <tr>
                                <th className="text-left px-3 py-2.5 text-slate-300">Syndicate</th>
                                <th className="text-left px-3 py-2.5 text-slate-300">Opposes</th>
                                <th className="text-left px-3 py-2.5 text-slate-300">Notable Rewards</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                ["Steel Meridian", "Perrin Sequence", "Pilfering Swarm, Despoil augments. Weapons: Vaykor Hek, Vaykor Marelok"],
                                ["Arbiters of Hexis", "Cephalon Suda", "Eternal War, Accumulating Whirlwind augments. Weapons: Telos Boltace"],
                                ["Cephalon Suda", "Arbiters of Hexis", "Detect Vulnerability augment. Weapons: Synoid Gammacor, Prisma Shade"],
                                ["New Loka", "Red Veil", "Pilfering Strangledome, Healing Return augments. Weapons: Sancti Tigris"],
                                ["Red Veil", "New Loka", "Augur Seeker, Blood for Blood augments. Weapons: Rakta Ballistica"],
                                ["Perrin Sequence", "Steel Meridian", "Seeker Volley, Covert Lethality augments. Weapons: Secura Penta"],
                            ].map(([s, o, r]) => (
                                <tr key={s} className="border-t border-slate-800/60">
                                    <td className="px-3 py-2 font-semibold text-slate-100">{s}</td>
                                    <td className="px-3 py-2 text-slate-400">{o}</td>
                                    <td className="px-3 py-2 text-slate-300">{r}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </TableWrap>
                <Callout color="amber">
                    <B>You can only pledge to one syndicate at a time.</B> Pledging to a faction also
                    passively accrues a small amount of Standing toward its allied syndicate(s), and
                    reduces Standing with its enemies. Plan your pledges carefully using the{" "}
                    <B>Syndicates</B> page in this app. <B>New Loka</B> and <B>Steel Meridian</B> are
                    popular early choices since they sell the farming augments Pilfering Strangledome
                    and Pilfering Swarm respectively.
                </Callout>
                <P>
                    Your daily Standing cap is <B>16,000 + 500 × Mastery Rank</B> (e.g. MR 10 = 21,000).
                    This resets at UTC midnight. <B>Syndicate Medallions</B> do not count against this
                    cap — they can be turned in at any time regardless of how much Standing you've earned
                    that day.
                </P>
            </>
        ),
    },
    {
        id: "companions-breeding",
        title: "Companions & Breeding",
        summary: "Kavats, Kubrows, Vulpaphyla, Predasites, and Helminth Chargers — prerequisites, breeding steps, and how each type works.",
        content: (
            <>
                <P>
                    Biological companions — Kavats, Kubrows, and their Infested variants — must be
                    bred or captured before they can be used. They live in your Orbiter's{" "}
                    <B>Incubator</B> (bottom-left of the ship). You can only have{" "}
                    <B>one active companion</B> at a time across all companion types.
                </P>

                <SectionHeading>Prerequisites (Kavats &amp; Kubrows)</SectionHeading>
                <P>Before you can breed any biological companion, you need three things:</P>
                <Bullets items={[
                    <><B>Complete "Howl of the Kubrow"</B> — this short quest unlocks the Incubator and is available early in the star chart.</>,
                    <><B>Incubator Upgrade Segment</B> — required to breed Kavats, and cuts incubation time from 48 h to 24 h for all breeds. The blueprint is researched in your Clan Dojo's <B>Tenno Lab</B>, or buy the fully-built segment from the Market for 175 Platinum.</>,
                    <><B>Incubator Power Core</B> — one is consumed per incubation. Buy from the Market for credits, or craft via the Foundry.</>,
                    <><B>A free Companion Slot</B> — buy 2 extra slots for 12 Platinum from the Market if you are full.</>,
                ]} />
                <Callout color="blue">
                    DNA Stabilizers and the old Loyalty / Stability degradation system have been{" "}
                    <B>removed from the game</B> — you no longer need to maintain your companion's
                    health with consumable items. Mature companions can also be freely{" "}
                    <B>regressed back to puppy / kitten form</B> at any time via the Incubator
                    without losing mods or cosmetics.
                </Callout>

                <SectionHeading>Kavats</SectionHeading>
                <P>
                    Kavats are feline companions. The two main variants are <B>Smeeta Kavat</B>{" "}
                    (its Charm ability randomly triggers double resource or credit pickups, brief
                    invulnerability, or doubled Affinity gain — exceptional for farming runs) and{" "}
                    <B>Adarza Kavat</B> (boosts critical chance for nearby allies). Which variant
                    you hatch is random unless you use imprints.
                </P>
                <Steps items={[
                    <>Go to the <B>Void</B> — Feral Kavats roam Void tilesets. Low-level Survival or Exterminate nodes (Hepit, Oxomoco) give the most time to hunt them. Avoid Capture missions, which spawn very few enemies.</>,
                    <>Equip a <B>Codex Scanner</B> or <B>Synthesis Scanner</B> in your Gear wheel (Codex Scanner is cheap from the Market). Scan every Feral Kavat you see — each scan has roughly a <B>25% chance</B> to yield a <B>Kavat Genetic Code</B>. You need <B>10 Genetic Codes</B> to incubate.</>,
                    <>With 10 codes and a Power Core ready, go to the Incubator and select <B>Incubate → Kavat</B>. Incubation takes <B>48 hours</B> (24 hours with the Upgrade Segment installed), or 15 Platinum to rush immediately.</>,
                    <>When incubation completes, open the Incubator and choose to <B>Mature</B> your companion. Maturation doesn't happen automatically — you must trigger it. Once mature it can be equipped from the Arsenal's Companion tab. You can also <B>Regress</B> a mature companion back to kitten form at any time without losing mods or cosmetics.</>,
                ]} />
                <Callout color="amber">
                    <B>Imprints</B> are genetic snapshots you can take from an existing Kavat (up to{" "}
                    <B>3 imprints per individual Kavat</B>, each taking 1.5 hours or 10 Platinum to
                    rush). Breeding with two imprints of the same variant gives a <B>much higher
                    probability</B> of that variant hatching — but it is not an absolute guarantee.
                    Imprints are tradeable; check <B>Warframe.market</B> to buy Smeeta imprints
                    from other players and skip the RNG entirely.
                </Callout>

                <SectionHeading>Vasca Kavat</SectionHeading>
                <P>
                    The Vasca Kavat is a third Kavat variant with life-steal and a passive that
                    raises its owner from bleedout. It is bred differently — you infect an existing
                    Kavat with the Vasca Virus and extract imprints from it rather than using
                    Genetic Codes directly.
                </P>
                <Steps items={[
                    <>Equip any Kavat as your active companion. Travel to the <B>Plains of Eidolon at night</B> — Vasca Kavats only spawn in darkness (watch the day/night timer on the Cetus nav node).</>,
                    <>Let a wild Vasca Kavat <B>bite your companion</B>. The companion must survive the hit — if it is downed instantly the infection will not transfer. Your Kavat will glow red to confirm infection. You can buy a <B>Vasca Kavat Lure</B> (3,000 Standing) or <B>Pheromone Oota</B> (200 Standing) from <B>Master Teasonai</B> in Cetus to attract Vasca Kavats more reliably.</>,
                    <>Back in your Orbiter, go to the Incubator and take an <B>imprint</B> from the infected Kavat. The game will warn you this cures the virus — confirm. You now have one Vasca Imprint.</>,
                    <>You need <B>two Vasca Imprints</B> total. Re-infect the same Kavat (the cure does not prevent re-infection) or a second Kavat, and repeat the imprint step.</>,
                    <>Start a new Kavat incubation applying both Vasca Imprints. The result will be a Vasca Kavat.</>,
                ]} />

                <SectionHeading>Kubrows</SectionHeading>
                <P>Kubrows are canine companions. Variants and their key roles:</P>
                <TableWrap>
                    <table className="w-full text-xs min-w-[440px]">
                        <thead className="bg-slate-900/60">
                            <tr>
                                <th className="text-left px-3 py-2.5 text-slate-300">Variant</th>
                                <th className="text-left px-3 py-2.5 text-slate-300">Key Role</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                ["Huras Kubrow",   "Stealth — cloaks itself and you; can extend the cloak to the whole squad"],
                                ["Raksa Kubrow",   "Defense — howl restores your shields and intimidates nearby enemies"],
                                ["Chesa Kubrow",   "Utility — disarms enemies and automatically retrieves loot to you"],
                                ["Sahasa Kubrow",  "Farming — digs up extra resources and ammo from the environment"],
                                ["Sunika Kubrow",  "Combat — specialises in Mercy kills and attacking downed enemies"],
                            ].map(([v, r]) => (
                                <tr key={v} className="border-t border-slate-800/60">
                                    <td className="px-3 py-2 font-semibold text-slate-100">{v}</td>
                                    <td className="px-3 py-2 text-slate-300">{r}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </TableWrap>
                <Steps items={[
                    <>Farm a <B>Kubrow Egg</B> on Earth by destroying the dirt burrow mounds found in Earth's forest tilesets (melee attacks break them open). Only one egg can be held at a time.</>,
                    <>Take the egg to the Incubator with a Power Core and start incubation — <B>48 hours</B> standard (24 hours with the Upgrade Segment), or 15 Platinum to rush.</>,
                    <>The variant hatched is random. Use two imprints from the same Kubrow breed (up to <B>2 imprints per individual Kubrow</B>) for a much higher chance of that breed — though still not guaranteed.</>,
                ]} />

                <SectionHeading>Helminth Charger</SectionHeading>
                <P>
                    The Helminth Charger is an Infested companion grown from a <B>Helminth Cyst</B>,
                    a parasitic growth placed on Warframes by the Helminth organism in your Orbiter.
                    It has crowd-control precepts including <B>Proboscis</B> (harpoon pull) and{" "}
                    <B>Trample</B> (charging knockdown attack).
                </P>
                <Steps items={[
                    <>Walk into the <B>Helminth room</B> in your Orbiter (the organically-textured door at the back of the ship) while wearing any Warframe. The Helminth will inject a cyst. Alternatively, equip <B>Nidus</B> or <B>Nidus Prime</B> — both start with the cyst already present. The cyst also spreads from infected squadmates in missions or Dojos.</>,
                    <>After <B>24 hours</B> a pink cyst appears on the Warframe's neck. Let it mature for a further <B>6 days</B> (7 days total from infection) until a small tendril emerges — that indicates full maturity.</>,
                    <>Go to the Incubator and select <B>Kubrow Breeding → Drain Helminth Cyst</B>. This removes the cyst and starts incubation (48 h / 24 h with Upgrade Segment). The Warframe can be re-infected afterward.</>,
                ]} />
                <Callout color="amber">
                    If <B>Lotus prompts you at mission start</B> to remove a cyst, accepting
                    permanently prevents <B>that specific Warframe</B> from being re-infected.
                    Other Warframes (including new ones you acquire later) can still get the cyst
                    normally. Draining via the Incubator does <B>not</B> block re-infection on that
                    frame — so always drain rather than letting Lotus remove it if you want to breed
                    more Chargers from the same Warframe in future.
                </Callout>

                <SectionHeading>Vulpaphyla (Infested Kavats — Deimos)</SectionHeading>
                <P>
                    Vulpaphyla are Infested fox-like companions from the Cambion Drift (Deimos).
                    Each subspecies has a <B>Devolution precept mod</B> (e.g. Panzer Devolution).
                    When this mod is equipped and the Vulpaphyla is downed, it enters{" "}
                    <B>Larval Devolution Form</B> — a floating spore state lasting 30 seconds —
                    then automatically revives. Without the Devolution mod equipped they are downed
                    and revived like any other companion. They are <B>not bred in the
                    Incubator</B>; instead they are assembled from modular components and{" "}
                    <B>Revivified by Son</B> in the Necralisk.
                </P>
                <P>
                    Each Vulpaphyla is built from three choices: <B>subspecies</B> (determines
                    abilities), a <B>Mutagen</B> (tail appearance and damage resistances), and an{" "}
                    <B>Antigen</B> (head appearance and default polarity) — 48 possible combinations
                    in total. Buy Mutagen and Antigen blueprints from Son with Standing, craft them
                    in the Foundry, then bring them to Son for Revivification at a cost of{" "}
                    <B>5,000 Credits</B>.
                </P>
                <TableWrap>
                    <table className="w-full text-xs min-w-[480px]">
                        <thead className="bg-slate-900/60">
                            <tr>
                                <th className="text-left px-3 py-2.5 text-slate-300">Subspecies</th>
                                <th className="text-left px-3 py-2.5 text-slate-300">Signature Abilities</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                ["Panzer Vulpaphyla",  "Viral Quills — launches quills inflicting Viral; Symbiotic Bond then spreads those Viral procs to enemies nearby on each status tick"],
                                ["Sly Vulpaphyla",     "Survival Instinct — creates a decoy that draws enemy fire for 1.5 s when you bullet jump"],
                                ["Crescent Vulpaphyla","Crescent Charge — lifts enemies and throws them, dealing 20% of their max health + weapon damage in a 5 m radius with 5 Puncture stacks"],
                            ].map(([v, a]) => (
                                <tr key={v} className="border-t border-slate-800/60">
                                    <td className="px-3 py-2 font-semibold text-slate-100">{v}</td>
                                    <td className="px-3 py-2 text-slate-300">{a}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </TableWrap>
                <P>
                    You can also <B>capture a wild Vulpaphyla</B> in the Cambion Drift as an
                    alternative: find one already fighting Infested, wait for the orange shimmer that
                    indicates it is weakened, then tranquilize it with the <B>Tranq Rifle</B> (bought
                    from Son) and return it to Son. This skips the crafting step but gives less
                    control over which Mutagen/Antigen combination you end up with.
                </P>
                <Callout color="blue">
                    <B>Gilding</B> is required to name your Vulpaphyla, add or change polarities,
                    and earn Mastery from it. Level it to <B>Rank 30</B> then spend{" "}
                    <B>10 Son Tokens + 5,000 Standing</B> at Son to gild — it resets to Rank 0
                    afterward. As of <B>Update 37.0</B> Vulpaphyla also have their own moddable{" "}
                    <B>Beast Claws</B> weapon with unique stats per subspecies.
                </Callout>

                <SectionHeading>Predasites (Infested Kubrows — Deimos)</SectionHeading>
                <P>
                    Predasites are the Infested Kubrow equivalents from Deimos. When downed they
                    become <B>incapacitated for 60 seconds</B> then automatically revive with 5
                    seconds of invulnerability (or can be manually revived early). They use the same
                    modular Mutagen/Antigen + Son Revivification system as Vulpaphyla (5,000 Credits
                    per Revivification) and also require gilding to name, polarize, or earn Mastery.
                    Wild Predasites can be captured in the Cambion Drift using the same Tranq Rifle
                    method.
                </P>
                <TableWrap>
                    <table className="w-full text-xs min-w-[480px]">
                        <thead className="bg-slate-900/60">
                            <tr>
                                <th className="text-left px-3 py-2.5 text-slate-300">Subspecies</th>
                                <th className="text-left px-3 py-2.5 text-slate-300">Signature Abilities</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                ["Medjay Predasite",  "Infectious Bite + Paralytic Spores — infection-based crowd control and damage absorption"],
                                ["Pharaoh Predasite", "Anabolic Pollination + Endoparasitic Vector — spore clouds that buff allies and restrain enemies with tentacles"],
                                ["Vizier Predasite",  "Acidic Spittle + Iatric Mycelium — acid attacks and healing spore trails for the player"],
                            ].map(([v, a]) => (
                                <tr key={v} className="border-t border-slate-800/60">
                                    <td className="px-3 py-2 font-semibold text-slate-100">{v}</td>
                                    <td className="px-3 py-2 text-slate-300">{a}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </TableWrap>

                <SectionHeading>Imprints &amp; Trading (Kavats and Kubrows)</SectionHeading>
                <P>
                    Imprints are genetic snapshots taken from an existing companion via the
                    Incubator menu (1.5 hours each, rushable for 10 Platinum). Kavats allow up
                    to <B>3 imprints per individual</B>; Kubrows allow up to <B>2</B>. Using two
                    imprints of the same variant when incubating gives a <B>significantly higher
                    probability</B> of hatching that variant — but it is not an absolute guarantee.
                    Imprints are tradeable between players; check <B>Warframe.market</B> for
                    listings if you want to target a specific variant without grinding RNG.
                </P>
                <Callout color="green">
                    <B>Panzer Vulpaphyla</B> is the current top-tier general companion. Its Viral
                    Quills passively spread Viral status to nearby enemies, which significantly
                    amplifies your whole squad's damage output — Viral is one of the strongest
                    status effects in the game. It is the go-to companion upgrade once you reach
                    Deimos. For solo farming sessions, <B>Smeeta Kavat</B>'s Charm is hard to
                    beat: its random doubling of resource and credit pickups, combined with
                    occasional Affinity boosts and brief invulnerability windows, makes it
                    exceptional for resource-intensive grind.
                </Callout>
            </>
        ),
    },
];

// ─────────────────────────────────────────────────────────────────────────────
// Navigation groups — two-tier: group row → section row
// ─────────────────────────────────────────────────────────────────────────────

const NAV_GROUPS = [
    { id: "story",    label: "Story",              sectionIds: ["quest-order", "hex-relationships"] },
    { id: "combat",   label: "Combat Systems",      sectionIds: ["lich-sisters", "kuva", "eidolons", "railjack", "necramech"] },
    { id: "build",    label: "Build & Progression", sectionIds: ["focus", "modding", "steel-path", "farming", "rotations", "companions-breeding"] },
    { id: "economy",  label: "Economy & Routine",   sectionIds: ["trading", "daily-weekly", "syndicates"] },
] as const;

type NavGroupId = typeof NAV_GROUPS[number]["id"];

// ─────────────────────────────────────────────────────────────────────────────
// Page component
// ─────────────────────────────────────────────────────────────────────────────

export default function Handbook() {
    const [activeId, setActiveId] = useState<string>("quest-order");
    const [searchQuery, setSearchQuery] = useState("");

    const activeSection = SECTIONS.find((s) => s.id === activeId) ?? SECTIONS[0];
    const activeGroup = NAV_GROUPS.find((g) => (g.sectionIds as readonly string[]).includes(activeId)) ?? NAV_GROUPS[0];

    const normalizedQuery = searchQuery.trim().toLowerCase();
    const searchResults = normalizedQuery.length >= 2
        ? SECTIONS.filter((s) =>
            s.title.toLowerCase().includes(normalizedQuery) ||
            s.summary.toLowerCase().includes(normalizedQuery)
        )
        : [];
    const isSearching = normalizedQuery.length >= 2;

    function selectSection(id: string) {
        setActiveId(id);
        setSearchQuery("");
    }

    function selectGroup(gid: NavGroupId) {
        const group = NAV_GROUPS.find((g) => g.id === gid)!;
        if (!(group.sectionIds as readonly string[]).includes(activeId)) {
            setActiveId(group.sectionIds[0]);
        }
    }

    const groupTabCls = (gid: NavGroupId) =>
        gid === activeGroup.id
            ? "shrink-0 rounded-2xl border border-[color:var(--wf-border-strong)] bg-[color:var(--wf-surface-strong)] px-3.5 py-2 text-sm font-semibold text-[color:var(--wf-text-strong)] transition-colors"
            : "shrink-0 rounded-2xl border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] px-3.5 py-2 text-sm font-medium text-[color:var(--wf-text-muted)] hover:bg-[color:var(--wf-surface-strong)] hover:text-[color:var(--wf-text)] transition-colors";

    const sectionTabCls = (id: string) =>
        id === activeId
            ? "shrink-0 rounded-full border border-[color:var(--wf-border-strong)] bg-[color:var(--wf-surface-strong)] px-3 py-1.5 text-xs font-semibold text-[color:var(--wf-text-strong)] transition-colors"
            : "shrink-0 rounded-full border border-[color:var(--wf-border-subtle)] bg-transparent px-3 py-1.5 text-xs font-medium text-[color:var(--wf-text-dim)] hover:bg-[color:var(--wf-surface-soft)] hover:text-[color:var(--wf-text)] transition-colors";

    const totalSections = SECTIONS.length;
    const totalGroups = NAV_GROUPS.length;
    const currentGroupCount = activeGroup.sectionIds.length;

    return (
        <div className="flex flex-col gap-4">
            <WorkspaceHero
                eyebrow="Reference & Learning"
                title="Tenno&apos;s Handbook"
                description="A field manual for progression gates, systems, and the mechanics that matter when Warframe stops explaining itself clearly."
                actions={
                    <div className="max-w-sm rounded-2xl border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] px-4 py-3">
                        <div className="text-[11px] uppercase tracking-[0.14em] text-[color:var(--wf-text-dim)]">Reading focus</div>
                        <div className="mt-1 text-sm font-medium text-[color:var(--wf-text-strong)]">{activeSection.title}</div>
                        <div className="mt-1 text-xs leading-5 text-[color:var(--wf-text-muted)]">{activeSection.summary}</div>
                    </div>
                }
                stats={
                    <>
                        <WorkspaceStat label="Topics" value={totalSections} hint="Reference entries for progression and game systems." />
                        <WorkspaceStat label="Sections" value={totalGroups} hint="Story, combat, progression, and routine reading tracks." />
                        <WorkspaceStat label="Current track" value={activeGroup.label} hint={`${currentGroupCount} entries in this reading track.`} />
                        <WorkspaceStat label="Search" value={isSearching ? searchResults.length : "Ready"} hint={isSearching ? "Matching entries for the current query." : "Search by topic, system, or unlock path."} />
                    </>
                }
            />

            <section className="rounded-[24px] border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-1)] p-4 shadow-[var(--wf-shadow-panel)] sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-semibold text-[color:var(--wf-text-strong)]">Reading Index</h2>
                        <div className="mt-1 text-sm text-[color:var(--wf-text-muted)]">
                            Browse by discipline, then drill into the exact guide you need.
                        </div>
                    </div>
                </div>

                {/* Search */}
                <div className="mt-4 relative">
                    <input
                        type="text"
                        aria-label="Search Handbook topics"
                        className="w-full rounded-xl border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] px-3 py-2.5 text-sm text-[color:var(--wf-text-strong)] placeholder:text-[color:var(--wf-text-dim)] focus:outline-none focus:border-[color:var(--wf-border-strong)]"
                        placeholder="Search topics… (e.g. relics, endo, focus)"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 px-1 text-[color:var(--wf-text-dim)] hover:text-[color:var(--wf-text)]"
                            aria-label="Clear search"
                        >
                            ✕
                        </button>
                    )}
                </div>

                {/* Search results */}
                {isSearching && (
                    <div className="mt-3 border-t border-[color:var(--wf-border-subtle)] pt-3">
                        {searchResults.length === 0 ? (
                            <div className="text-xs italic text-[color:var(--wf-text-dim)]">No sections match &quot;{normalizedQuery}&quot;</div>
                        ) : (
                            <div className="space-y-1">
                                {searchResults.map((s) => (
                                    <button
                                        key={s.id}
                                        onClick={() => selectSection(s.id)}
                                        className="w-full rounded-2xl border border-[color:var(--wf-border-subtle)] bg-[color:var(--wf-surface-soft)] px-3 py-3 text-left transition-colors hover:bg-[color:var(--wf-surface-strong)]"
                                    >
                                        <div className="text-sm font-semibold text-[color:var(--wf-text-strong)]">{s.title}</div>
                                        <div className="mt-0.5 text-xs text-[color:var(--wf-text-muted)]">{s.summary}</div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Row 1: group tabs — hidden while searching */}
                {!isSearching && (
                    <div className="mt-4">
                        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-[color:var(--wf-text-dim)]">Category</div>
                        <div className="flex flex-wrap gap-2">
                            {NAV_GROUPS.map((g) => (
                                <button key={g.id} onClick={() => selectGroup(g.id)} className={groupTabCls(g.id)}>
                                    {g.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Row 2: section tabs for active group — only shown when group has >1 section and not searching */}
                {!isSearching && activeGroup.sectionIds.length > 1 && (
                    <div className="mt-3 border-t border-[color:var(--wf-border-subtle)] pt-3">
                        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-[color:var(--wf-text-dim)]">Section</div>
                        <div className="flex flex-wrap gap-1.5">
                            {activeGroup.sectionIds.map((id) => {
                                const s = SECTIONS.find((x) => x.id === id)!;
                                return (
                                    <button key={id} onClick={() => setActiveId(id)} className={sectionTabCls(id)}>
                                        {s.title}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </section>

            {/* ── Content — hidden while searching ── */}
            {!isSearching && (
                <Card title={activeSection.title} summary={activeSection.summary}>
                    {activeSection.content}
                </Card>
            )}
        </div>
    );
}
