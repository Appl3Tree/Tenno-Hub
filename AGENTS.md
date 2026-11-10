# Warframe Progression Tracker — Codex Working Notes

## Task List

Tasks are organized by priority. Update this list as work progresses.

### Current Baseline (Commit `7deeeb9` on 2026-03-26)

- [x] Profile import restores Mod Builder saved builds
- [x] Owned mods support per-mod maximum rank tracking
- [x] Progenitor weapons support valence bonus and optional valence-element optimization at rank 40
- [x] Optimizer goals include `Burst`, `Scaling`, `Crit`, and `Status` (legacy `damage` maps to `Burst`)
- [x] Prime Resurgence / Varzia availability is integrated into world state and prime availability flows
- [x] Mod Builder exports build JSON plus math/output snapshots for optimizer debugging

### Working Queue

- [ ] Full application content reconciliation follow-up — reconcile the Wiki quest inventory with the Handbook, prerequisite registry, milestone rollups, and saved completion state; confirm current supported-content feeds across the app.
  - In progress (2026-11-10): the Handbook had 41 hard-coded entries and omitted Jade Shadows: Constellations, released Lua/Vessel chapters, and the separate Finale record. Wiki reconciliation found 47 released quests. The Handbook now derives quest identities and direct gates from the registry; an independent 47-entry fixture checks names, categories, group/order, registry coverage, rendered Handbook output, Jade's access path, Tau's AND/next-chapter path, and exclusion of unreleased/event content. Legacy Tau-series completion migration is covered. Final local checks: 335/335 tests, build, prerequisite graph audit (222 entries, 241 direct edges, 29 OR, 47 rollups), source validation, changed-file ESLint, and CRLF-aware diff check pass. Full ESLint remains at baseline (1,870 errors/37 warnings); external-data validation remains blocked by 13 NaN chances and one missing relic name in two upstream raw files. Wiki/official pages were accessible with no CAPTCHA, but the in-app browser could not reach the local app (localhost connection timeout; alternate Brave access denied), so live visual/responsive verification remains open; see `APPLICATION_CONTENT_RECONCILIATION.md`.
- [x] Comprehensive prerequisite audit, expansion, and dependency validation — inventory tracked progression, establish category-specific cutoffs, research and correct prerequisite gates, add missing content, validate the graph and application integration.
  - Phase 1 baseline recorded (2026-11-08, before adding content): the central registry has 158 gates and 217 direct prerequisite edges; its newest prerequisite-bearing quest is The Old Peace (Update 41, Dec 10, 2025). The milestone registry also ends at The Old Peace. The Star Chart includes the Vesper Relay/Follie's Hunt node group (Update 42 era) but lacks Uranus Proxima, Scoria's Angel, The Kuva Wytch, Pontis Tower, and Yuvan Peak. Curated vendor sources already include Cephalon Melica (Update 44). The 45 milestone entries use `rule`, but the resolver ignores it; five junction requirement lists are duplicated and disagree between the registry and Star Chart node data. The app's persistent completion source is sparse `state.prereqs.completed`; syndicate/mastery and Steel Path/Nightmare have derivation paths. See `PREREQUISITE_AUDIT.md` for the inventory, category cutoffs, baseline integrity scan, and evidence register.
  - Completed (2026-11-09; baseline established 2026-11-08): compared 158 initial registry entries / 217 direct edges against the current game; reviewed Updates 41.1 through 44.1.4.1 plus historical progression changes; added 67 persistent progression entries and removed five obsolete entries. Current inventory: 220 entries, 239 direct AND edges, 29 OR references, 46 milestone rollups; all registry entries have source metadata, and every hard gate has current required/conditional evidence. Added recursive AND/OR/typed-condition evaluation, corrected milestone rules, Junction alignment, and automated graph/evidence checks. Temporary Operation: Taubound was removed because it unlocks no persistent progression; time-limited events appear through the active World State event feed. `npm run audit:prerequisites`, `npm run validate:sources`, `npm run build`, and `npm test` (329 tests/38 files) pass. Focused prerequisite lint and CRLF-aware diff checks pass; full ESLint retains the repository baseline of 1,870 errors / 37 warnings. Remaining supported-scope limits: mission-to-mission reachability is not modeled because Star Chart edges are map-layout data; imported profiles do not expose individual Junction task checkmarks. Details and per-entry inventory: `PREREQUISITE_AUDIT.md` and `PREREQUISITE_AUDIT_INVENTORY.md`.
