# Tenno-Hub Application Content Reconciliation

Reviewed against the current WARFRAME Wiki and official PC patch index on **November 10, 2026**. Wiki pages were opened and read in the in-app browser; no CAPTCHA or interactive access restriction appeared.

## Coverage baseline

Before this follow-up, the Handbook's independent quest array contained **41 entries** and ended with **The Old Peace** (Update 41, December 10, 2025). That was the Handbook's visible-content cutoff, not the prerequisite registry's cutoff. The registry already had Jade Shadows: Constellations, but the Handbook did not. It represented Prologue to Tau as one internal “Tau Prologue Quest Series” completion gate, so the released Lua and Vessel chapters had no distinct Handbook or completion identities. The Handbook also treated Prelude to War as one quest instead of listing its three playable chapters.

The currently released quest inventory on the Wiki has **47 entries**: 29 Main Quests, 6 Side Quests, and 12 Warframe Quests. The independent expected inventory is maintained in [`wikiQuestInventory.fixture.ts`](src/catalog/quests/__tests__/wikiQuestInventory.fixture.ts). The Wiki currently shows a future Tau chapter as `???`; it is not released, has no canonical quest identity, and is intentionally excluded. Epoch Operation: Taubound is temporary and does not unlock persistent progression; it is not represented in the prerequisite graph or Handbook quest inventory.

The official PC patch index currently ends at **Iceblade of Narin: The Icebind Hotfix 44.1.4.1, October 28, 2026**. Recent progression releases checked were Updates 42, 43, 43.5, 44, 44.1, Hotfix 44.1.2, and subsequent hotfixes through 44.1.4.1. Hotfix 44.1.4.1 contains no newer quest or progression gate. The WFCD item, drop, and Public Export Plus snapshots in the repository were synced on November 8, after that latest release.

## Feature and data flow matrix

| Supported content | Canonical source and transformation | User-facing consumers | Completion / availability | Reconciliation result |
|---|---|---|---|---|
| Quests and access gates | `PREREQ_REGISTRY` holds stable quest IDs, current names, direct AND/OR/typed requirements, and evidence. `questCatalog.ts` derives every `quest_*` entry from that registry and adds only Handbook grouping/order/summary metadata. | Handbook; Prerequisites; Unlock Graph; Dashboard next-step planner; quest-linked systems and sources | Quest completions use `state.prereqs.completed`; profile migration and progress-pack import preserve aliases. | The rendered Handbook now matches all 47 independently listed Wiki quests in identity, name, category, and order. It resolves names and direct access gates from the shared registry instead of maintaining another quest list. |
| Mainline milestones | `MILESTONE_REGISTRY` contains `all`/`any` rollups; `milestoneEngine` evaluates the rule against canonical completion IDs. | Milestone and progression views that consume milestone snapshots | Derived from the same quest completion IDs. | Jade Shadows: Constellations now has a Mainline milestone. Prologue to Tau's rollup requires both released chapters; it does not count unreleased content. |
| Star Chart, missions, junctions, and hubs | `domain/catalog/starChart/{planets,nodes}.ts` defines supported map entities; prerequisite registry maps quest gates to those entities; source adapters resolve drop/acquisition data. | Star Chart map, list, Proxima, and Duviri views; Prerequisites; Requirements | `state.missions.nodeCompleted`, derived junction state, and manual system completion | Current inventory contains 514 Star Chart nodes and 13 actual Junction nodes. Update 43's Uranus Proxima, The Kuva Wytch, Scoria's Angel, and Pontis Tower, plus later Yuvan Peak, are represented. Junction definitions and chart nodes reconcile with no dangling references. Mission-to-mission reachability is outside the current model because map edges describe layout, not access rules. |
| Equipment and owned inventory | Pinned WFCD item snapshots, Public Export Plus exact identity supplements, and catalog adapters create supported item identities; generated item/acquisition indexes feed the app. | Inventory, Build Planner, Mods, Arcanes, Requirements, Relics, and imports | Owned counts/ranks and profile-import data persist in user state | The pinned item/drop/Public Export Plus snapshots were refreshed November 8 and include current upstream categories. The latest official release verified was October 28. No new inventory identity was needed for the quest and access corrections in this follow-up. |
| Acquisition and vendor sources | WFCD drop/source data, Wiki blueprint data, and curated/manual source adapters are resolved into the source index. | Requirements, Inventory acquisition details, Relics, Star Chart drop panels, vendor pages | Source availability is data-driven; owned state remains in inventory | The prior prerequisite audit's source validator covers 16,256 source entries. No temporary operation was added as a persistent acquisition or prerequisite gate. |
| World State events | Runtime World State feed, not the persistent progression registry | World State / World Events | Event visibility follows the live event feed and its active window | Taubound remains excluded from permanent progression. Its event record belongs in the time-sensitive World State surface only while active. |
| Handbook reference guidance | Quest facts are now sourced from the canonical prerequisite registry; other guide sections remain explanatory content, not completion catalogs. | Handbook | No separate quest completion state | The quest guide's old incorrect claims about full Star Chart access from Vor's Prize, Simaris/Synthesis in The Teacher, Corpus unlocks from Once Awake, personal Necramech ownership for The New War, and Kuva/Lua unlocks from Chimera Prologue were removed. The guide now says The Maker, the current canonical display name. |

## Implemented corrections

