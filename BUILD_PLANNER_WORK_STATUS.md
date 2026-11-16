# Build Planner Work Status

Last updated: 2026-11-16

This is the concise continuation checkpoint for the active Damage 3.0 / Build Planner objective. Read it before starting new work. `AGENTS.md` remains the detailed task history and acceptance criteria; do not reopen completed entries unless fresh evidence shows a regression.

## User requirements to carry forward

- Use current Warframe Wiki data for mechanics and calculated values. Do not ask the player to research or enter reference-table values.
- Use the Codex in-app browser for browser QA. Do not use Brave.
- The local dev app is on port 80: `http://localhost/Tenno-Hub/`.
- Merge and deploy each clean release milestone so the user can manually test the live app while work continues. PR #95 is merged and its Pages deployment succeeded.
- Continue the full Build Planner objective from the pasted specification; this checkpoint does not reduce its scope.

## Current repository and delivery state

- Branch: `codex/kohm-spool-data-followup`, based on `origin/main` at `06c0576` — merged PR #95. Local `main` is synced to the same commit.
- Recent delivered checkpoints: PR #89 (`b444ed2`, Wiki-backed stance DPS), PR #90 (`43b9eeb`, reset Owned Mods search on weapon changes), PR #91 (`4da8e0b`, Semi-Auto cap and reset manual picker search on weapon changes), PR #92 (`ffa1ff1`, Cannonade lock), PR #93 (`d0e1c8c`, finite Auto-Spool timing), PR #94 (`0a16a51`, Auto-Spool coverage and finite-estimate boundaries), and PR #95 (`06c0576`, Kohm-family attack multishot correction).
- PR #94 Pages deployment run `43844245087` succeeded for `0a16a5122a5c990207297f8bc98c94f5835fce59`; the live app is available at [Tenno-Hub on GitHub Pages](https://appl3tree.github.io/Tenno-Hub/) and the local dev app remains at `http://localhost/Tenno-Hub/`.
- PR #95 Pages deployment run [#173](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/43847329726) succeeded for `06c057651aeb4521e4974ee2dff6c4afa1ce6b04`; production is live at [Tenno-Hub on GitHub Pages](https://appl3tree.github.io/Tenno-Hub/).
- PR #94 release checks: 730 tests / 52 files; production build (118,365-byte optimizer Worker); `validate:sources`; prerequisite audit; mod-effect audit (485/599 parsed, 114 without parsed effects, 83 review candidates, 26 partial and 57 fully unparsed, zero weapon pools without parsed damage); focused ESLint; and CRLF-aware diff check. Vite's existing large-chunk warning remains. The in-app browser open requests for local and production URLs returned `queued`; no fresh visual QA is claimed.
- Do not touch or clean the existing untracked `.tmp/` directory or `epitaph-cpu.cpuprofile` without a task-specific reason.

## Immediate screenshot issue: stance calculation inputs

- User objected to the screen asking them to look up and enter “Average combo damage multiplier” and “Base combo length (seconds)”. That is not an acceptable workflow; these values must come from the Wiki.
- Current source and production bundle use a Wiki-backed stance Neutral-combo table and automatically display the computed estimate. The old input labels and “Enter both values” copy are absent from `src` and the latest built bundle. Relevant implementation: `src/domain/catalog/meleeStanceCombos.ts` and the stance panel in `src/pages/tools/ModBuilder.tsx`.
- Historical in-app QA on port 80 already showed the Wiki combo values and no lookup inputs. I reopened the user's current `http://localhost/Tenno-Hub/?version=0e9b3d35` in Codex, but `open_in_codex` only returned `queued` and did not provide a rendered snapshot; direct local HTTP from this session was denied. The old fields are absent from source, the current built bundle, and the deployed PR #92 code, so do not repeat their implementation. Revisit only if a fresh in-app capture after reload still shows them; then identify the served route/build first.

## Other open user-reported defect