- [x] Fix Build Planner mod compatibility and owned-mod availability for weapons missing curated item ancestry
  - Completed (2026-11-08): Sarofang Prime's WFCD weapon record has no parent lineage and is absent from the curated item ancestry catalog, so generic player-melee mods were filtered out before ownership checks. The compatibility matcher now treats that generic melee path as compatible with non-beast melee weapons. In the in-app browser, imported owned melee mods appeared in the Sarofang picker with correct ownership labels, and a temporary build selection succeeded before being reset. No profile-derived values were added to source or documentation.
- [x] Expand Build Planner weapon coverage to include archguns, arch-melee, and companion weapons with correct mod/stance/arcane eligibility
- [x] Audit unknown acquisition / blueprint-source gaps and generate a repeatable report
- [ ] Implement Incarnon evolutions in the Build Planner and optimizer, including unlocked/chosen evolution selection plus optional evolution-path optimization
- [x] UX overhaul Phase A — establish build/lint/test/data-validation baseline, inspect the live app and source, and record a prioritized evidence-based audit in `UX_AUDIT.md`
- [x] UX overhaul Phase B — centralize theme state, add semantic theme tokens, and migrate shared shell/search/inspector surfaces
- [x] UX overhaul Phase C — make navigation categories, route selection, collapsed navigation, and mobile navigation consistent while preserving Page Jump and catalog search
- [x] UX overhaul Phase D — improve shared interaction patterns, search overlays, and contextual inspector accessibility/history
- [x] UX overhaul Phase E — complete explicit page-by-page responsive/theme/workflow reviews and fix high-friction UX issues without changing progression calculations or canonical data
  - Completed (2026-11-06): reviewed all 18 routes in light and dark themes at 390px, 768px, and 1280px in the in-app browser. Fixed issues found in responsive layout, Prerequisites rendering, Build Planner selector keyboard behavior/semantics, Page Jump Escape focus handling, and light-theme accent contrast. Representative interaction paths are recorded in `UX_AUDIT.md`.
- [x] UX overhaul Phase F — run release gates, visual QA, route/workflow/persistence/accessibility checks, and capture before/after evidence
  - Completed (2026-11-06): production build and all 235 tests pass; source validation, targeted ESLint, theme contrast tests, and diff checks pass. The repo-wide lint and external-data validator retain documented baseline failures. Theme persistence, navigation, search/history, dialog focus, workflow routing, and responsive layout were checked in the in-app browser; see `UX_AUDIT.md`.
- [x] Content-first workspace Phase 1 — inspect live catalog scroll ownership, virtualization sizing, and high-density routes; record before measurements and targeted route audit in `UX_AUDIT.md`
  - Completed (2026-11-07): Inventory, Mods, and Arcanes each had nested workspace/list vertical scrolling and tall filter stacks. At 1280×720 their virtual lists measured about 238px, 129px, and 249px; at 1440×900 they measured 395px, 303px, and 383px. Inventory mobile flex sizing also allowed all 869 rows to render at once. Goals, Requirements, Prerequisites, Syndicates, and Star Chart use natural-flow content or intentional map/modal scrolling; Relic Farming had a 600px bounded relic selector for targeted review.
