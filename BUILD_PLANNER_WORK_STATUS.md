# Build Planner Work Status

Last updated: 2026-11-16

This is the concise continuation checkpoint for the active Damage 3.0 / Build Planner objective. Read it before starting new work. `AGENTS.md` remains the detailed task history and acceptance criteria; do not reopen completed entries unless fresh evidence shows a regression.

## User requirements to carry forward

- Use current Warframe Wiki data for mechanics and calculated values. Do not ask the player to research or enter reference-table values.
- Use the Codex in-app browser for browser QA. Do not use Brave.
- The local dev app is on port 80: `http://localhost/Tenno-Hub/`.
- Merge and deploy each clean release milestone so the user can manually test the live app while work continues. PR #93 is the latest delivered milestone.
- Continue the full Build Planner objective from the pasted specification; this checkpoint does not reduce its scope.

## Current repository and delivery state

- Branch: `codex/perigale-visibility-followup`, based on `origin/main` at `d0e1c8c` — merged PR #93, Wiki Auto-Spool finite timing. Local `main` still points to `ffa1ff1` and is one squash merge behind.
- Recent delivered checkpoints: PR #89 (`b444ed2`, Wiki-backed stance DPS), PR #90 (`43b9eeb`, reset Owned Mods search on weapon changes), PR #91 (`4da8e0b`, Semi-Auto cap and reset manual picker search on weapon changes), PR #92 (`ffa1ff1`, Cannonade lock), and PR #93 (`d0e1c8c`, Auto-Spool finite timing).
- PR #93 Pages deployment run `43832645316` succeeded for `d0e1c8c4bfd70bba1549f2adff944d85ecb48fa1`; the live app is available at [Tenno-Hub on GitHub Pages](https://appl3tree.github.io/Tenno-Hub/) and the local dev app remains at `http://localhost/Tenno-Hub/`.
- PR #93 Auto-Spool release checks: 728 tests / 52 files; production build (118,038-byte optimizer Worker); source validation; prerequisite audit; mod-effect audit (485/599 parsed, 114 without parsed effects, 83 review candidates, zero weapon pools without parsed damage); focused ESLint; CRLF-aware diff check; and a 20-run Soma Prime benchmark. Vite's existing large-chunk warning remains. A new unmerged follow-up extends Auto-Spool coverage and blocks finite estimates where the current model would misrepresent per-shot behavior; see the candidate checkpoint below.
- Do not touch or clean the existing untracked `.tmp/` directory or `epitaph-cpu.cpuprofile` without a task-specific reason.

## Immediate screenshot issue: stance calculation inputs

- User objected to the screen asking them to look up and enter “Average combo damage multiplier” and “Base combo length (seconds)”. That is not an acceptable workflow; these values must come from the Wiki.
- Current source and production bundle use a Wiki-backed stance Neutral-combo table and automatically display the computed estimate. The old input labels and “Enter both values” copy are absent from `src` and the latest built bundle. Relevant implementation: `src/domain/catalog/meleeStanceCombos.ts` and the stance panel in `src/pages/tools/ModBuilder.tsx`.
- Historical in-app QA on port 80 already showed the Wiki combo values and no lookup inputs. I reopened the user's current `http://localhost/Tenno-Hub/?version=0e9b3d35` in Codex, but `open_in_codex` only returned `queued` and did not provide a rendered snapshot; direct local HTTP from this session was denied. The old fields are absent from source, the current built bundle, and the deployed PR #92 code, so do not repeat their implementation. Revisit only if a fresh in-app capture after reload still shows them; then identify the served route/build first.

## Other open user-reported defect

- Perigale Prime only showed Flawed mods in Build Planner → Owned Mods and the manual picker, per the user's report. Catalog compatibility was fixed and broad regressions verify every visible Flawed mod has a standard counterpart first; clean catalog has 107 Perigale-compatible entries. Weapon-switch search reset is also delivered.
- Current source inspection: `OwnedModsPanel` receives the weapon's `trackableMods` (compatible mods plus stance), while manual ModSlot pickers receive `compatMods` and pass `onlyOwned={false}`. Both use the same `getModsForWeapon` compatibility path; Owned Mods counts do not filter list visibility. The catalog regression currently finds 107 compatible Perigale Prime entries and standard Serration beside Serration (Flawed). This makes a stale served bundle, profile-loaded weapon/catalog state, or a profile-specific filter/state interaction more likely than a clean-catalog compatibility omission, but it is not yet a reproduced cause.
- The clean profile/catalog check does not prove the user's profile state is fixed. Keep this item open until the profile-specific discrepancy is reproduced or explained; don't claim resolution from catalog evidence alone. The user already identified the exact affected screens, so do not ask that again.

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

## Current release candidate (2026-11-16): Auto-Spool coverage and finite-estimate boundaries

- Regression coverage now enumerates all 23 attack modes on the current [Fire Rate Wiki page](https://wiki.warframe.com/w/Fire_Rate), requiring each to have either a supported cadence or an explicit finite-timing limitation. The Coda Bubonico primary attack is an additional Wiki-backed rate-ramp case and retains the Wiki's `Auto` trigger label.
- Rate-only attack rows use the source-backed ramp with modded fire rate. For Kohm, Kuva Kohm, Kohmak, and Twin Kohmak, the Wiki describes evolving pellet count, ammo cost, and (for the Kuva/pistol variants) per-pellet Status Chance. The finite simulator does not yet update those values per shot, so Expected TTK and direct attack sequences are withheld rather than using the Fully Spooled profile on the first hit. The separate Single Pellet attacks remain selectable.
- Aksomati Prime's page lists an 11-round spool but not the starting-rate fraction and per-shot rate increment needed for finite timing; the Deth Machine Rifle pages confirm a spool-up without the required cadence values. Their finite timing is also withheld. These limits do not affect the fully-spooled steady-state Arsenal statistics.
- The optimizer rejects Expected TTK for an affected attack with its reason and Wiki source. The UI and math trace explain the boundary without asking the player to provide reference data. Regressions cover all listed modes, source links, selection propagation, unsupported TTK rejection, Burst objective availability, and Coda Bubonico's trigger label.
- Validation: focused tests 3/3; full suite 730 tests / 52 files; production build and TypeScript pass after the final UI copy edit; `validate:sources` and `audit:prerequisites` pass; mod-effect audit 485/599 parsed, 114 without effects, 83 review candidates (26 partial, 57 fully unparsed), zero weapon pools without parsed damage; focused ESLint and CRLF-aware diff check pass. Current production optimizer Worker: 118,365 bytes. Vite's existing large-chunk warning remains.
- Codex's in-app browser request for `http://localhost/Tenno-Hub/` returned `queued`; no rendered screenshot or visual interaction was available, so this candidate does not claim fresh visual QA.
- Next: commit, merge, and deploy this clean milestone for live manual testing, then continue the variable-pellet encounter model, the unresolved profile-specific Perigale report, and the remaining full objective.

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