- Perigale Prime only showed Flawed mods in Build Planner → Owned Mods and the manual picker, per the user's report. Catalog compatibility was fixed and broad regressions verify every visible Flawed mod has a standard counterpart first; clean catalog has 107 Perigale-compatible entries. Weapon-switch search reset is also delivered.
- Current source inspection: `OwnedModsPanel` receives the weapon's `trackableMods` (compatible mods plus stance), while manual ModSlot pickers receive `compatMods` and pass `onlyOwned={false}`. Both use the same `getModsForWeapon` compatibility path; Owned Mods counts do not filter list visibility. The catalog regression currently finds 107 compatible Perigale Prime entries and standard Serration beside Serration (Flawed). This makes a stale served bundle, profile-loaded weapon/catalog state, or a profile-specific filter/state interaction more likely than a clean-catalog compatibility omission, but it is not yet a reproduced cause.
- The clean profile/catalog check does not prove the user's profile state is fixed. Keep this item open until the profile-specific discrepancy is reproduced or explained; don't claim resolution from catalog evidence alone. The user already identified the exact affected screens, so do not ask that again.

## Latest delivered checkpoint (2026-11-16): Wiki attack-specific multishot

- The current [Kohm](https://wiki.warframe.com/w/Kohm), [Kuva Kohm](https://wiki.warframe.com/w/Kuva_Kohm), [Kohmak](https://wiki.warframe.com/w/Kohmak), and [Twin Kohmak](https://wiki.warframe.com/w/Twin_Kohmak) Wiki tables show one projectile in `Single Pellet` mode and 12/12/5/5 pellets in `Fully Spooled` mode.
- The bundled upstream records omit multishot on both attack rows and fall back to a weapon-level value. That incorrectly gave `Single Pellet` 9 pellets for Kohm/Kuva Kohm and 5 for Kohmak/Twin Kohmak; the same source value understated each Kohm's full-spool count at 9 instead of 12. `weaponCatalog.ts` now overrides multishot per attack row, and a damage-calculator regression asserts the selected and calculated values across all eight cases.
- Validation: 731 tests / 52 files; production build and TypeScript; `validate:sources`; prerequisite audit; mod-effect audit (485/599 parsed, 114 without parsed effects, 83 review candidates, zero weapon pools without parsed damage); focused ESLint; and CRLF-aware diff check all pass. The existing Vite large-chunk warning remains.
- This corrects steady-state attack-mode damage and the single-pellet profile. Finite Auto-Spool remains withheld for these weapons until the complete per-shot fire-rate, pellet/status, and ammo-consumption sequence is represented and independently verified.
- PR #95 was squash-merged as `06c0576`; Pages deployment #173 (`43847329726`) succeeded and local `main` is synced. The production app was opened in Codex's in-app browser for manual testing; the open call returned `queued`, so no new rendered interaction is recorded.

## Current unmerged work (2026-11-16): variable Auto-Spool sequences

- The current [Kohmak](https://wiki.warframe.com/w/Kohmak) and [Twin Kohmak](https://wiki.warframe.com/w/Twin_Kohmak) pages give one-to-five pellet progression, fire-rate cadence, per-pellet Status Chance, endpoint ammo costs, and fresh-magazine counts from rest (25/49 shots). The [Kuva Kohm](https://wiki.warframe.com/w/Kuva_Kohm) page gives one-to-twelve pellet progression, 20%-to-full fire-rate cadence over five shots, per-pellet Status Chance, and 1-to-4 ammo cost. It reports 52 shots at constant full-spool cost; its from-rest count is model-derived.
- The finite sequence currently changes pellets, damage, per-pellet Status Chance, ammo cost, and fire-rate timing for Kohmak, Twin Kohmak, and Kuva Kohm. The intermediate ammo cost formula is explicitly an inference: `max(1, exact full-spool ammo cost × current pellets / maximum pellets)`, with fractional ammo carried across shots. This matches the Kohmak Wiki's 25/49 from-rest magazine examples. Steady fully-spooled stats use the Wiki's displayed ammo cost: Kohmak 23, Twin Kohmak 47, and Kuva Kohm 52 attacks per magazine. The finite fresh-magazine estimates are 25/49/57 respectively; only Kuva Kohm's 57 is model-derived. The UI labels the inferred sequence and separates steady profile counts from finite from-rest counts.
- Standard Kohm remains excluded from finite Auto-Spool timing. Its current Wiki page gives the variable pellet/ammo behavior and a 66-shot / 244-round fresh-magazine note, but does not provide the complete starting-rate fraction and per-shot rate increments required by the timing model. Applying the same endpoint interpolation would use 243 ammo and leave 2 in the magazine, rather than matching the page's 244-round note; do not silently fit the inferred cost curve to the total.
- Validation passes: focused sequence suite 322/322; full suite 738 tests / 53 files; `npx tsc -b --pretty false`; production build (120,269-byte optimizer Worker; Vite's existing large-chunk warning remains); `validate:sources`; prerequisite audit; mod-effect audit (485/599 parsed, 114 without parsed effects, 83 review candidates, zero weapon pools without parsed damage); focused ESLint; and CRLF-aware diff check. The five-run Kuva Kohm / Grineer / Expected TTK benchmark returned the same legal 2-Forma, 80/80-capacity build and 0.7806255s modeled TTK, with 185 exact candidates per run. The selected mods were Primed Charged Shell R10, Contagious Spread R5, Magnetic Strafe R3, Frail Momentum R5, Primed Point Blank R10, Primed Cleanse Grineer R10, Hell's Chamber R5, and Shotgun Barrage R5; no Arcane. Latency was 2.320s median and 2.638s maximum / max-of-five p95 observation. These are desktop Node results, not a global-optimality proof or browser/mobile latency measure. The Codex in-app browser request for port 80 is queued; no fresh rendered QA is recorded. PR and deployment are pending.

## Latest implementation checkpoint (2026-11-16)

- Implemented Wiki Cannonade locking: the current [Cannonade Mods Wiki page](https://wiki.warframe.com/w/Cannonade_Mods) states equipped Cannonade mods suppress positive and negative Fire Rate changes; its current [Semi-Rifle Cannonade page](https://wiki.warframe.com/w/Semi-Rifle_Cannonade) confirms the lock.
- All ranks of Semi-Rifle, Semi-Pistol, and Semi-Shotgun Cannonade carry a `fireRateLocked` effect parsed from the source description. `calculateBuild` applies the lock to the baseline, conditional hit-rate estimates, final cadence, optimizer inputs, and encounter paths. Mod picker stats and the math trace disclose it. Auto weapons remain ineligible by trigger restriction.
- Validation for this checkpoint: focused tests 123/123; full suite 724 tests / 52 files; build, source validation, prerequisite audit, mod-effect audit (485/599 parsed, 114 without parsed effects, 83 review candidates, zero weapon pools without parsed damage), focused ESLint, and CRLF-aware diff check pass. Production optimizer Worker is 117,269 bytes. Vite's existing chunk warning remains.
- PR #92 is merged and deployed. A later partial Auto-Spool follow-up is recorded below; variable multishot/ammo spool behavior, other unverified modes, and weapon-specific timing exceptions remain open.

## Latest delivered checkpoint (2026-11-16): finite Auto-Spool timing

- Current [Fire Rate Wiki](https://wiki.warframe.com/w/Fire_Rate) says Auto-Spool weapons ramp over their listed cadence and that theoretical comparisons use fully spooled Arsenal fire rate. The finite encounter and direct attack-sequence models now use Wiki startup fractions and per-shot increments for 17 rate-only attack rows: Gorgon, Gorgon Wraith, Prisma Gorgon, Soma, Soma Prime, Supra, Supra Vandal, Tenora, Tenora Prime, Aksomati, Cestra, Secura Dual Cestra, Coda Bubonico primary Auto, Grattler projectile impact and explosion, Phaedra, and Imperator Vandal. Representative current Wiki data: [Gorgon](https://wiki.warframe.com/w/Gorgon), [Soma Prime](https://wiki.warframe.com/w/Soma_Prime), [Supra Vandal](https://wiki.warframe.com/w/Supra_Vandal), [Coda Bubonico](https://wiki.warframe.com/w/Coda_Bubonico), [Grattler](https://wiki.warframe.com/w/Grattler), [Phaedra](https://wiki.warframe.com/w/Phaedra), and [Imperator Vandal](https://wiki.warframe.com/w/Imperator_Vandal).
- Modded full fire rate scales every ramp interval. Steady-state displayed DPS remains at fully spooled rate. The model starts the first hit at 0 seconds and assumes the spool resets after an empty magazine. Spool-down retention between bursts, recoil/accuracy and misses are unsupported. Variable multishot/ammo spool weapons such as Kohm/Kuva Kohm remain excluded pending per-round pellet, ammo, status, and rate modeling; other unverified Auto-Spool modes remain open.
- Regressions assert exact cadence values for all 17 rows, finite hit timing, modded-rate scaling, reload reset, optimizer encounter scoring, and unchanged steady-state fire rate. Full suite: 728 tests / 52 files. Production build passes; Worker is 118,038 bytes. Source validation and prerequisite audit pass; the mod-effect audit reports 485/599 parsed, 114 without a parsed effect, 83 review candidates, and zero weapon pools without parsed damage. Focused ESLint and CRLF-aware diff check pass. Vite's existing large-chunk warning remains.
- The reproducible 20-run Soma Prime / Expected TTK benchmark against the Grineer preset used 107 candidate mods and 14 Arcane candidates. All runs returned the same capacity-legal two-Forma build (59/60 capacity), with 1.3331 s modeled TTK; optimizer median was 3.429 s and p95 3.703 s (Windows x64, Node 22.16). This is one desktop Node scenario, not a browser Worker or mobile measurement, nor proof of global optimality. Full details are in `BUILD_PLANNER_BENCHMARK.md`.
- Codex's in-app browser open request for `http://localhost/Tenno-Hub/` is queued. No fresh rendered interaction or screenshot is available from the exposed browser tools, so this checkpoint does not claim visual QA.
- PR #93 was squash-merged as `d0e1c8c`; GitHub Pages deployment #171 (`43832645316`) succeeded. The production link is [Tenno-Hub](https://appl3tree.github.io/Tenno-Hub/); the local port-80 app has also been requested in Codex's in-app browser. Continue with the profile-specific Perigale investigation and the unfinished full Damage 3.0, optimizer-quality, Underframe, performance, save/load, and browser QA requirements below.

## Latest delivered checkpoint (2026-11-16): Auto-Spool coverage and finite-estimate boundaries

- Regression coverage now enumerates all 23 attack modes on the current [Fire Rate Wiki page](https://wiki.warframe.com/w/Fire_Rate), requiring each to have either a supported cadence or an explicit finite-timing limitation. The Coda Bubonico primary attack is an additional Wiki-backed rate-ramp case and retains the Wiki's `Auto` trigger label.
- Rate-only attack rows use the source-backed ramp with modded fire rate. For Kohm, Kuva Kohm, Kohmak, and Twin Kohmak, the Wiki describes evolving pellet count, ammo cost, and (for the Kuva/pistol variants) per-pellet Status Chance. The finite simulator does not yet update those values per shot, so Expected TTK and direct attack sequences are withheld rather than using the Fully Spooled profile on the first hit. The separate Single Pellet attacks remain selectable.
- Aksomati Prime's page lists an 11-round spool but not the starting-rate fraction and per-shot rate increment needed for finite timing; the Deth Machine Rifle pages confirm a spool-up without the required cadence values. Their finite timing is also withheld. These limits do not affect the fully-spooled steady-state Arsenal statistics.
- The optimizer rejects Expected TTK for an affected attack with its reason and Wiki source. The UI and math trace explain the boundary without asking the player to provide reference data. Regressions cover all listed modes, source links, selection propagation, unsupported TTK rejection, Burst objective availability, and Coda Bubonico's trigger label.
- Validation: focused tests 3/3; full suite 730 tests / 52 files; production build and TypeScript pass after the final UI copy edit; `validate:sources` and `audit:prerequisites` pass; mod-effect audit 485/599 parsed, 114 without effects, 83 review candidates (26 partial, 57 fully unparsed), zero weapon pools without parsed damage; focused ESLint and CRLF-aware diff check pass. Production optimizer Worker: 118,365 bytes. Vite's existing large-chunk warning remains.
- PR #94 was squash-merged as `0a16a51`; GitHub Pages deployment #172 (`43844245087`) succeeded. The production app was opened in Codex's in-app browser; the tool returned `queued`, so no rendered screenshot or visual interaction is recorded.
- Next: research and implement the exact per-shot variable pellet/status/ammo sequence only where current source data supports it, continue the profile-specific Perigale investigation, then address the remaining full objective. This delivery does not close either open item.

## Latest math-validation follow-up (2026-11-16): Wiki mixed-damage example

- Added a regression for the current [Damage/Calculation Wiki example](https://wiki.warframe.com/w/Damage/Calculation): 100 base damage split 30 Impact / 30 Puncture / 40 Slash quantizes to 31.25 / 31.25 / 40.625, then the Infested +50% Slash modifier yields 123.4375 total.
- Focused `damageRuleset.test.ts` passes 22/22. This is one source-backed reference fixture complementing the existing calculator quantization tests; it is not in-game telemetry or completion of the broader independent-math audit.

## Latest optimizer-quality follow-up (2026-11-16): matched HiGHS shortlist

- Installed `highs@1.15.4` only into a new `.tmp/highs-audit-20261116/` scratch folder; project dependencies and lockfiles were unchanged.
- Compared a binary mod/slot MILP shortlist with the existing hybrid and an exhaustive exact Burst oracle on the same eleven nine-mod pools. The model enforces five physical slots, default-polarity capacity, and incompatibility groups; the linear objective sums exact one-mod score deltas, and returned sets are re-ranked by the exact scorer across slot orders.
- Existing hybrid matches the oracle in all 11 pools. HiGHS top 32 matches 10/11, with the Cedo Glaive Radial Attack 45.19% below the oracle; top 128 matches 11/11. However, the top-32 MILP solves take 6.63 s across the corpus, and top-128 takes 72.58 s. The existing hybrid averages 104 ms per case in the same Node runs. The ESM+WASM inputs measure 3,699,489 bytes raw / 1,260,003 bytes summed separately gzipped. This is bounded desktop Burst evidence, not a browser Worker, finite-TTK, Forma, or full-catalog result.
- Decision: do not add HiGHS to the app from this evidence. Full data and constraints are documented in `BUILD_PLANNER_BENCHMARK.md`; raw harness/results are kept under the isolated scratch folder.

## Latest joint finite-TTK oracle expansion (2026-11-16)

- Expanded the exact mod/Arcane Expected TTK oracle from four candidates / three slots to six candidates / four slots for six profiles: Perigale Prime, Cedo glaive radial, Phantasma Prime charged explosion, Acrid, Gram Prime heavy slam, and Vasto Prime Incarnon. Perigale now also has a seven-candidate, five-slot search.
- The oracle uses an uncatalyzed Rank 30 weapon with up to three Forma, max-rank mods, and every rank of two compatible Arcanes. It enumerates legal ordered mod sets and exact Arcane ranks, then checks the hybrid optimizer returns the same finite TTK and DPS in all six cases while staying within three polarity changes.
- Focused regression passes: 1 test / 111 skipped, 34.52s total. This is a larger bounded search, not a full-catalog/global-optimality or stochastic-gameplay result.
- Current next priority: continue Wiki-backed status/timing work only where all required sequence values are sourced, then expand exact joint pools further where test cost permits. Other open acceptance criteria remain listed below.

## Remaining work on the full objective

Continue from the open items in `AGENTS.md` and the pasted specification, with evidence-backed progress. Major unfinished acceptance areas include:

- Broader current Damage 3.0 research and independent tests, including status histories/DoT, defense interactions, attack timing, and weapon-specific effects.
- Mod/arcane/evolution source coverage and unsupported-effect handling.
- Optimizer quality and joint/global search evidence beyond bounded Burst pools; the HiGHS shortlist fit comparison is complete and no solver dependency was adopted.
- Broad same-assumption Underframe comparisons, benchmark corpus quality, and optimizer latency including cold/mobile/cross-device cases.
- Full browser walkthrough, saved build comparison/reload coverage, and responsive checks in the in-app browser.
- Final same-build Underframe comparison after the other work is nearly complete.

## Anti-loop rule

Before acting on an older comment, check this file and the corresponding `AGENTS.md` entry. If an item is marked done, don't repeat its fix or report it as new work. Only reopen it when current source, current served UI, a regression, or new user evidence contradicts the recorded result. Update this checkpoint after each meaningful milestone with what changed, what was verified, and the next concrete item.