- [x] Content-first workspace Phase 2 — add shared collection toolbar, filter disclosure/summary, scroll surface, and resize-observed virtualization
- [x] Content-first workspace Phase 3 — move Inventory controls into the compact collection workspace while preserving every existing filter, action, category, column control, and virtualized row
- [x] Content-first workspace Phase 4 — apply the shared content-first collection pattern to Mods and Arcanes without changing their filter semantics or detail workflows
- [x] Content-first workspace Phase 5 — audit other routes and adjust relic farming's mobile selector to avoid nested page/list vertical scrolling
- [x] Content-first workspace Phase 6 — complete automated release gates and final responsive/theme/browser verification
  - Completed (2026-11-07): all 239 tests pass across 30 files; `npm run build` passes (`tsc -b` plus Vite). In-app browser checks covered the six requested viewport sizes, filter state and chips, keyboard scrolling, light/dark appearance, and the Relic Farming mobile scroll change. Shared components and Shell pass targeted ESLint; including `RelicFarming.tsx` reports the unchanged baseline `no-explicit-any` cast at line 13. `git diff --check` with CRLF whitespace handling passes.
- [x] Content-first workspace Phase 2 — implement shared single-scroll ownership, compact catalog toolbar, and reusable advanced-filter disclosure/chip pattern
  - Completed (2026-11-07): established the shared collection scroll surface, ResizeObserver-based viewport/row-window hook, pure virtual-window calculator with unit coverage, accessible Filters disclosure, and compact removable active-filter summary. The proven route implementation follows in Phases 3–4.
- [ ] Content-first workspace Phase 3 — migrate Inventory without losing any filters, categories, columns, actions, or virtualization behavior
- [ ] Content-first workspace Phase 4 — migrate Mods and Arcanes while preserving their specialized filter and list behavior
- [ ] Content-first workspace Phase 5 — review remaining data-heavy routes and make targeted content-first improvements where the audit shows a real layout defect
- [ ] Content-first workspace Phase 6 — verify responsive viewports, interactions, themes, virtualization, automated checks, and browser screenshots; push and merge the completed change
- [x] AlecaFrame `lastData.dat` import Phase A — inspect PR #6, current state, source format, and the real local sample; record verified section semantics and concrete gaps
  - Completed (2026-11-07): reviewed the PR diff and current `main`, read `ARCHITECTURE.md`, and independently decrypted the supplied snapshot. AES-CBC/PKCS#7, UTF-8 JSON, optional `InventoryJson` wrapper, per-copy versus stacked sections, and the top-level field/type schema were checked against independent readers. Added a privacy-safe schema list and importer notes. The remaining exact catalog gap is documented as a deferred coverage limitation; sample-derived identities stay out of static catalogs and docs.
- [x] AlecaFrame `lastData.dat` import Phase B — complete validated parsing, canonical identity reconciliation, equipment/items/resources/blueprints, ranked mods/arcanes, and personalized Riven handling
  - Completed (2026-11-08): the production catalog combines exact Lotus paths from WFCD and Overframe, with generated supplements from Public Export Plus and a pinned historical upgrade fallback. `RawUpgrades` imports stacked Riven templates as generic counted stacks, separate from personalized fingerprinted Rivens; Peely Pix stacks are also recognized as counted items. Section accounting marks successful records as imported. Twelve item identities from the local sample remain in the unresolved report and are an accepted deferred coverage limitation; no sample-derived mapping is added to the catalog.
- [x] AlecaFrame `lastData.dat` import Phase C — implement deterministic dry-run reconciliation, conflict choices, backup/recovery, atomic state updates, and persistence compatibility
  - Completed (2026-11-07): repeated imports compare unresolved rank data independent of property order; reimport after a real reload produced zero planned changes. Backup-before-apply, atomic update, rank-count persistence/migrations, and unresolved-report persistence are implemented. A confirmed Replace from Backup File path was verified to restore the pre-import state across reload while the existing merge path remains available.
- [x] AlecaFrame `lastData.dat` import Phase D — complete accessible responsive Imports & Backups workflow with categorized preview, issue search, and explicit confirmation
  - Completed (2026-11-07): file selection, review tables, section accounting, unresolved acknowledgement, personalized Riven review, generic Riven-stack display, and two-step confirmation are implemented. The replace confirmation focuses Cancel first and returns focus when canceled. The route was checked at 390, 768, and 1280 pixels in light and dark themes with no horizontal overflow.