- Added distinct, persistent completion IDs for **Lua** and **Vessel**. Lua directly requires both The Hex and The Old Peace; Vessel directly requires Lua. The old series ID remains as a migration alias only.
- Added **A Man of Few Words** to the prerequisite registry with its actual access requirement: access to any Relay to speak with Darvo. It has no preceding quest gate.
- Kept **Jade Shadows: Constellations**' direct Jade Shadows requirement and made it visible in the Handbook's Main Quests category.
- Added the missing Mainline milestone for Jade Shadows: Constellations and changed the Tau milestone to require both currently released chapters.
- Changed the UI display name for the Hex epilogue to **Finale**, matching the current Wiki section and quest index; kept its established completion ID and recorded that it is part of The Hex.
- Corrected visible canonical names to **Awakening** and **The Maker**. The Prelude to War group is presentation only; Chimera Prologue, Erra, and The Maker remain separate trackable quests.
- Migrated a saved `quest_tau_prologue_series: true` value to both released chapter completion IDs. Explicit per-chapter values take precedence, and the retired alias is removed. Migration and progress-pack import/restore are covered by tests.
- Changed the Handbook quest list into a projection of the shared registry. New registered quests are included automatically; tests require Handbook, registry, and an independent Wiki fixture to agree in both directions.

## Validation and sources

The prerequisite audit currently reports **222 registry entries, 241 direct required edges, 29 alternative references, 47 milestone rollups, 16,256 source entries, 514 Star Chart nodes, and 13 Junctions**. It reports no duplicate IDs or labels, dangling references, invalid conditions, cycles, redundant direct edges, invalid chart relationships, or missing hard-gate evidence.

The independent quest reconciliation verifies all **47** Wiki-index entries against the registry, Handbook projection, and server-rendered Handbook quest-name order. Focused quest/dependency/state-migration tests pass. The complete test suite passes **335 tests across 39 files**; the production TypeScript/Vite build and source validation pass. Focused ESLint on the changed content and quest files passes. Full-repository ESLint remains at the repository's recorded baseline of 1,870 errors and 37 warnings.

The raw external-data validator is not clean: **21 of 23** drop-data files pass; `all.slim.json` has 13 upstream `NaN` chance values and `relics.json` has one record with an undefined relic name. These source snapshots were not edited as part of this reconciliation.

### Live browser verification

After the user provided the accessible `/Tenno-Hub/` route, the in-app browser opened the running application. At the default **994×831** viewport, the Handbook displayed the complete 47-entry list; All/Main/Side/Warframe filters showed 47/29/6/12 entries. The visible list included Jade Shadows: Constellations, Lua, Vessel, A Man of Few Words, and the corrected direct access requirements.

At **390×844** and **768×1024**, the Handbook and Prerequisites page had no horizontal overflow. The Prerequisites page rendered Jade Shadows: Constellations as locked behind Jade Shadows, Lua behind both The Hex and The Old Peace, and Vessel behind Lua. At mobile width, the Star Chart's Proxima list showed the Uranus Proxima group with Pontis Tower, Scoria's Angel, and The Kuva Wytch; Yuvan Peak appeared in the Zariman list. The browser was returned to the default viewport and left on the Handbook. No CAPTCHA or Wiki access restriction appeared. No saved completion checkboxes were changed during browser inspection.

Research and validation sources:

- [WARFRAME Wiki: Quest index and progression](https://wiki.warframe.com/w/Quest)
- [WARFRAME Wiki: Prologue to Tau](https://wiki.warframe.com/w/Prologue_to_Tau), [Lua](https://wiki.warframe.com/w/Lua_(Quest)), and [Vessel](https://wiki.warframe.com/w/Vessel_(Quest))
- [WARFRAME Wiki: Jade Shadows: Constellations](https://wiki.warframe.com/w/Jade_Shadows:_Constellations) and [A Man of Few Words](https://wiki.warframe.com/w/A_Man_of_Few_Words)
- [WARFRAME Wiki: The Hex](https://wiki.warframe.com/w/The_Hex_(Quest)) for the separate epilogue's displayed name and access conditions
- [Official Update 43](https://www.warframe.com/en/patch-notes/pc/43-0-0) for Constellations and Uranus Proxima access
- [Official Update 43.5](https://www.warframe.com/en/patch-notes/pc/43-5-0), [Update 44](https://www.warframe.com/en/patch-notes/pc/44-0-0), [Update 44.1](https://www.warframe.com/en/patch-notes/pc/44-1-0), and [Hotfix 44.1.2](https://www.warframe.com/en/patch-notes/pc/44-1-2)
- [Official PC patch index](https://www.warframe.com/en/patch-notes/pc) and [Hotfix 44.1.4.1, October 28, 2026](https://www.warframe.com/en/patch-notes/pc/44-1-4)

## Known limits

- Star Chart map edges are not treated as mission unlock rules, so the application does not calculate every node-to-node route. It tracks the supported node, planet/region, junction, quest, and activity gates.
- Full-repository ESLint still reports its recorded baseline of 1,870 errors and 37 warnings; focused ESLint for the changed content and quest files passes. The changed files introduced no additional lint errors.
- Strict external-data validation still finds 13 `NaN` drop chances in `all.slim.json` and one missing `relicName` in `relics.json`; 21/23 drop-data files pass. These upstream raw data records were not altered here.
- The external-data updater's GitHub tree API check was unavailable in the earlier refresh attempt. The committed external snapshots are pinned and dated November 8, two days before the latest release reviewed here; they were not overwritten with unverified scraped data.
- The Wiki shows the next Prologue to Tau installment only as an unreleased `???`. It remains outside the tracker until it has a released name and verified access/completion behavior.
