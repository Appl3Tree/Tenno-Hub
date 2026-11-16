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

- Branch: `codex/damage3-continued`.
- Base HEAD: `4da8e0b` — merged PR #91, Wiki Semi-Auto fire-rate cap. Local `main` and `origin/main` are synced to this commit; current branch contains the next release candidate.
- Recent delivered checkpoints: PR #89 (`b444ed2`, Wiki-backed stance DPS), PR #90 (`43b9eeb`, reset Owned Mods search on weapon changes), PR #91 (`4da8e0b`, Semi-Auto cap and reset manual picker search on weapon changes).
- PR #91 Pages deployment run `43823990167` succeeded. The user can manually test the deployed app while follow-up work continues.
- Current release candidate checks: 724 tests / 52 files; TypeScript and production build pass (117,269-byte optimizer Worker); source validation, prerequisite audit, mod-effect coverage audit, focused ESLint, and CRLF-aware diff check pass. Vite's existing large-chunk warning remains. Merge/deploy of this release candidate is pending.
- Do not touch or clean the existing untracked `.tmp/` directory or `epitaph-cpu.cpuprofile` without a task-specific reason.

## Immediate screenshot issue: stance calculation inputs

- User objected to the screen asking them to look up and enter “Average combo damage multiplier” and “Base combo length (seconds)”. That is not an acceptable workflow; these values must come from the Wiki.
- Current source and production bundle use a Wiki-backed stance Neutral-combo table and automatically display the computed estimate. The old input labels and “Enter both values” copy are absent from `src` and the latest built bundle. Relevant implementation: `src/domain/catalog/meleeStanceCombos.ts` and the stance panel in `src/pages/tools/ModBuilder.tsx`.
- Historical in-app QA on port 80 already showed the Wiki combo values and no lookup inputs. I reopened the user's current `http://localhost/Tenno-Hub/?version=0e9b3d35` in Codex, but `open_in_codex` only returned `queued` and did not provide a rendered snapshot; direct local HTTP from this session was denied. The old fields are absent from the current build, so do not repeat their implementation. Revisit only if a fresh in-app capture after reload still shows them; then identify the served route/build first.

## Other open user-reported defect

- Perigale Prime only showed Flawed mods in Build Planner → Owned Mods and the manual picker, per the user's report. Catalog compatibility was fixed and broad regressions verify every visible Flawed mod has a standard counterpart first; clean catalog has 107 Perigale-compatible entries. Weapon-switch search reset is also delivered.
- The clean profile/catalog check does not prove the user's profile state is fixed. Keep this item open until the profile-specific discrepancy is reproduced or explained; don't claim resolution from catalog evidence alone. The user already identified the exact affected screens, so do not ask that again.

## Latest implementation checkpoint (2026-11-16)

- Implemented Wiki Cannonade locking: the current [Cannonade Mods Wiki page](https://wiki.warframe.com/w/Cannonade_Mods) states equipped Cannonade mods suppress positive and negative Fire Rate changes; its current [Semi-Rifle Cannonade page](https://wiki.warframe.com/w/Semi-Rifle_Cannonade) confirms the lock.
- All ranks of Semi-Rifle, Semi-Pistol, and Semi-Shotgun Cannonade carry a `fireRateLocked` effect parsed from the source description. `calculateBuild` applies the lock to the baseline, conditional hit-rate estimates, final cadence, optimizer inputs, and encounter paths. Mod picker stats and the math trace disclose it. Auto weapons remain ineligible by trigger restriction.
- Validation for this checkpoint: focused tests 123/123; full suite 724 tests / 52 files; build, source validation, prerequisite audit, mod-effect audit (485/599 parsed, 114 without parsed effects, 83 review candidates, zero weapon pools without parsed damage), focused ESLint, and CRLF-aware diff check pass. Production optimizer Worker is 117,269 bytes. Vite's existing chunk warning remains.
- Next: publish this clean release candidate, then continue the broader Damage 3.0 mechanics and optimizer-quality work below. Auto-Spool start-up and weapon-specific timing exceptions remain open.

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