- [x] AlecaFrame `lastData.dat` import Phase E — run synthetic and real-sample validation, full automated gates, and browser verification in light/dark themes and responsive sizes
    - Completed (2026-11-08): all 278 tests pass across 36 files; `npm run build`, `validate:sources`, and targeted ESLint pass. Full-repository ESLint and external-data validation retain documented baseline failures. Browser checks covered real-file preview, no-result search and recovery, malformed input, unresolved acknowledgement, backup-before-apply, persistence, zero-change reimport, backup restore, responsive layout, and both themes. The imported test profile was restored from its pre-import backup.
- [ ] AlecaFrame `lastData.dat` import Phase F — document the accepted coverage limitation, update PR, and complete branch integration and delivery when permitted
- In progress (2026-11-08): added the pinned Public Export Plus source for exact path records and ability localization, visibly marked path-derived labels for standalone recipe identities with no localized result name, and a last-resort exact upgrade fallback from the 2018 IhToN catalog. The fallback is generated from the entire upstream upgrade file, excludes every identity already in maintained catalogs, and adds four generic legacy records; it is not derived from the supplied profile. The upstream repository has an MIT license notice, but that does not establish a separate license for Digital Extremes game data. Refreshed WFCD item and drop snapshots after the required dry-run check.
  - Repository-wide data-source review traced WFCD drop data through `src/catalog/items/acquisitionFromDropData.ts`, `src/catalog/sources/sourceCatalog.ts`, `src/pages/Inventory.tsx`, `src/pages/relics/RelicFarming.tsx`, `src/pages/Mods.tsx`, `src/pages/Arcanes.tsx`, and the Star Chart adapters. These tables power acquisition, vendor, relic, mod-location, Inventory, and map features; their reward-name joins do not create exact Lotus `ItemType` identities.
  - Additional exact-identity research checked the current catalog trees, all 26 Public Export Plus manifests at the pinned commit, all 14 JSON files in the pinned IhToN repository, Warframe.market's current `gameRef` catalog, its `wfm-items` repository (including all 35 manual, untracked item records), the Wiki `Module:InternalNames` table, WarframeStatus, WFCD Worldstate language data, Crossframe, browse.wf, Warframe Tools, WFData, local AlecaFrame catalog caches, and Aericio's Public Export mirror. No usable exact item record was found for the remaining identities. The WFM GitHub repository declares no license, and its 35 checked records expose no exact game paths. One Public Export reference occurs only as a recipe `resultType`; the recipe provides no standalone identity, display name, or supported product category. The local Warframe cache and Puxtril's exporter were reviewed as a possible offline lead; extracted game data was not added as a redistributable source.
  - The latest local reparse has 12 distinct item identities unresolved, zero unresolved upgrade identities, and zero hard parse errors. The full external-source-tree scan excluded pre-existing profile fixtures and found no exact hits in the checked identity catalogs beyond the non-identity recipe reference. A scan of modified and new files found no exact personalized Riven instance IDs or fingerprints. The user accepted these 12 identities as a deferred coverage limitation. Keep the exact account-specific paths out of static data and documentation; preserve the importer's unresolved-record report and revisit only if a supported source or verified explanation becomes available. This accepted gap does not block PR #6.
- [x] Profile import Account ID discovery and profile-data link — show how to copy `gid` from Warframe's cookie table and open the platform-correct public JSON endpoint
  - Completed (2026-11-08): added Chrome/Edge and Firefox DevTools steps, explained why the HttpOnly cookie cannot be auto-read by the site, and updated the new-tab link to use the supplied API hosts. Added Android to platform selection and Progress Pack validation.
- [ ] AlecaFrame catalog follow-up — revisit the 12 unmatched identities from the supplied local sample only if a supported exact source or verified non-inventory explanation becomes available; keep their account-specific paths out of source and documentation.

