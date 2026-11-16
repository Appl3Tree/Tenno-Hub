# Build Planner Work Status

Last updated: 2026-11-16

This is the concise continuation checkpoint for the active Damage 3.0 / Build Planner objective. Read it before starting new work. `AGENTS.md` remains the detailed task history and acceptance criteria; do not reopen completed entries unless fresh evidence shows a regression.

## User requirements to carry forward

- Use current Warframe Wiki data for mechanics and calculated values. Do not ask the player to research or enter reference-table values.
- Use the Codex in-app browser for browser QA. Do not use Brave.
- The local dev app is on port 80: `http://localhost/Tenno-Hub/`.
- At the next clean build, merge and deploy the changes so the user can manually test the live app while work continues.
- Continue the full Build Planner objective from the pasted specification; this checkpoint does not reduce its scope.

## Current repository and delivery state

- Branch: `codex/damage3-nov16-followup`.
- HEAD and local `main`: `ffa1ff1` — merged PR #92, Cannonade Fire Rate locks and this status checkpoint. `origin/main` is synced to the same commit.
- Recent delivered checkpoints: PR #89 (`b444ed2`, Wiki-backed stance DPS), PR #90 (`43b9eeb`, reset Owned Mods search on weapon changes), PR #91 (`4da8e0b`, Semi-Auto cap and reset manual picker search on weapon changes), and PR #92 (`ffa1ff1`, Cannonade lock and durable status record).
- PR #92 Pages deployment run `43827022036` succeeded for `ffa1ff112ee57fd5f487df50aa94061879c7f191`. The user can manually test the deployed app while follow-up work continues.
- Current unmerged release candidate: Wiki-backed finite Auto-Spool cadence for selected rate-only attack rows, plus exact cadence regression coverage and a Soma Prime benchmark case. Validation now passes 728 tests / 52 files; production build (118,038-byte optimizer Worker); source validation; prerequisite audit; mod-effect audit (485/599 parsed, 114 without parsed effects, 83 review candidates, zero weapon pools without parsed damage); focused ESLint; CRLF-aware diff check; and 20-run Soma Prime benchmark. Vite's existing large-chunk warning remains. The new build has not yet been merged or deployed.
- Do not touch or clean the existing untracked `.tmp/` directory or `epitaph-cpu.cpuprofile` without a task-specific reason.

## Immediate screenshot issue: stance calculation inputs

- User objected to the screen asking them to look up and enter “Average combo damage multiplier” and “Base combo length (seconds)”. That is not an acceptable workflow; these values must come from the Wiki.
- Current source and production bundle use a Wiki-backed stance Neutral-combo table and automatically display the computed estimate. The old input labels and “Enter both values” copy are absent from `src` and the latest built bundle. Relevant implementation: `src/domain/catalog/meleeStanceCombos.ts` and the stance panel in `src/pages/tools/ModBuilder.tsx`.
- Historical in-app QA on port 80 already showed the Wiki combo values and no lookup inputs. I reopened the user's current `http://localhost/Tenno-Hub/?version=0e9b3d35` in Codex, but `open_in_codex` only returned `queued` and did not provide a rendered snapshot; direct local HTTP from this session was denied. The old fields are absent from source, the current built bundle, and the deployed PR #92 code, so do not repeat their implementation. Revisit only if a fresh in-app capture after reload still shows them; then identify the served route/build first.

## Other open user-reported defect

- Perigale Prime only showed Flawed mods in Build Planner → Owned Mods and the manual picker, per the user's report. Catalog compatibility was fixed and broad regressions verify every visible Flawed mod has a standard counterpart first; clean catalog has 107 Perigale-compatible entries. Weapon-switch search reset is also delivered.
- The clean profile/catalog check does not prove the user's profile state is fixed. Keep this item open until the profile-specific discrepancy is reproduced or explained; don't claim resolution from catalog evidence alone. The user already identified the exact affected screens, so do not ask that again.

## Latest implementation checkpoint (2026-11-16)

