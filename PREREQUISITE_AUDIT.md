# Tenno-Hub Prerequisite Audit

**Review date:** 2026-11-09
**Starting revision:** `da413c03` on `main`
**Scope:** quest, Star Chart, hub, activity, system, segment, equipment, syndicate, source-catalog, and milestone progression relationships.

## Architecture and baseline

The application did not have one complete graph consumer. Atomic gates lived in `src/catalog/prereqs/prereqRegistry.ts`; Star Chart node and junction unlocks were duplicated in `src/domain/catalog/starChart/nodes.ts`; acquisition source records in `src/catalog/sources/curatedSources.ts` and the generated `SOURCE_INDEX` held additional prerequisite references; and `MILESTONE_REGISTRY` contained rollup rules that `milestoneEngine.ts` was not evaluating. Player quest/system progress is persisted in `state.prereqs.completed`; syndicate ranks and Mastery Rank are derived from their trackers, while Star Chart nodes and some manual gates have separate completion inputs.

Before changes, the central registry held 158 entries and 217 direct prerequisite edges. Its newest prerequisite-bearing story content was **The Old Peace**, released in **Update 41 on December 10, 2025**. The milestone rollups had no release metadata; their main-story spine also ended at The Old Peace. These are the prerequisite and milestone cutoffs, not the newest content anywhere in the repository.

Coverage differed by subsystem:

| Subsystem | Newest identifiable pre-change content | Update / date | Evidence used to identify the cutoff |
|---|---|---|---|
| Prerequisite registry and main-story milestone spine | The Old Peace | Update 41 / Dec 10, 2025 | Registry and milestone definitions; [official Update 41 notes](https://www.warframe.com/en/patch-notes/pc/41-0-0) |
| Star Chart | Vesper Relay / Follie's Hunt group | Update 42 / Mar 26, 2026 | Existing Vesper Relay nodes; [official Update 42 notes](https://www.warframe.com/en/patch-notes/pc/42-0-0) |
| Curated vendor/acquisition sources | Cephalon Melica | Update 44 / Sep 23, 2026 | Existing curated source record; [official Update 44 notes](https://www.warframe.com/en/patch-notes/pc/44-0-0) |
| Milestone rollups | The Old Peace main-story milestone; individual rollups have no release tags | Update 41 / Dec 10, 2025 | Existing milestone rules; no finer release cutoff is encoded |

The repository’s patch-note index and PC update forum identify **Iceblade of Narin: The Icebind Hotfix 44.1.4.1** (October 27, 2026) as the newest PC hotfix as of November 9. The next major update, Warframe: Tau, was announced for December and remained unreleased on the review date. See the [official PC patch-note index](https://www.warframe.com/en/patch-notes/pc), [PC update forum](https://forums.warframe.com/forum/3-pc-update-notes/), and [Tau announcement](https://www.warframe.com/tau).

## Research and additions

Official notes and relevant hotfixes were reviewed from Update 41 through Update 44.1.4.1, including Updates 41.1, 42, 43, 43.5, 44, 44.1, and 44.1.2. The current PC update index was rechecked on November 9. Older sources were revisited where the baseline contained questionable gates, including Updates 29, 33.5, 35.5, 38.5, and 39. The official notes were cross-checked against current Warframe Wiki pages for detailed junction, activity, syndicate, and access mechanics. The [Operation: Taubound announcement](https://www.warframe.com/en/news/epoch-operation-taubound) and [October 2026 event calendar](https://www.warframe.com/en/news/october-in-warframe) were checked for the event window, Vor's Prize entry requirement, and permanent Tau Prologue availability.

The current prerequisite registry has 188 entries. Compared with the starting revision, 33 entries were added and three obsolete pseudo-junction entries were removed. Additions by registry category:

| Category | Added entries | Examples |
|---|---:|---|
| Quests | 3 | Jade Shadows: Constellations; The Hex Finale; Tau Prologue Quest Series |
| Hubs | 3 | La Cathédrale; Pontis Tower; Yuvan Peak |
| Railjack | 1 | Uranus Proxima |
| Syndicates | 3 | Quills Rank 5; Vox Solaris Rank 4; Entrati Rank 4 |
| Systems | 23 | Follie's Hunt, The Icebind, Dark Refractory routes, Tau-bound activities, manual quest/KIM/rank milestones, and access gates |

Thirteen entries cover content introduced after the Update 41 baseline: two quests, two hubs, eight systems/activities, and Uranus Proxima. The remaining additions fill older progression coverage or represent corrected classifications and gates. The full entry, dependency, completion-source, and evidence inventory is generated at [PREREQUISITE_AUDIT_INVENTORY.md](./PREREQUISITE_AUDIT_INVENTORY.md).

## Verified corrections and graph behavior

- Removed false Star Chart junctions for Mars → Deimos, Earth → Lua, and the Kuva Fortress. Deimos now opens after the War node on Mars; Lua access follows The Second Dream; Kuva Fortress access follows The War Within. The Ceres → Jupiter/Phobos representation was also corrected: Ceres is an optional branch, while the Jupiter Junction is located on Deimos and requires Heart of Deimos. Legacy completion keys remain recognized where player saves could contain the old pseudo-node IDs. Sources: [current Deimos access](https://wiki.warframe.com/w/Deimos), [junction reference](https://wiki.warframe.com/w/Junctions), and [Update 39](https://www.warframe.com/en/patch-notes/pc/39-0-0).
- Corrected two swapped early Junction mappings while preserving their existing imported profile IDs: `node:junction_venus_earth` is the Venus Junction on Earth and unlocks Venus; `node:junction_mercury_venus` is the Mercury Junction on Venus and unlocks Mercury. Earth is now the starting Star Chart planet. The Venus Junction follows The Teacher under Update 40; Mercury Junction’s tracked hard gates now use Vox Solaris and Jackal at Fossa, with Vox Solaris already implying the preceding Venus Junction. Junction completion is derived from the Star Chart node in both directions, so imported progress and manual chart tracking update the prerequisite graph without a duplicate checkbox. Official sources: [Update 40](https://www.warframe.com/en/patch-notes/pc/40-0-0), [Update 39](https://www.warframe.com/en/patch-notes/pc/39-0-0), and the [current Junction reference](https://wiki.warframe.com/w/Junctions).
- Corrected the story/junction chain to avoid duplicating a junction’s task as a second direct quest gate. The Second Dream follows the Uranus → Neptune Junction; The War Within follows Neptune → Pluto; the junction task grants the corresponding quest. Natah now follows The Archwing under the current chart flow.
- Kept The Archwing quest’s Earth → Mars Junction unlock separate from the Archwing task required by the Europa → Saturn Junction, consistent with the current junction tasks and the [Update 38.5 junction change](https://www.warframe.com/en/patch-notes/pc/38-5-0).
- The New War requires Prelude to War, a constructed Railjack, and an Operator Amp. An owned Necramech is not modeled as a hard gate; the Mote Amp implies the generic Amp requirement. Sources: [Update 38.5](https://www.warframe.com/en/patch-notes/pc/38-5-0) and [Update 33.5](https://www.warframe.com/en/patch-notes/pc/33-5-0).
- Chains of Harrow follows the Onkko visit milestone rather than a Saya's Vigil or Mote Amp requirement. The Quills/Vox rank routes, Amp-part availability, Amp gilding alternatives, and Entrati rank progression were separated so rank gates do not inherit the Helminth segment’s MR8 requirement. Sources: [Update 35.5](https://www.warframe.com/en/patch-notes/pc/35-5-0), [The Quills](https://wiki.warframe.com/w/The_Quills), [Vox Solaris](https://wiki.warframe.com/w/Vox_Solaris_%28Syndicate%29), and [Entrati](https://wiki.warframe.com/w/Entrati).
- Full Focus access now requires both a Quills visit and Saya's Vigil. The previous Quills Rank 1 dependency was too restrictive; the current Focus reference specifies the quest and Quills access, while The War Within is already in the Quills visit chain. Source: [Focus](https://wiki.warframe.com/w/Focus).
- Sorties and Arbitrations now include their tracked eligible-rank-30 Warframe condition. Sorties also require completion of Oro on Earth; Arbitrations follow the Focus Lens task on the Eris Junction path, not a blanket requirement to clear the full later branch. The rank/forma eligibility remains a manual gate because imported player data does not expose enough Warframe rank/forma detail. Sources: [Sorties](https://wiki.warframe.com/w/Sortie) and [Arbitrations](https://wiki.warframe.com/w/Arbitrations).
- Invasions no longer inherit an incorrect Mars Junction requirement; the registry tracks their broad availability after Vor's Prize and documents node-specific temporary access separately.
- Update 41's Mission Preview is modeled as a conditional manual opt-in after The Teacher. The Teacher alone does not claim that the player used Preview; completing The Old Peace or explicitly opting in grants Dark Refractory access. Preview does not unlock La Cathédrale, Devil's Triad vendors, KIM, or other quest-gated content. MR10 is only a public-matchmaking restriction. Source: [Update 41 notes](https://www.warframe.com/en/patch-notes/pc/41-0-0).
- Current post-baseline gates cover Follie's Hunt and Aspirant Zorba (Update 42); Jade Shadows: Constellations, Uranus Proxima, The Kuva Wytch, and Scoria's Angel (Update 43); Fables & Frontiers and Amir Chemistry: Close (Update 43.5); Yuvan Peak (Update 44); The Icebind (Update 44.1); Tau Prologue and Operation: Taubound (Update 44.1.2). Sources: [Update 42](https://www.warframe.com/en/patch-notes/pc/42-0-0), [Update 43](https://www.warframe.com/en/patch-notes/pc/43-0-0), [Update 43.5](https://www.warframe.com/en/patch-notes/pc/43-5-0), [Update 44](https://www.warframe.com/en/patch-notes/pc/44-0-0), [Update 44.1](https://www.warframe.com/en/patch-notes/pc/44-1-0), and [Update 44.1.2](https://www.warframe.com/en/patch-notes/pc/44-1-2).

Prerequisite entries support mandatory AND parents, an alternative OR group, and independent typed conditions. The Unlock Graph, prerequisite page, planner, Dashboard, and next-steps panel now consume the alternative group consistently. The milestone resolver now evaluates the existing `all` and `any` rules. No external scraped progression data is treated as authoritative.

## Validation performed

`npm run audit:prerequisites` passes with 188 registry entries, 231 direct edges, six alternative references, 45 milestone rollups, 16,256 source entries, 514 Star Chart nodes, and 13 actual junction nodes. It checks prerequisite and quest/junction-condition cycles, condition references and supported value constraints, source/milestone references, junction-to-chart correspondence, and chart planet/node relationships.

- `npm test -- --run`: **308 tests passed across 38 files**. npm emitted an `Unknown cli config "--run"` warning because the package script already invokes `vitest run`; test execution completed successfully.
- `npm run build`: **passed** (`tsc -b` plus Vite); Vite emitted its existing large-chunk warning.
- `npm run validate:sources`: **passed**.
- Targeted ESLint on the prerequisite registry, audit script, dependency engines, and prerequisite tests: **passed**. `npm run lint` still fails on repository-wide lint debt: 1,870 errors and 37 warnings (1,907 findings total), chiefly `no-explicit-any`; the focused prerequisite lint passes.
- In-app browser review: the Prerequisites route loaded the 188-entry registry and showed Tau Prologue Quest Series gated by The Hex and The Old Peace; Star Chart list mode placed Venus Junction under Earth and Mercury Junction under Venus. No completion state was changed.
- `git -c core.whitespace=cr-at-eol diff --check`: **passed**.

## Outstanding evidence limitation

The graph integrity scan proves structural consistency, not factual correctness of every legacy edge. The inventory currently reports 116 entries without per-entry source metadata; 115 of those have a gate, and 150 direct relationships/conditions occur on entries without evidence metadata. The reviewed corrections and new post-cutoff entries have evidence records, but the remaining historical gates still need an edge-by-edge source review before Tenno-Hub can claim the entire legacy graph is individually verified. Junction completion remains synchronized from the actual chart node; the game does not expose per-task completion for every Junction through the imported profile, so those subtasks are not independently checked off here. These are the outstanding audit limitations; entries without requirements are not treated as errors merely for being roots. The chart resolver covers starting-planet access, planetary/region access, tracked Junction gates, and completion state, but it does not model mission-to-mission adjacency or each node-clearing route; existing `StarChartNode.edges` are not a verified progression graph.

Future content work should update the registry and completion source, add an evidence record for each changed direct gate, run `npm run audit:prerequisites`, and include representative Unlock Graph tests. The full generated inventory is the review checklist for closing the outstanding evidence rows.