### Intake Rule

- [ ] If multiple tasks are requested at once, ask which one to focus on first
- [ ] Add the remaining requested tasks to `Working Queue` before starting implementation

### 🔴 Critical (Wiki-Aligned Damage Model / Optimizer)

#### Damage Calculation Corrections

- [ ] Update quantization from `1/16` to `1/32`
- [ ] Change scale to `Scale = Modded Base Damage / 32`
- [ ] Quantize each physical damage type separately
- [ ] Quantize each elemental contribution separately
- [ ] Quantize combined elemental sums as the final combined element
- [ ] Ensure physical/elemental bonuses do not affect scale
- [ ] Apply non-elemental multipliers after quantization
- [ ] Separate `Arsenal Total Damage` from actual inflicted damage
- [ ] Apply target damage-type modifiers per damage type after quantization
- [ ] Add unarmored target damage math
- [ ] Add armored target damage math from the wiki formula
- [ ] Model toxin shield bypass correctly
- [ ] Update gun effective fire rate by trigger type:
  - [ ] Auto / Semi / Duplex / Held
  - [ ] Charge
  - [ ] Burst
- [ ] Use `Shots Per Magazine = Modded Mag Size / Ammo Cost Per Shot`
- [ ] Update sustained DPS to the wiki shooting-vs-reloading proportion formula
- [ ] Add melee DPS math using average combo multiplier and base combo length

#### Damage Over Time / Status Math

- [ ] Implement DoT math from the wiki:
  - [ ] Modded base damage
  - [ ] Modded multishot
  - [ ] Faction double-dip
  - [ ] Total ticks
  - [ ] Slash / Electricity / Heat / Toxin / Gas multipliers
  - [ ] Damage distribution weighting
  - [ ] Crit expectation
  - [ ] Status chance expectation
- [ ] Split UI/output into:
  - [ ] Arsenal damage
  - [ ] Direct inflicted damage
  - [ ] Expected DoT
  - [ ] Burst DPS
  - [ ] Sustained DPS

#### Status Effect Accuracy (Wiki-Aligned)

- [ ] Implement enemy status stack caps so status value is bounded correctly:
  - [ ] Impact max 5
  - [ ] Puncture max 5
  - [ ] Cold max 10
  - [ ] Blast max 10
  - [ ] Corrosive max 10
  - [ ] Gas max 10
  - [ ] Magnetic max 10
  - [ ] Radiation max 10
  - [ ] Viral max 10
  - [ ] Tau max 10
- [ ] Model status durations by type:
  - [ ] Impact 1s
  - [ ] Puncture 10s
  - [ ] Slash 6s
  - [ ] Heat 6s
  - [ ] Cold 6s / 3s freeze at stack 10
  - [ ] Electricity 6s
  - [ ] Toxin 6s
  - [ ] Blast 1.5s to detonation
  - [ ] Corrosive 8s
  - [ ] Gas 6s
  - [ ] Magnetic 6s
  - [ ] Radiation 12s
  - [ ] Viral 6s
  - [ ] Tau 8s
- [ ] Model DoT tick timing correctly:
  - [ ] Slash / Heat / Toxin start after 1 second delay
  - [ ] Electricity / Gas tick immediately at 0s
  - [ ] Blast detonation timing and premature detonation behavior
- [ ] Model Heat-specific behavior:
  - [ ] Panic duration
  - [ ] Gradual armor strip to 50%
  - [ ] Heat inherit / refresh behavior if we choose to support it in simulation
- [ ] Model Cold-specific behavior:
  - [ ] Slow scaling by stacks
  - [ ] Crit multiplier bonus by stacks
  - [ ] Freeze at 10 stacks
  - [ ] 3 residual stacks after freeze ends
- [ ] Model Puncture-specific behavior:
  - [ ] Enemy damage reduction by stacks
  - [ ] Additive crit chance taken by stacks
  - [ ] Restriction against AoE / ability scaling where applicable