- Implemented Wiki Cannonade locking: the current [Cannonade Mods Wiki page](https://wiki.warframe.com/w/Cannonade_Mods) states equipped Cannonade mods suppress positive and negative Fire Rate changes; its current [Semi-Rifle Cannonade page](https://wiki.warframe.com/w/Semi-Rifle_Cannonade) confirms the lock.
- All ranks of Semi-Rifle, Semi-Pistol, and Semi-Shotgun Cannonade carry a `fireRateLocked` effect parsed from the source description. `calculateBuild` applies the lock to the baseline, conditional hit-rate estimates, final cadence, optimizer inputs, and encounter paths. Mod picker stats and the math trace disclose it. Auto weapons remain ineligible by trigger restriction.
- Validation for this checkpoint: focused tests 123/123; full suite 724 tests / 52 files; build, source validation, prerequisite audit, mod-effect audit (485/599 parsed, 114 without parsed effects, 83 review candidates, zero weapon pools without parsed damage), focused ESLint, and CRLF-aware diff check pass. Production optimizer Worker is 117,269 bytes. Vite's existing chunk warning remains.
- PR #92 is merged and deployed. A later partial Auto-Spool follow-up is recorded below; variable multishot/ammo spool behavior, other unverified modes, and weapon-specific timing exceptions remain open.

## Current unmerged checkpoint (2026-11-16): finite Auto-Spool timing

- Current [Fire Rate Wiki](https://wiki.warframe.com/w/Fire_Rate) says Auto-Spool weapons ramp over their listed cadence and that theoretical comparisons use fully spooled Arsenal fire rate. The finite encounter and direct attack-sequence models now use Wiki startup fractions and per-shot increments for 17 rate-only attack rows: Gorgon, Gorgon Wraith, Prisma Gorgon, Soma, Soma Prime, Supra, Supra Vandal, Tenora, Tenora Prime, Aksomati, Cestra, Secura Dual Cestra, Coda Bubonico primary Auto, Grattler projectile impact and explosion, Phaedra, and Imperator Vandal. Representative current Wiki data: [Gorgon](https://wiki.warframe.com/w/Gorgon), [Soma Prime](https://wiki.warframe.com/w/Soma_Prime), [Supra Vandal](https://wiki.warframe.com/w/Supra_Vandal), [Coda Bubonico](https://wiki.warframe.com/w/Coda_Bubonico), [Grattler](https://wiki.warframe.com/w/Grattler), [Phaedra](https://wiki.warframe.com/w/Phaedra), and [Imperator Vandal](https://wiki.warframe.com/w/Imperator_Vandal).
- Modded full fire rate scales every ramp interval. Steady-state displayed DPS remains at fully spooled rate. The model starts the first hit at 0 seconds and assumes the spool resets after an empty magazine. Spool-down retention between bursts, recoil/accuracy and misses are unsupported. Variable multishot/ammo spool weapons such as Kohm/Kuva Kohm remain excluded pending per-round pellet, ammo, status, and rate modeling; other unverified Auto-Spool modes remain open.
- Regressions assert exact cadence values for all 17 rows, finite hit timing, modded-rate scaling, reload reset, optimizer encounter scoring, and unchanged steady-state fire rate. Full suite: 728 tests / 52 files. Production build passes; Worker is 118,038 bytes. Source validation and prerequisite audit pass; the mod-effect audit reports 485/599 parsed, 114 without a parsed effect, 83 review candidates, and zero weapon pools without parsed damage. Focused ESLint and CRLF-aware diff check pass. Vite's existing large-chunk warning remains.
- The reproducible 20-run Soma Prime / Expected TTK benchmark against the Grineer preset used 107 candidate mods and 14 Arcane candidates. All runs returned the same capacity-legal two-Forma build (59/60 capacity), with 1.3331 s modeled TTK; optimizer median was 3.429 s and p95 3.703 s (Windows x64, Node 22.16). This is one desktop Node scenario, not a browser Worker or mobile measurement, nor proof of global optimality. Full details are in `BUILD_PLANNER_BENCHMARK.md`.
- Codex's in-app browser open request for `http://localhost/Tenno-Hub/` is queued. No fresh rendered interaction or screenshot is available from the exposed browser tools, so this checkpoint does not claim visual QA.
- Next: merge and deploy this clean release candidate for the user's live manual testing, then continue the unfinished full Damage 3.0, optimizer-quality, Underframe, profile-specific Perigale, performance, save/load, and browser QA requirements below.

## Remaining work on the full objective

Continue from the open items in `AGENTS.md` and the pasted specification, with evidence-backed progress. Major unfinished acceptance areas include:

- Broader current Damage 3.0 research and independent tests, including status histories/DoT, defense interactions, attack timing, and weapon-specific effects.
- Mod/arcane/evolution source coverage and unsupported-effect handling.
- Optimizer quality and joint/global search evidence; properly evaluate HiGHS or a measured alternative before choosing an architecture.
- Broad same-assumption Underframe comparisons, benchmark corpus quality, and optimizer latency including cold/mobile/cross-device cases.
- Full browser walkthrough, saved build comparison/reload coverage, and responsive checks in the in-app browser.
- Final same-build Underframe comparison after the other work is nearly complete.

## Anti-loop rule

Before acting on an older comment, check this file and the corresponding `AGENTS.md` entry. If an item is marked done, don't repeat its fix or report it as new work. Only reopen it when current source, current served UI, a regression, or new user evidence contradicts the recorded result. Update this checkpoint after each meaningful milestone with what changed, what was verified, and the next concrete item.