- [ ] Model Impact-specific behavior:
  - [ ] Mercy threshold increase by stacks
  - [ ] Stagger behavior
- [ ] Model Corrosive-specific behavior:
  - [ ] 26% first stack
  - [ ] +6% per additional stack
  - [ ] 80% cap at 10 stacks
- [ ] Model Viral-specific behavior:
  - [ ] 100% first stack
  - [ ] +25% per additional stack
  - [ ] 325% cap at 10 stacks
- [ ] Model Magnetic-specific behavior:
  - [ ] Shield / overguard amplification by stacks
  - [ ] Shield regen suppression
  - [ ] Electricity proc on shield / overguard break
- [ ] Model Radiation-specific behavior:
  - [ ] Friendly-fire confusion utility
  - [ ] Damage-to-allies scaling by stacks
- [ ] Model Gas-specific behavior:
  - [ ] Radius growth by stacks
  - [ ] AoE DoT behavior around target
- [ ] Model Blast-specific behavior:
  - [ ] Single-target delayed damage
  - [ ] 10-stack premature detonation
  - [ ] Death-triggered premature detonation
  - [ ] Higher damage to surrounding enemies vs initial target
- [ ] Model Tau-specific behavior:
  - [ ] Status vulnerability stacks
  - [ ] Increased received status chance
- [ ] Recalculate proc type weights when target is immune to a proc type
- [ ] Add handling for fully status-immune targets
- [ ] Add handling for partially status-immune targets
- [ ] Add support for forced procs independent of status chance
- [ ] Distinguish player-only / enemy-only status behavior where needed
- [ ] Audit which statuses should count as separate Condition Overload / Galvanized states

#### Optimizer Correctness

- [ ] Finish element ordering correctness across all build paths
- [ ] Make optimizer scoring reflect crit tiers, not just raw crit chance
- [ ] Make multishot affect expected hit count, crit rolls, and status rolls correctly
- [ ] Ensure faction damage double-dips on DoT statuses where applicable
- [ ] Separate direct-hit damage from DoT/status value in the scoring pipeline
- [ ] Make status weighting/proc chance use final quantized damage-type contribution consistently
- [ ] Ensure displayed damage breakdown includes every final modded damage type
- [ ] Audit the optimizer against the current wiki formulas and mark each subsystem as `correct`, `approximation`, `incorrect`, or `missing`

### 🟠 High Impact (Status / Utility Modeling)

- [ ] Add explicit scoring for Heat armor strip plus DoT
- [ ] Add explicit scoring for Viral health amplification
- [ ] Add explicit scoring for Corrosive armor strip and stack assumptions
- [ ] Add explicit scoring for Cold and Puncture as crit-support statuses
- [ ] Add explicit scoring for Toxin as shield-bypass value
- [ ] Add scenario-aware handling for Magnetic
- [ ] Add AoE-aware scoring for Electric and Gas
- [ ] Add better Blast handling as conditional AoE/utility
- [ ] Add per-target state simulation for:
  - [ ] Slash
  - [ ] Heat
  - [ ] Electric
  - [ ] Toxin
  - [ ] Gas
  - [ ] Viral
  - [ ] Corrosive
  - [ ] Cold
  - [ ] Blast
  - [ ] Magnetic
  - [ ] Radiation
  - [ ] Impact
- [ ] Add target/profile toggles:
  - [ ] Armored
  - [ ] Shielded
  - [ ] Overguard
  - [ ] Boss / attenuation
  - [ ] Crowd-clear
  - [ ] Endurance / DoT
- [ ] Improve utility scoring for punch-through, fire rate, reload, ammo efficiency, projectile velocity, and similar mods

### 🟡 High Impact (UX & Performance)

- [x] Add React error boundaries to every page (prevents full-page crashes when logic engines throw)
- [x] Add unit tests for the 16 logic engines — especially `requirementEngine`, `goalExpansion`, `processInvasions`
- [x] Fix WorldState 1-second timer (`useNow()`) to only re-render the active tab
- [x] Add confirmation step before profile import (currently merges immediately with no undo)
- [x] Add `useShallow` to heavy Zustand selectors in Goals and Requirements pages
- [x] Virtualize long lists: Inventory (already done), Mods (3000+ — mods + arcanes sections), Challenges (300 grid cards — acceptable without virtualization)
- [x] Complete light mode across all components (styles.css has comprehensive .theme-light remapping for all slate-* classes)
- [x] Extract duplicate profile import logic (`importProfileViewingDataJson` and `importProfileFromWarframeStatApi` are ~80% identical)
- [x] Add backup-before-migration to prevent data loss if schema migration fails

### 🟣 Explainability / UX

- [ ] Show optimizer assumptions clearly:
  - [ ] Target profile
  - [ ] Expected crit tier
  - [ ] Proc mix
  - [ ] Direct-hit contribution
  - [ ] DoT contribution
  - [ ] Armor / shield assumptions
- [ ] Add a “why this build won” panel
- [ ] Show proc-weight distribution more clearly

### 🟠 UX Polish

- [x] Fix invasion completion % to use runsCompleted / runsRequired instead of API-provided value
- [x] Add "almost complete" goal highlighting (e.g. highlight goals that are 90%+ done)
- [x] Link farming sources in Requirements page back to the Star Chart node
- [x] Add completion status overlay on Star Chart drop panels
- [x] Make Handbook more discoverable (consider surfacing on dashboard for new players)

### 🟢 Data / Infrastructure

- [x] Replace `src/data/All.json`, `wfdata.json`, `modsets.json`, `rivens.json`, `sources.json`, `moddescriptions.json` with imports from `external/warframe-items/raw/` and `external/warframe-drop-data/raw/`
- [x] Delete orphaned `src/data/` files with no TypeScript imports (patchlogs, variants, abilities, abilitystats, glyphs, modularparts)
- [x] Replace `_generated/wfcd-platinum.byPath.auto.json` with `marketCost` field from `All.json`
- [ ] Write generation scripts for remaining `_generated/` files (currently committed as stale artifacts):
  - [ ] `generateWfcdItems.ts` → `wfcd-items.byCatalogId.auto.json`
  - [ ] `generateWfcdAcquisition.ts` → `wfcd-acquisition.byCatalogId.auto.json`
  - [ ] `generateWfcdRequirements.ts` → `wfcd-requirements.byCatalogId.auto.json`
  - [ ] `generateSourceLabelMap.ts` → `wfcd-source-label-map.auto.json` / `source-label-map.auto.json`
  - [ ] `generateRelicMissionIndex.ts` → `relic-missionRewards-index.auto.json`
- [ ] Run generation scripts to regenerate all `_generated/` files from external sources
- [ ] Add npm script (e.g. `generate:data`) to run all generation scripts in order

### 🔵 New Features (Roadmap)

- [x] Relic farming assistant (void fissure tier optimizer, void trace calculator)
- [x] Mod ownership tracking (prerequisite for loadout planning)
- [x] Vaulted/unvaulted item status integration
- [ ] Nightwave challenge optimizer ("which weeklies give max creds fastest?")
- [ ] Steel Path rotation calendar (when does my target item return?)
- [ ] Full set-mod bonus implementation
- [ ] Full Galvanized conditional/proc-stack verification
- [ ] Full arcane optimization verification

---

## Working Conventions

- Run `tsc -b` before committing to catch type errors
- Data refresh and generation workflow lives in `DATA_WORKFLOW.md`
- Use `npm run update:data:check` before overwriting WFCD raw source files
- Use `npm run generate:wiki-blueprints` after replacing `external/wiki/blueprintsDatabase.txt`
- Logic engines in `src/domain/logic/` are pure functions — keep them that way
- Canonical IDs live in `src/domain/ids/` — use enums, never raw strings
- State mutations go through Zustand + Immer in `src/store/store.ts`
- New acquisition sources belong in `src/catalog/` as a new adapter file
