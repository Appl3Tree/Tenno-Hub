## D3-MOD-HUNTERS-BONESAW-GROUND-FINISHER-DISPOSITION-001 — rank-aware unscored explanation (2026-11-28)

The generated mod catalog lists Hunter's Bonesaw's six ranks as +20% through +120% Finisher Damage against prone enemies. The official [Update 34 notes](https://www.warframe.com/en/patch-notes/pc/34-0-0) confirm that Ground Finishers began dealing Finisher Damage instead of Status Chance, and the [current Wiki page](https://wiki.warframe.com/w/Hunter%27s_Bonesaw) identifies the mod as a Ground Finisher damage bonus. This distinguishes the mechanic from ordinary Ripkas attack rows.

The picker now explains that the rank-scaled bonus applies to Ground Finishers against prone enemies, links the Wiki, and says why Auto Optimize skips it. It does not add a score: the planner has no Ground Finisher attack event or prone-target state, so applying the percent to a normal attack would be incorrect. `D3-MOD-FINISHER-EVENT-MODEL-001` remains open until the planner represents finisher type, weapon/class-specific multipliers, animation timing, and target interactions.

The focused optimizer regression verifies the source link and explanation for every rank and confirms Hunter's Bonesaw is excluded from Auto Optimize. The focused test passes 1/1; test-project TypeScript, focused ESLint, `npm run validate:sources`, the mod-effect coverage audit, `git diff --check`, and the 994-module production build pass. The audit remains at 527/600 records with parsed effects, 73 with no parsed effect, and 73 conservative candidates (56 partial / 17 fully unparsed); this contextual warning does not change parser counts. Local current-source IAB navigation to port 5178 timed out, so rendered confirmation is still pending. This is a source-triage disposition, not a finisher damage model or gameplay validation.

## D3-MOD-SPONTANEOUS-SINGULARITY-IMPACT-BURST-001 — expected direct impact branch (2026-11-28)

The [official Update 38.6 notes](https://www.warframe.com/en/patch-notes/pc/38-6-0) list Spontaneous Singularity's max-rank +90% Bonus Damage and 18% chance to create a singularity. The [Wiki mod page](https://wiki.warframe.com/w/Spontaneous_Singularity) provides all six rank values and says that orbs which trigger a singularity do not explode. The [Simulor page](https://wiki.warframe.com/w/Simulor) identifies the unmerged Orb Explosion damage profile and the 12m projectile travel distance.

Simulor and Synoid Simulor now expose a separate `Orb Impact (Spontaneous Singularity)` attack event. It uses Orb Launch cadence/ammo and Orb Explosion damage/crit/status values. With the mod equipped, Burst uses the rank's Damage bonus and multiplies the direct explosion/proc expectation by `1 - Singularity chance`; the special row scores zero without the augment. The bonus is modeled as additive with ordinary weapon Damage mods, an explicitly disclosed inference. The event does not inherit the Orb Explosion's guaranteed Electricity proc because the Wiki only documents that proc for detonation/expiration. The struck target is assumed centered in the explosion, the source-listed 12m is enforced as a hit cap, and projectile travel time is omitted.

The singularity branch's own damage, pull, attachment/teammate behavior, interaction with other enemies, and area coverage are not represented. The ordinary Orb Launch, Orb Merging Damage, and Orb Explosion history rows remain reference-only. The new row is eligible for direct Burst and Burst Auto Optimize only; Scaling, Expected TTK, and 5s Avg DPS are rejected because the stochastic singularity event has no repeated-target or event-history model.

`damageCalc.test.ts` passes 204/204. Focused optimizer regressions pass 1/1, and a seeded owned-rank oracle with seed `20261129` matches exhaustive one-slot scores across both weapon profiles and four randomized faction/target states each. Test-project TypeScript, focused ESLint, source validation, mod-effect audit, CRLF-aware diff check, and the 994-module production build pass. Coverage is now 527/600 parsed, 73 without a parsed effect, and 73 conservative candidates (56 partial, 17 fully unparsed).

PR [#440](https://github.com/Appl3Tree/Tenno-Hub/pull/440) squash-merged as `ba3bfb92b46018d2e4f950bdcfafc74d8ab4eab9`; Pages run [#519](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/46133538013) succeeded. Deployed IAB review of `?version=ba3bfb9` selected Simulor, the dedicated impact row, and Spontaneous Singularity R5. It showed the rank's +90% / 18%, the expected 82% explosion branch, the source link and limits, and a Burst value of 1,047 DPS. Expected TTK was unavailable and Auto Optimize disabled for that unsupported objective; the temporary build was reset without saving. This is rendered UI verification only. The current-source Vite preview timed out in IAB. No Underframe, global-optimality, live-game accuracy, multi-target, or latency claim follows from this bounded feature.

## D3-MOD-VOLATILE-VARIANT-DIRECT-SEQUENCE-001 — implementation, release, and validation (2026-11-28)

The [Volatile Variant Wiki page](https://wiki.warframe.com/w/Volatile_Variant) lists 3m Punch Through, an immediate barb explosion, an additional 4m radius when a barb directly hits an enemy, and rank-specific explosion Status Chance values. The [Sporothrix Wiki page](https://wiki.warframe.com/w/Sporothrix) documents a separate 0.9-second embed delay and linked AoE component; [Coda Sporothrix](https://wiki.warframe.com/w/Coda_Sporothrix) has the same delay. The selected Normal Attack now scores the direct hit and one linked AoE against the directly struck target. Without the augment the linked event remains at +0.9s; with Volatile Variant it is immediate. The rank multiplier affects only the AoE component. The standalone AoE row is reference-only so it cannot double-count the explosion.

The bounded score assumes the struck target remains at the impact point. Punch Through, extra radius against neighbors, additional enemies, and area coverage are not modeled. The optimizer accepts the sequence for Burst, Scaling, Expected TTK, and 5s window objectives. In its fast path, linked components now retain their already-computed steady-state per-shot DoT contribution when detailed tick events are disabled. This fixes status damage disappearing from fast single-target sequence scores; it does not add multi-target handling.

Focused tests verify both weapon profiles, all six ranks, unchanged direct-hit Status Chance, the 1.5× rank-five AoE Status Chance multiplier, normal/augmented delay, reference-only AoE selection, optimizer scope, and preserved linked DoT in the fast path. A deterministic rank oracle uses seed `20261128` to compare Auto Optimize against exhaustive empty-or-owned-rank scoring for Burst, Scaling, Expected TTK, and 5s window across eight target/faction scenarios (two profiles × four scenarios); all winners match. Calculator, weapon catalog, and target damage files pass 360/360. Focused optimizer regressions pass 3/3. Test-project TypeScript, focused ESLint, source validation, the mod-effect audit, and the 994-module production build pass. Audit totals remain 699 profiles / 526 of 600 parsed / 74 without effects / 73 conservative candidates (55 partial, 18 fully unparsed), because this source-backed sequence remains a context-bound candidate outside its supported attack rows.

PR [#437](https://github.com/Appl3Tree/Tenno-Hub/pull/437) squash-merged as `252a3148bfde4164e6dd8201c245d2ac28a538ca`; Pages run [#516](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/46128695108) succeeded and checked out that merge commit. Its first rendered-review attempt redirected to stale app build `ff836f7`. A follow-up UI-only change adds the linked component's final Status Chance and expected ordinary rolls to Detailed Build Math; the calculator and optimizer scores do not change. PR [#442](https://github.com/Appl3Tree/Tenno-Hub/pull/442) merged as `225c2493ab61bf821c270ab072a4ddaa23b9abf8`, and Pages run [#521](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/46135268400) succeeded. Deployed IAB review selected Sporothrix / Volatile Variant R5 and visually confirmed `79.500%` linked AoE Status Chance per projectile and `0.795` expected ordinary rolls, with the single-target boundary. The temporary mod was removed without saving. The repository-wide suite is still open due the previously recorded optimizer test timeouts. The rank oracle is a narrow single-mod comparison, not evidence of global optimizer optimality, Underframe parity, or live-game accuracy. Additional-target geometry, the full-pool latency issue, matched Underframe corpus, and local host mapping remain open.

## D3-MOD-AVENGING-TRUTH-RAW-BURST-SNAPSHOT-001 — implementation and deployment reconciliation (2026-11-28)

The [Avenging Truth Wiki page](https://wiki.warframe.com/w/Avenging_Truth) lists 20/30/40/50% of incoming blocked damage as stored extra damage for the next Heavy Attack. Its notes place that bonus after base-damage mods, before elemental bonuses, and under the Heavy Attack combo multiplier. The generated item record matches all four rank values. The [Silva & Aegis](https://wiki.warframe.com/w/Silva_%26_Aegis) and [Silva & Aegis Prime](https://wiki.warframe.com/w/Silva_%26_Aegis_Prime) pages list 490 / 1,590 Heavy Damage and 0.7s wind-up; their Heavy Damage totals are five times the normal Heat base damage.

The catalog parses the selected mod rank's absorption fraction and exposes a saved incoming-damage-blocked input. For a direct, single-target Heavy Attack Burst row on either supported weapon, the panel displays `incoming damage blocked × rank fraction` as a separate raw stored amount. This is not added to typed damage, crit-weighted damage, Burst output, target pools, finite TTK, Scaling, or sustained/5-second DPS. The Wiki's later elemental and combo steps are described but not applied to this separate raw figure because the stored bonus's damage type and target-pool behavior are not established by the cited page. The separate Truth syndicate effect remains unmodeled, so Auto Optimize excludes Avenging Truth. Direct Heavy Attack rows use the source-listed Heavy Damage total and 0.7s wind-up, scaled from the catalogued Normal Attack damage-type distribution.

Two focused calculator regressions pass, covering all rank values, both Heavy Attack rows, raw snapshot math, unchanged typed damage/Burst/sustained output, and removal from finite scoring. The focused optimizer exclusion regression passes 1/1; full `damageCalc.test.ts` passes 202/202. Test-project TypeScript, focused ESLint, `npm run validate:sources`, and the 994-module production build pass. The current coverage audit reports 699 profiles, 526/600 eligible mod records with parsed effects, 74 without parsed effects, and 73 conservative candidates (55 partial, 18 fully unparsed). This adds one parsed effect and reclassifies one record; it does not claim an optimizer-score or latency gain.

PR [#433](https://github.com/Appl3Tree/Tenno-Hub/pull/433) squash-merged as `1de92fbe9d2d98a0aba66dac24cb006b60fd644b`; Pages run [#512](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/46122173474) succeeded. The deployed IAB review selected Silva & Aegis, Heavy Attack, and Avenging Truth R3. Entering 3,000 blocked damage displayed `+1,500 raw stored bonus` separately while Burst DPS remained 295; the selected-mod card linked its Wiki source and disclosed target-scoring/finite-objective and Auto Optimize exclusions. The snapshot was reset and the mod removed; no build was saved. This is a rendered check of the bounded UI, not live-game validation. The port-80 localhost site still serves `2bf6faea`, and current-source Vite preview attempts timed out in IAB. Underframe parity, live-game accuracy, full-suite validation, and the previously recorded optimizer latency issue remain open.

## D3-MOD-BURSTING-MASS-AUDIT-DISPOSITION-001 — event-model boundary (2026-11-27)

The [Bursting Mass Wiki page](https://wiki.warframe.com/w/Bursting_Mass) gives rank-scaled damage storage when eligible projectiles pass through Mutalist Quanta's mass, followed by a manual Alt-Fire or expiration detonation. The explosion has a listed 15m radius, retains accumulated damage types, cannot crit or proc status, and depends on orb configuration and Multishot-specific changes. The effect can receive projectiles or ability damage from linked equipment, which the selected-weapon attack model does not represent.

The Mod Builder now gives this source-backed explanation at every rank and links the Wiki directly. Auto Optimize excludes Bursting Mass rather than comparing its ordinary weapon stats while omitting a potentially large stored-damage explosion. This is a triage disposition, not a scoring implementation: the planner has no orb-placement geometry, eligible projectile pass-through history, typed accumulated-damage ledger, cross-weapon/ability contributors, or manual/expiration detonation event. `D3-MOD-BURSTING-MASS-EVENT-MODEL-001` remains open until those events can be represented and validated. No manual score, AoE score, or optimizer benefit is claimed.

The focused regression checks the Mutalist Quanta identity, direct Wiki source, warning text at all ranks, and Auto Optimize exclusion. It passes 1/1. Test-project TypeScript, focused ESLint, `npm run validate:sources`, `git diff --check`, and the 994-module production build pass. The coverage audit remains at 699 profiles / 600 eligible mod records / 525 parsed / 75 without parsed effects / 73 conservative candidates (54 partial, 19 fully unparsed); this warning does not change parser counts.

The full repository run with four workers reported two optimizer test timeouts: `retains a second multishot option for the final Braton Prime neighborhood` exceeded its explicit 15s limit (~19s observed), and `matches nine-candidate five-slot exhaustive legal-build oracles across representative attack modes` exceeded its explicit 60s limit (~86s observed). The runner then produced no new test result for more than 4½ minutes and was interrupted. A targeted one-worker rerun reproduced the two timeout limits with 254 unrelated tests skipped. Treat the repository suite as incomplete, not passing; isolate and profile these fixtures under `D3-OPT-FULLPOOL-LATENCY-001` before changing timeout budgets.

PR [#432](https://github.com/Appl3Tree/Tenno-Hub/pull/432) merged the warning and focused regression as `4f570f582aab13da7964b2cf8a456e8e6ff39d5a`; Pages run [#511](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/46119169813) succeeded. In-app review of deployed version `4f570f5` confirmed the selected-mod card's source link and explicit Auto Optimize exclusion. The test mod was removed without saving a build. This verifies the deployed disclosure only; the effect remains unscored until its event model is supported.

## D3-MOD-ENERGY-CHANNEL-BURST-SNAPSHOT-001 — raw next-hit estimate (2026-11-27)

The generated mod rank data lists +50/+100/+150/+200% of Energy used as raw next-attack bonus damage, capped at +50/+100/+150/+200 for ranks 0–3. The planner parses those rank values and exposes a saved 0–100 Energy-spent snapshot for one direct, single-target melee Burst event. It reports the result as a separate raw bonus after crit weighting and outside the typed damage pools. The Energy Channel [WARFRAME Wiki entry](https://wiki.warframe.com/w/Energy_Channel) documents the next-hit charge behavior and says Elemental Mods amplify the bonus; its Max Rank metadata says 5 while its effect table and the generated catalog data end at R3. The planner follows the four R0–R3 rows. It does not apply elemental scaling because the exact damage type and interaction with target pools/mitigation are unresolved.

The bonus does not affect the ordinary damage breakdown, per-hit averages, Burst DPS, finite TTK, Scaling, sustained DPS, or 5s Avg DPS. Area and multi-hit attacks are excluded. Auto Optimize always rejects Energy Channel because the raw bonus cannot yet be compared against target-aware scores. The UI discloses these limits beside the 0–100 input and selected-rank conversion/cap.

Two calculator tests cover parsing, clamping/capping, separate raw bonus display, non-effects on typed and repeated-hit scores, and unsupported area/multi-hit rows; the optimizer regression checks its exclusion for Burst and Scaling goals. These pass 3/3, and the full `damageCalc.test.ts` passes 200/200. Test-project TypeScript, focused ESLint, source validation, the 994-module production build, and the mod-effect audit pass. Since optimizer scoring is unchanged, no latency or optimizer-quality claim is made.

PR [#430](https://github.com/Appl3Tree/Tenno-Hub/pull/430) squash-merged as `e83059832aa1829d72b4dd8061515399861f880e`; Pages run [#509](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/46112928930) succeeded. The in-app browser reviewed deployed version `e830598`: Skana Melee with Energy Channel R3 exposed the 0–100 Energy-spent input, source link, and limits under Options. A 50-Energy snapshot produced the rendered `+100 raw bonus after crit` result; it was reset to 0 and no build was saved. This verifies the deployed UI and calculation display only. The Wiki's damage type/target-mitigation behavior, full-suite validation, live-game behavior, and Underframe parity remain open.

## D3-OPT-TORID-PROFILING-FOLLOWUP-001 — CPU and allocation profile (2026-11-27)

A fresh full-pool Torid / Grenade Impact / Scaling / Corpus / Realistic / three-Forma run returned the exact same legal eight mods and score `173,190.482595`. The Node 22.16 CPU profile contained 29,221 samples across 44.95 seconds: 57.64% of self samples were in `calculateBuild` and 21.37% in garbage collection. `scoreEffectsCore` and slot search account for most callers of those repeated calculations. The heap profile at the default 512 KB sample interval was dominated by module compilation, worker message decoding, and catalog/data initialization; it did not isolate optimizer-time allocations.

Two narrowly scoped allocation experiments preserved the exact winning build and score but did not demonstrate a speed gain. The original two-run Torid median was 40.97s; later control and candidate runs both moved to about 45.6s, showing substantial host-time drift. The Galvanized temporary-array scan was reverted, as was the combined Flux/Energy Channel scan experiment. No application scoring or optimizer change is retained from this profile. Validation during the Energy Channel scan experiment passed `damageCalc.test.ts` 200/200, the focused Galvanized cadence optimizer regression 1/1, test-project TypeScript, focused ESLint, and diff check.

This evidence narrows the cost to repeated calculator work but does not justify changing search breadth or approximating the score. Next profiling should isolate runtime after catalog initialization and inspect work within `calculateBuild`; no Underframe, global-optimality, or broad latency claim follows from this single local fixture.

## D3-OPT-FULLPOOL-LATENCY-001 — Braton Prime current-source repeat sample (2026-11-27)

The full-catalog fixed-window audit was rerun on application source based on `main` commit `48077e54`, with Arcane optimization disabled, for Braton Prime / Normal Attack / Grineer / Realistic / 100,000 Health / 3,000 Armor / eight slots / rank-30 Catalyst / up to three Forma. Reproduce from PowerShell with:

```powershell
.\node_modules\.bin\tsx.cmd scripts\auditFixedWindowDpsFullPool.ts --weapon="Braton Prime" --attack="Normal Attack" --faction=Grineer --state=realistic --health=100000 --armor=3000 --slots=8 --forma=3 --runs=3
```

The optimizer returned the same legal build and score on all three runs. Timings were 17.7331s, 15.8837s, and 16.5524s (median 16.5524s); each evaluated 149 optimizer candidates. The selected build was Malignant Force R3, Rime Rounds R3, Thermite Rounds R3, Primed Bane Of Grineer R10, Heavy Caliber R10, Magnetic Capacity R3, Galvanized Chamber R10, and Speed Trigger R5. It used 60/60 capacity and three Forma. The pool contained 106 candidates, of which 62 were eligible for this score.

The deterministic single-target `[0,5s)` objective returned 20,000 DPS / 100,000 damage and a modeled 4.1101s kill. The audit scored 226 legal one-mod additions, removals, or replacements; none improved the capped window score. Some tied neighbors had slower modeled TTK, so this is not a TTK neighborhood result. These timings refresh one fixture only; they do not establish a broad latency improvement, mobile/cold-start/Worker-tail latency, Underframe parity, or global optimality. The Underframe matched-corpus and scoring-semantics issues remain open.

A separate CPU-profiled repeat took 17.2508s in the audit's internal timer and returned the same build, 20,000 DPS score, and 149 optimizer-candidate count. V8 collected 13,723 samples; 6,002 landed directly in `calculateBuild` and 2,572 in garbage collection. This points to repeated calculator work and allocation as the leading profile costs. The instrumented timing is diagnostic and is not mixed into the three-run latency sample. No search breadth or score approximation changed.

### Narrow allocation change and recheck (2026-11-27)

`calculateBuild` previously created a temporary array and `Set` on every call just to count distinct Sacrificial set-member IDs, capped at two. This now scans for at most two distinct IDs and preserves the existing member-count semantics. Sacrificial calculator tests pass 2/2; the paired-set optimizer-selection test passes 1/1; the complete `damageCalc.test.ts` file passes 197/197. Test-project TypeScript, focused ESLint, and the TypeScript/994-module production build pass.

The same Braton full-pool fixture returned the same 8-mod build, 20,000 DPS capped score, 149 optimizer-candidate count, and 226 exact legal one-mod moves. Post-change timings were 16.8868s, 16.6107s, and 16.4630s (median 16.6107s), versus the pre-change 17.7331s, 15.8837s, and 16.5524s (median 16.5524s). These samples overlap; this change reduces per-call temporary collections but does not demonstrate a broad optimizer speedup. No approximate scoring or search-breadth reduction was introduced, and the latency task remains open.

A post-change CPU-profiled repeat returned the same score/build/candidate count in 18.1884s. Of 14,384 profile samples, 6,397 were attributed directly to `calculateBuild` and 2,661 to garbage collection, compared with 6,002 and 2,572 in the earlier 13,723-sample profile. The sample mix is similar and does not demonstrate a measurable reduction. This cleanup is retained as a low-risk allocation reduction, not as a completed latency fix; larger repeated-calculation costs still need investigation.

### Empty external-status scoring fast path (2026-11-27)

The optimizer commonly calls `calculateBuild` without externally supplied statuses. That path previously normalized the empty input, allocated empty status sets, rebuilt an immune `Set`, and ran an empty unique-status union on every score. `filterExternalStatusTypesForTarget` now returns early for empty or invalid inputs and reuses an incoming `Set`; `calculateBuild` uses a shared read-only empty set, skips empty direct-eligibility and unique-status work, and preserves the populated-status path. The scoring results are unchanged for the supported inputs.

Validation passes: `uniqueStatusRules.test.ts` plus the full `damageCalc.test.ts` pass 202/202; the Sacrificial set optimizer regression passes 1/1; and the Flux Overdrive file passes 5/5, including seed `20261177`'s exhaustive owned-rank comparisons across four randomized scenarios. The generic seed `20261156` Burst/Scaling oracle passes 1/1, exhaustively checking four rank-limited three-slot pools for Braton Prime, Lex Prime, Cedo, and Broken War with varied factions, conditional states, and Forma limits. Test-project TypeScript, focused ESLint, `git diff --check`, and `npm run build` pass; Vite transforms 994 modules and reports its existing large-chunk warning.

The Braton Prime full-pool fixture was repeated twice after this change, for six total optimizer runs: 15.6729, 15.2216, 14.8624, 15.3654, 15.2945, and 15.1629s. The combined median is 15.2581s, 8.1% below the preceding post-Sacrificial median of 16.6107s. All six runs retained the same legal 8-mod/3-Forma winner, 20,000 capped `[0,5s)` DPS, 4.1101s modeled kill, and 149-candidate count. Each exact one-mod neighborhood scored 226 legal moves; none improved the capped objective. This is a promising repeatable change on one fixed local fixture, not proof of broad latency or objective-quality improvement.

A profiled post-change run sampled 12,619 ticks: 5,787 in `calculateBuild` and 2,334 in garbage collection. The fractions remain similar to the preceding profile (6,397/14,384 and 2,661/14,384), so the profile does not establish that garbage collection's share fell. Full-suite validation was started after the focused checks but interrupted after an extended silent run with exit code 1; it is inconclusive and does not count as a pass. The earlier 57-file/1,002-test pass applies to its recorded source only; rerun the full suite after the next substantial scoring batch.

### Broad optimizer profile survey (2026-11-27)

Reproduce the one-run survey with:

```powershell
.\node_modules\.bin\tsx.cmd scripts\benchmarkBuildOptimizer.ts --runs=1 --no-arcane --no-exilus --realistic
```

The runner completed 45 representative weapon, attack-profile, and objective cases on Windows x64, Node 22.16.0, and a 28-logical-CPU host. Every case returned a legal build under the benchmark's capacity, duplicate, incompatibility, and Forma checks. Per-case optimizer time ranged from 5.6616s to 40.4325s, with a 19.2417s median; 2 cases were under 10s and one exceeded 30s. Torid / Incarnon base-mode Scaling was the longest case at 40.4325s. The single-run design does not support repeatability or stable-winner claims, and its varied scores/objectives are not directly comparable. It also does not establish Underframe parity, live-game accuracy, or global optimality. The sampled profiles are useful for choosing the next repeated latency fixtures; prioritize Torid and a mix of melee, charged/projectile, and finite-TTK profiles rather than optimizing around Braton alone.

Torid's two attack-mode-independent cases were then repeated three times each. Incarnon base-mode Scaling scored exactly 173,190.4826 in every run and remained legal; optimizer timings were 39.1771, 39.3260, and 40.2491s (median 39.3260s). Normal Attack Expected TTK scored 125,330.4724 in every run, remained legal, and evaluated 133 encounter candidates per run; timings were 27.7417, 28.1072, and 28.2370s (median 28.1072s), with modeled TTK 0.81218s. Each run used the same three-Forma limit. The stable scores indicate deterministic output for these fixtures, but this report does not claim the selected mod set was identical across tied candidates. The long Scaling time repeats, making it a useful next CPU-profile target; no source optimization has yet been attributed to it.

### Torid Scaling CPU profile and rejected allocation experiment (2026-11-27)

A direct `node --cpu-prof --import tsx` profile isolated the Torid Incarnon base-mode Scaling case. Of 28,998 samples, 16,688 (57.55%) were in `calculateBuild` and 6,177 (21.30%) in garbage collection. The test runner launcher must not be profiled as a parent process: that produced an almost entirely idle profile because the actual search ran in its child.

I tried replacing `calculateBuild`'s per-mod preferred-element `Set`, fallback-order array, and element-bonus record with a default HCET iteration plus a custom-order fallback. The custom Riven order was preserved and checked by a new direct calculator regression. `damageCalc.test.ts` passed 198/198, the existing Riven-order optimizer regression and seed `20261156` Burst/Scaling oracle passed 2/2, and test-project TypeScript and focused ESLint passed. Three post-change Torid Scaling runs were 39.3384, 39.5939, and 39.8806s (median 39.5939s) versus 39.1771, 39.3260, and 40.2491s (median 39.3260s) before the experiment. The score remained exactly 173,190.4826 and builds remained legal. The CPU profile after the experiment attributed 16,755/28,953 samples (57.87%) to `calculateBuild` and 6,133/28,953 (21.18%) to garbage collection, showing no meaningful shift. Since neither timing nor profile showed a benefit, I reverted the implementation and retained only the custom-order regression. Do not reuse this shortcut without a new benchmark or a different measured bottleneck.

### Repository-wide validation follow-up (2026-11-27)

After the focused Sacrificial calculator/optimizer regressions, full `damageCalc.test.ts`, test-project TypeScript, focused ESLint, and production build passed, a fresh `vitest run --configLoader runner --no-cache` was started on the current worktree. It produced no progress or completion output during an extended wait and was interrupted (exit code 1) so work could continue. This attempt is inconclusive and is not counted as a pass. The earlier full-suite result recorded in `AGENTS.md` remains evidence for its then-current source only; rerun the suite after the next source change when practical.

## D3-MOD-NECROPHAGIC-VIGOR-PRIOR-RELOAD-SNAPSHOT-001 — Hema Critical Chance / Critical Damage snapshot (released in PR #425 / Pages run #504)

The [Necrophagic Vigor Wiki page](https://wiki.warframe.com/w/Necrophagic_Vigor) lists +10/+12/+14/+16/+18/+20% Critical Chance and Critical Damage per 20 Health drained at ranks 0–5, with a +360% cap to each stat. The minimum Health-drain amount needed for the cap therefore varies by rank. The planner parses the six rank values and exposes an editable 0–720 Health-drained value, representing the amount actually lost on the assumed prior Hema reload. It applies the rank value per completed 20-Health step and caps both bonuses at +360%.

The snapshot is available for direct, single-target Hema and Coda Hema Burst scoring and Burst Auto Optimize only. It is held fixed through the scored shot. The model does not infer drain from magazine capacity, refill amount, maximum/current Warframe Health, or reload timing. Buff duration, expiry/refresh, and subsequent Health changes are not simulated. The Wiki reports a non-host client bug, so the UI discloses a solo/host assumption. Finite TTK, Scaling, sustained DPS, 5s Avg DPS, area attacks, and other objectives strip the snapshot and keep the augment out of Auto Optimize.

Three calculator regressions verify all six parsed ranks, integer/cap handling, additive Critical Chance and Critical Damage for Hema and Coda Hema, exclusion on another weapon, and stripping from finite/sustained scoring. The optimizer scope regression checks supported Burst selection, unsupported goals, zero-snapshot exclusion, the context-sensitive explanation, and the optimizer highlight. Seed `20261176` checks four Grineer/Corpus/Infested/Corrupted scenarios with different target Health and Armor, health-drain snapshots, randomized two-slot pools, and exact owned rank distributions. Exhaustive legal subsets, owned rank choices, slot placement, and rank-30 Catalyst capacity match Auto Optimize in every scenario. This is sampled-pool evidence, not global optimizer quality.

The focused tests pass 5/5 (444 unrelated tests skipped); the full `damageCalc.test.ts` passes 197/197. App/test TypeScript, focused ESLint, `npm run validate:sources`, `git diff --check`, and a 994-module production build pass. The mod-effect coverage audit reports 523/600 eligible records parsed, 77 with no parsed max-rank effect, and 73 conservative candidates (52 partial / 21 fully unparsed). In-app browser review of the current-source preview confirmed the Hema Health-drain control and its explanation; the entered 360 value was cleared and no build was saved. The full repository suite, gameplay validation, Underframe parity, and broader optimizer comparison remain open. PR [#425](https://github.com/Appl3Tree/Tenno-Hub/pull/425) squash-merged as `a72f60dfad2c61b1ecd6f4b0d2acb2c537586c92`; Pages run [#504](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/46082612593) succeeded, deploying the implementation.

## D3-MOD-VILE-DISCHARGE-OPTIMIZER-ATTACK-001 — release reconciliation (2026-11-26)

PR [#415](https://github.com/Appl3Tree/Tenno-Hub/pull/415) squash-merged as `ca04cebaf0a7c1bacfed1dc714344051fc69deed`; Pages run [#494](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45764659326) succeeded. It deploys the single-row Embolist attack forwarding and optimizer fallback with the full-catalog regression described below. No benchmark or optimizer-quality result changed. The IAB review of deployed version `ca04ceb` confirmed that Auto Optimize retained Vile Discharge, scored 2,042.7 cycle DPS, and identified Embolist Normal Attack in Why This Build; this is a rendered flow check on one target profile, not a global-optimality or gameplay claim. The local port-80 preview remained stale and the local Vite preview timed out.

## D3-MOD-VILE-DISCHARGE-OPTIMIZER-ATTACK-001 — single-row attack forwarding regression (2026-11-25)

The Embolist Auto Optimize page passed a null `buildForAttack` because it normally forwards an attack object only for weapons with multiple rows. The Vile cycle objective requires `Embolist / Normal Attack`; without that selected-attack context the optimizer rejected Vile Discharge and returned an empty build at zero score. The page now passes the Normal Attack row for this objective, and `optimizeBuildCore` resolves Normal Attack as a fallback when the request passes null or omits the row.

A full-catalog, worker-shaped regression uses `buildForAttack: null` and verifies the legal result retains Vile Discharge and has positive cycle DPS. It passes 1/1. App/test TypeScript, focused ESLint, and a 991-module production bundle (23.62s) pass. Vitest's default config bundler hit EPERM under the shared `node_modules` junction; `--configLoader runner --no-cache` passed the focused test. The in-app browser found localhost port 80 serving stale `version=2bf6faea`; the current-source preview on port 5173 timed out. This is code regression evidence without current-source rendered verification. No benchmark or optimizer-quality claim changed.

## D3-MOD-AUDIT-JAVLOK-MAGAZINE-WARP-LINKED-COMBO-001 — parser and UI boundary (released in PRs #409–410 / Pages runs #488–489)

The [Amalgam Javlok Magazine Warp Wiki page](https://wiki.warframe.com/w/Amalgam_Javlok_Magazine_Warp) lists rank-scaled Javlok Magazine Capacity and Combo Count Chance while blocking with a shield; its combo effect is used with Sword and Shield. The parser now recognizes the shield-qualified wording at every rank. The Javlok-native Magazine Capacity remains eligible for Javlok optimization. The linked Sword-and-Shield combo effect is explicitly described and excluded because the planner does not link the Javlok primary profile to a separate melee profile, consistent with the existing linked-equipment boundary.

The focused optimizer regression confirms all six rank values, no unmatched source lines, and eligibility of the mod's Javlok Magazine Capacity for a TTK optimize context; it also checks that the user-facing warning identifies the Sword-and-Shield link without mislabeling the mod as Guardian Derision. Focused Vitest passes 1/1 (247 unrelated tests skipped), app/test TypeScript, focused ESLint, source validation, `git diff --check`, and the 993-module production build pass. The coverage audit remains at 699 weapon profiles, 521/600 eligible mods parsed, 79 without a parsed max-rank effect, and 73 conservative candidates (50 partial / 23 fully unparsed). The Javlok record remains an audit candidate because its linked effect is intentionally outside this planner's equipment model; it is no longer an unexplained parser miss. PR [#409](https://github.com/Appl3Tree/Tenno-Hub/pull/409) squash-merged as `ce1e006171c3a0a2b4ba9bcfd2218fb6f9db3698`; Pages run [#488](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45721772297) succeeded.

The deployed in-app review on the PR #409 build showed the selected mod card saying “Unscored effect; Auto Optimize skips this mod,” which incorrectly implied its native Javlok Magazine Capacity was also excluded. PR [#410](https://github.com/Appl3Tree/Tenno-Hub/pull/410) replaced that generic badge in the selected slot and candidate picker with “Linked Sword-and-Shield combo effect unscored; Magazine Capacity remains optimizer-eligible,” and added the Amalgam Javlok Wiki link. PR #410 merged as `c80ec5ad364dc3f526b4f2c291ea4c5546faba38`; Pages run [#489](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45723472650) succeeded. Deployed IAB review on `?version=c80ec5a` confirmed both labels and the source URL, then reset the temporary test build. Linked-equipment support, Underframe parity, broad optimizer quality, and live-game validation remain open.

## D3-MOD-COMBUSTION-BEAM-GROUP-BURST-001 — bounded primary-Beam group estimate (released in PR #407 / Pages run #486)

The [Combustion Beam Wiki page](https://wiki.warframe.com/w/Combustion_Beam) gives 100–600 Blast damage and a 3–18m explosion radius across ranks. The parser types each rank's Blast damage separately from direct weapon damage. Intermediate radii are linearly interpolated as 3/6/9/12/15/18m because the current source summary exposes only the endpoints; that interpolation is an explicit assumption. The [official 44.1.3 patch note](https://www.warframe.com/en/patch-notes/pc/44-1-3?gameplat=1&steam=1) lists Combustion Beam among the on-death explosions protected from recursive Elemental Ammo status retriggers.

The Mod Builder saves 0–20 same-profile neighbors and one representative mean center-to-center distance from 0–18m. Scoring is restricted to direct, non-area primary Beam Normal Attack Burst. For each scored event, the expected direct hit must kill a fresh health-only primary; the separate explosion is then evaluated against each entered neighbor with linear 100%–0% falloff inside the selected rank radius. The event has no critical or status chance, receives faction bonus only, and assumes line of sight. The source's short post-death delay is treated as immediate. The model does not simulate neighbor health depletion, enemy positioning, recursive neighbor kills, shields, Overguard, Scaling, finite TTK, or 5s Avg DPS; Auto Optimize excludes the mod outside the supported snapshot. The neighbor count and mean distance are scenario inputs, not predicted spawn geometry.

Focused selection passes 3/3 tests. Seed `20261173` compares exhaustive legal two-slot assignments and owned ranks through R0–R2 across Amprex/Grineer, Ignis Wraith/Corpus, Tenet Flux Rifle/Infested, and Glaxion Vandal/Corrupted, with shuffled compatible mods and varied neighbor count/distance. App/test TypeScript, focused ESLint, source validation, the 600-record mod-effect audit, `git diff --check`, and a 993-module production build pass. Current audit: 699 profiles / 521 of 600 eligible mods parsed / 79 without parsed max-rank effects / 73 conservative candidates (50 partial / 23 unparsed). PR [#407](https://github.com/Appl3Tree/Tenno-Hub/pull/407) merged as `9d7a595c454f2395c492df1c65ae3285e8731b33`; Pages run [#486](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45709922517) succeeded. IAB review of the deployment confirmed the neighbor-count/distance controls and scope explanation; the qualifying score transition was not exercised. This is not a full-suite, Underframe-parity, or live-game claim.

## D3-MOD-ACID-SHELLS-BOUNDED-GROUP-BURST-001 — Sobek group estimate (released in PR #405 / Pages run #484; rendered review complete)

The [Acid Shells Wiki page](https://wiki.warframe.com/w/Acid_Shells) lists ranks 0–5 as 75/150/225/300/375/450 flat Corrosive, 7.5/15/22.5/30/37.5/45% of enemy Max Health as Blast, and 2.5/5/7.5/10/12.5/15m radius. It describes linear 100%–0% falloff and line of sight, says faction damage mods apply, and says the explosion cannot critically hit or apply Corrosive/Blast Status Effects. The planner types the rank values without treating them as ordinary direct-hit weapon damage.

The saved group inputs are 0–20 additional same-profile neighbors and a 0–15m mean center distance. Only Sobek/Kuva Sobek direct Normal Attack Burst can score Acid Shells. Every scored event assumes its expected direct hit kills a fresh, health-only primary, then adds one explosion against those neighbors using the selected rank's radius and linear falloff. The explosion passes through the normal target armor/health and faction damage rules; custom Steel Path target Health is converted to the pre-Steel-Path basis by dividing by 2.5. Line of sight is assumed. The model does not estimate enemy-to-enemy spacing, per-neighbor distances, pool depletion, recursive kills, Shields/Overguard, Scaling, finite TTK, or 5s Avg DPS. A group estimate is an encounter assumption, not a prediction of actual coverage.

Focused regressions pass 3/3. Seed `20261172` compares exhaustive two-slot rank-limited winners through R0–R2 for four Sobek target/faction strata (Grineer, Corpus, Infested, Grineer Steel Path), varying neighbor counts from 1–4 and mean distance from 0.3–2.4m. The three-candidate pools contain Acid Shells plus two shuffled fully modeled mods; the exact enumeration covers legal subsets, owned rank tuples, placement, and rank-30 Catalyst capacity, and matches Auto Optimize. Target Health is derived as a fraction of the catalogued Sobek expected direct-hit damage so the primary-kill precondition holds; this is a focused mechanic oracle, not a broad combat-profile benchmark. App/test TypeScript, focused ESLint, `npm run validate:sources`, the 600-record effect audit, `git diff --check`, and a 993-module production build pass. The audit reports 699 weapon profiles, 520/600 eligible mods with parsed effects, 80 with no parsed max-rank effect, and 73 conservative candidates (49 partial / 24 fully unparsed). PR [#405](https://github.com/Appl3Tree/Tenno-Hub/pull/405) squash-merged as `0abe108fc8ddf70a9ef168bcad27a3985baaa31c`; Pages run [#484](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45701222036) succeeded. In-app review of deployed `?version=0abe108` confirmed the neighbor-count / mean-distance inputs and the modeled-group status under a no-Shields Grineer context. Underframe parity, live-game accuracy, global optimizer quality, and full-suite validation remain open.

The user-reported owned-rank and multi-slot profile gaps were already fixed by PR #391 and are confirmed in the current deployment: the Owned Mods rank editor exposes separate R0–R10 counts, while the picker lists `Vinquibus (Primary)` and `Vinquibus (Melee)` as independent profiles with distinct mod pools. Swipe's generic Claws 0.8 follow-through proxy was separately approved and released in PR #395; Kavat-specific follow-through accuracy remains unverified.

## D3-MOD-VULCAN-BLITZ-BOUNDED-GROUP-BURST-001 — Jat Kittag group estimate (released in PR #403 / Pages run #482; rendered review complete)

The [Vulcan Blitz Wiki page](https://wiki.warframe.com/w/Vulcan_Blitz) lists ranks 0–5 as 50/100/150/200/250/300 Blast, 10–60% of enemy Max Health, and 1–6m radius. It also specifies linear 100%–0% falloff and line of sight; explosion damage receives faction bonuses and stealth's 8× bonus. The planner now parses the rank table and saves a 0–20 same-profile neighbor count plus a 0–6m mean center-distance assumption in the target configuration.

The scoring gate is direct Jat Kittag Normal Attack Burst only, requires a health-only selected target, a positive neighbor count, and a mean distance inside the selected rank radius. For every scored attack event, the estimate assumes a fresh same-profile primary target is killed by the expected average direct hit, then emits one Vulcan explosion against the configured neighbors. Starting Health proxies Max Health; the explosion uses linear falloff, line of sight, Blast defense rules, and faction bonuses. It does not model Shield/Overguard order or Shield Gate, stealth's 8× factor, neighbor depletion, recursive kills, Scaling, finite TTK, or 5s Avg DPS. Those bounds appear in the builder and build explanation.

Focused calculator and optimizer regressions pass, including the check that Auto Optimize leaves Vulcan Blitz out when the target is too healthy for the assumed one-hit kill. Seed `20261171` exercises four Grineer/Corpus/Infested profiles with varied Health, Armor, neighbor count, and mean distance. Each two-slot pool includes Vulcan Blitz plus three shuffled fully modeled mods; all legal subsets, owned rank tuples through R0–R2, polarity placement, and rank-30 Catalyst capacity are exhaustively scored. Auto Optimize matches each exact sampled-pool winner. The mod card labels the supported snapshot “Modeled group estimate” and retains the unscored/optimizer-skip warning outside it. PR [#403](https://github.com/Appl3Tree/Tenno-Hub/pull/403) squash-merged as `c9a3da534208e47ce15f22bfd00fd4d8f6f29281`; Pages run [#482](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45692558316) succeeded. In-app review of deployed `?version=c9a3da5` confirmed the Jat Kittag R5 card's modeled label under Faction Focus with three neighbors at 3m and the score-assumption summary. This remains a bounded model, not a global-optimality, Underframe-parity, or live-game claim. App/test TypeScript, focused ESLint, source validation, coverage audit, `git diff --check`, and a 993-module production build pass. The audit reports 699 profiles / 600 eligible mods / 519 parsed / 81 without parsed effects / 73 candidates (48 partial / 25 fully unparsed). The broader calculator and optimizer files and the full repository suite remain open; the stopped runs ended in unrelated long-running optimizer cases. No candidate-latency or Underframe comparison was performed for this change.

## D3-MOD-SENTIENT-BARRAGE-CHARGE-SNAPSHOT-001 — Battacor direct Burst snapshot (released in PR #401 / Pages run #480; rendered review complete)

The [Battacor Wiki page](https://wiki.warframe.com/w/Battacor) documents Alt-Fire damage scaling with one to three stored charges and its contact explosion. [Sentient Barrage](https://wiki.warframe.com/w/Sentient_Barrage) removes the explosion, grants infinite Body Punch Through, and gives its rank-scaled Critical Chance and Critical Damage bonus to the next discharge after full charge. The Mod Builder exposes a saved 0–3 current-charge snapshot and a separate editable ready/not-ready state. Charge history and readiness are assumptions, not predicted from primary-fire kills or enemy hits.

The selected direct Secondary Fire row scores one charge-scaled beam against the selected target plus an immediate same-target explosion when the augment is absent. The linked explosion ignores Multishot; Sentient Barrage suppresses it. The augment's rank bonus applies to base Critical Chance and Critical Damage only when the ready snapshot is active. At ranks 0–5 the parser reads +50/+100/+150/+200/+250/+300% to each crit stat. A zero-charge discharge has no scored damage, and Battacor Alt-Fire Auto Optimize is blocked; positive charges permit direct Burst optimization. Sentient Barrage is eligible only when equipped, ready, charged, and in the supported context.

Focused Vitest selection passes 5/5 tests across parsing, charge normalization/scaling, the linked explosion and Multishot exclusion, augment suppression/crit bonus, objective gates, and optimizer eligibility. Seed `20261170` compares randomized four-stratum weapon/faction pools, owned caps through R0–R2, two-slot legality, and varied 1–3 charge assumptions against exhaustive legal sampled winners. App/test TypeScript, focused ESLint, source validation, effect-coverage audit, CRLF-aware diff check, and the 993-module production build pass. The audit reports 699 weapon profiles / 600 eligible mods / 518 parsed / 82 without parsed effects / 73 candidates (47 partial / 26 fully unparsed). The full repository suite was not rerun.

PR [#401](https://github.com/Appl3Tree/Tenno-Hub/pull/401) squash-merged as `dacce02499bea745fd8bf0df42efd0990d450b9a`; Pages run [#480](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45676080965) passed build, artifact upload, artifact-index settling, and deployment. In-app browser review of deployed version `?version=dacce02` confirmed that changing the charge input from 0 to 3 changed Burst output, and enabling Sentient Barrage's next-discharge-ready checkbox changed the crit panel from 34% / 3.0x to 136% / 12.0x. The rendered UI showed the saved snapshot assumptions and the direct single-target / unsupported-history explanation; the temporary test build was reset afterward. This confirms deployed UI behavior, not live-game fidelity.

Scoring excludes primary-fire charge/refill history, infinite Body Punch Through, multi-target/AoE coverage, finite TTK, sustained/5-second DPS, and non-Burst Auto Optimize. This bounded oracle does not establish global optimality, Underframe parity, live-game accuracy, full-suite correctness, or production Worker latency. Reopen on new evidence or regression.
## D3-MOD-GUARDIAN-DERISION-BLOCK-COMBO-SNAPSHOT-001 — blocking-combo estimate (released in PR #397 / Pages run #476; rendered review complete)

The current [Guardian Derision Wiki page](https://wiki.warframe.com/w/Guardian_Derision) lists a rank-scaled Combo Count Chance bonus while blocking, reaching +30% at max rank. The [Melee Combo page](https://wiki.warframe.com/w/Combo_Counter) says every successfully blocked enemy attack adds one combo point, and Additional Combo Count Chance can award a further point on block. The catalog parser recognizes the block-only stat and its six values: +5%, +10%, +15%, +20%, +25%, and +30%.

The bounded model is available only in Tennokai Cycle DPS. A saved 0–20 input represents successfully blocked enemy hits/projectiles per Normal/Heavy cycle; the Wiki notes individual blocked projectiles can each add combo. Each event adds one base combo point plus the Guardian Derision chance as an expected fractional point. Events are evenly distributed within each cycle, enter the same ordered combo timeline as other gains, and refresh combo duration. They do not generate Tennokai opportunities. Guardian Derision is accepted by Auto Optimize only for Tennokai Cycle DPS with a positive block count. Without entered blocks, the mod is inactive; other objectives skip the block effect. The blocking taunt is disclosed as utility and does not affect damage.

This is a manual event-count snapshot, not an incoming-attack simulator. It assumes every entered event is successfully blocked and does not predict enemy attack cadence, block angle, damage prevention, targeting, or animation timing. Even spacing is an estimate. No live-game calibration or Underframe comparison is established.

Regressions verify all six parsed values, that block points increase later combo tier without changing the Tennokai opportunity share, that Guardian Derision is optimizer-eligible only with the active objective and positive assumption, and that seeded exact two-slot optimizer winners match across four weapon/faction profiles. Seed 20261169 varies cadence, block count, and owned rank caps through R0–R2. The timeline test file passes 24/24; the Guardian seeded oracle passes 1/1; the app/test TypeScript build and 993-module Vite production build pass. Focused ESLint, source validation, and the coverage audit pass. The refreshed audit reports 699 profiles, 517/600 parsed mod records, 83 without parsed effects, and 73 conservative candidates (46 partial / 27 fully unparsed). The full repository suite was not rerun.

PR [#397](https://github.com/Appl3Tree/Tenno-Hub/pull/397) squash-merged as 805a6f5aa5889271bb75c1ee96dc2d75712c1e91, and Pages run [#476](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45646473719) succeeded. The in-app browser rendered deployed version `?version=805a6f5`. Guardian Derision and Condition's Perfection on Broken War exposed the successful-block-count control and explanation; setting 3 updated the rendered assumption. The Owned Mods view showed the owned checkbox and R0–R5 copy controls, and the weapon picker offered Vinquibus Primary/Melee with the Melee Bayonet note. This closes rendered UI review for these controls, not live-game behavior or Underframe parity.


## D3-OPT-SEEDED-BURST-SCALING-ORACLE-001 — rank-limited Burst and Scaling sample (2026-11-23; bounded)

Added a seeded exact sampled-pool oracle for the direct `Burst` and sustained `Scaling` objectives, which were absent from the existing randomized exact-winner corpus (then covering finite Expected TTK and five-second Avg DPS). Seed `20261156` chooses a supported attack and four fully modeled compatible mod candidates from each Braton Prime / Grineer / Realistic, Lex Prime / Corpus / Initial, Cedo / Grineer / Realistic, and Broken War / Infested / Fully Stacked fixture. Each candidate is randomly capped at owned Rank 1 or 2; the oracle enumerates every legal ordered subset, rank tuple, and slot assignment through three slots at rank-30 Catalyst capacity with alternating zero/one Forma.

All eight optimizer results (two objectives for each fixture) match the exact sampled-pool winner and satisfy owned-rank, capacity, and Forma limits. The focused Vitest case passes 1/1 (1.49s for the test body); test-project TypeScript, focused ESLint, and CRLF-aware diff check pass. This adds bounded objective coverage only: it does not establish global optimality, Underframe parity, or gameplay accuracy. No application source, production build, or deployment changed.

## D3-MOD-TENNOKAI-OPPORTUNITY-MODEL-001 — grouped melee-mod coverage (full event timeline selected; in progress, 2026-11-23)

The current local source record groups seven melee mods behind Tennokai behavior. On 2026-11-23, current searchable WARFRAME Wiki pages were rechecked for [Melee](https://wiki.warframe.com/w/Melee), [Heavy Attack](https://wiki.warframe.com/w/Heavy_Attack), [Tennokai Mods](https://wiki.warframe.com/w/Tennokai_Mods), [Dreamer's Wrath](https://wiki.warframe.com/w/Dreamer%27s_Wrath), [Condition's Perfection](https://wiki.warframe.com/w/Condition%27s_Perfection), [Master's Edge](https://wiki.warframe.com/w/Master%27s_Edge), [Opportunity's Reach](https://wiki.warframe.com/w/Opportunity%27s_Reach), and [Truth's Flame](https://wiki.warframe.com/w/Truth%27s_Flame). The base behavior remains a 15% opportunity chance and 2-second window; opportunity generation requires a qualifying direct melee hit. A Heavy Attack or Heavy Slam during the active window triggers Tennokai and preserves combo; Heavy Attacks gain faster wind-up, while Heavy Slams have no wind-up to shorten. Dreamer's Wrath increases chance multiplicatively (rank 3 changes 15% to 22.5%) and adds Critical Damage only to Tennokai attacks. Discipline's Merit replaces random opportunities with one every 7/6/5/4 melee hits across ranks 0–3. The user selected a full event timeline, an editable number of qualifying regular hits between Heavy Attacks, and repeating identical targets for Truth's Flame kill chains.

The same Wiki page adds event-eligibility details: a direct strike is required, with listed Exalted Blade and Serene Storm wave exceptions. It also states that, except for Gunblades, “striking multiple enemies from a single hit and multi-strike attacks do not count as hits”; these cases need attack-level event interpretation. Tennokai's wind-up bonus is not affected by ordinary Heavy Attack Wind Up Speed bonuses. A dynamic score therefore needs qualifying-hit and timing data; using catalog fire rate alone could overcount opportunities and misstate Tennokai cadence.

The generated `warframe-items-all-lean.auto.json` snapshot has the following rank effects:

- Condition's Perfection: +25/+50/+75/+100% Status Chance on Tennokai attacks.
- Discipline's Merit: opportunity every 7/6/5/4 melee hits.
- Dreamer's Wrath: +12.5/+25/+37.5/+50% multiplicative opportunity chance and +8/+16/+24/+32% additive Critical Damage for Tennokai attacks.
- Master's Edge: +10/+20/+30/+40/+50/+60% Tennokai damage.
- Mentor's Legacy: enables Tennokai; the upstream export has no rank-stat block.
- Opportunity's Reach: 2.8/3.2/3.6/4.0-second opportunity window and +0.75/+1.5/+2.25/+3m melee range.
- Truth's Flame: a Tennokai kill extends the opportunity by 4 seconds and enables its rank-listed +30/+40/+60/+120% Tennokai damage bonus; a Tennokai attack that fails to kill can reset combo and apply 25/35/50/100 Heat damage per second for six seconds. The Wiki also lists its separate Truth syndicate effect.

The working tree parses the seven rank records and adds `simulateTennokaiOpportunityTimeline` plus `calculateTennokaiAttackTimeline`. The scheduler tracks expected opportunity probability, expiration, multiplicative chance, guaranteed-hit cadence, active-opportunity consumption, combo tiers, Heavy Attack Efficiency, Initial Combo regeneration, and Truth's Flame kill/failure branches. The manual panel alternates one Normal Attack with one catalogued Heavy Attack or Heavy Slam row and applies event-specific Tennokai damage, critical damage, and status chance. The user can edit and save 1–20 regular hits between Heavy Attacks.

Truth's Flame is estimated against the selected target pools. Expected direct hit damage accumulates against one target and resets to the same pool profile after a modeled kill. A Tennokai Heavy Attack kill unlocks the additional four-second opportunity and persistent chained damage; a failed Tennokai kill consumes the opportunity and resets combo. The kill threshold is deterministic against expected direct damage, not a distribution over critical or projectile outcomes. Status-tick kills, Truth's Flame self-Heat curse damage, and its Truth syndicate proc are omitted. The catalog currently has no Normal Attack / plain Heavy Attack row pairs, so the UI presently accepts Heavy Slam rows; centered one-target coverage excludes adjacent enemies and jump/position timing.

The manual panel remains a direct-event estimate, while a new `Tennokai Cycle DPS` objective feeds the same timeline into Auto Optimize. The objective scores four repeated cycles against the initial target pools, routes the selected target faction and armor, and applies event-local Tennokai damage/critical effects. Full candidate pools use a bounded one-cycle shortlist of up to 24 mod families, a 10-state beam, representative rank choices, and exact four-cycle re-scoring of up to 10 finalists. This search is a useful full-catalog estimate, not a global-optimum guarantee. Standard Burst, Scaling, finite TTK, and fixed-window Avg DPS still exclude Tennokai history; the new cycle objective does not alter those scorers.

The scorer rejects catalog rows with more than one component strike, multi-target/AoE regular hits, Gunblades, and Glaives; centered Heavy Slam rows are the supported exception for one selected target. The catalog currently has no Normal Attack plus plain Heavy Attack pair, so supported catalog coverage is limited to Heavy Slam. One combo point per regular hit is assumed rather than stance-specific combo generation. The follow-up below adds weapon-specific base duration, percentage modifiers applied to base, flat seconds, and the 0.1-second floor. Opportunity's Reach applies its window bonus but assumes contact and does not apply its range value as a hit/miss check; attack speed is used without numeric Tennokai wind-up timing; Status Chance is shown in the manual timeline but omitted from direct-hit objective scoring. Per the user's repeated-identical-target choice, the Tennokai Cycle DPS objective also lets Auto Optimize consider Truth's Flame and models its kill chain across repeated selected target pools. It excludes the player-side Heat curse and Truth syndicate effects and explicitly ranks target damage only. Status-tick kills, evolving target pools across four optimizer cycles, stance combo generation, adjacent-target coverage, and live-game timing remain outside this estimate.

Focused Tennokai timeline/optimizer tests pass 23/23 (211 unrelated cases skipped), including the Truth's Flame chain, the Relentless Combination exclusion boundary, flat combo-timeout behavior, and the four-fixture exact sample. The focused Body Count explanation regression also passes (3 selected tests, 231 skipped), confirming the +15s value is shown in seconds, not as +1500%. Seed `20261158` exact-scores Broken War / Grineer, Gram Prime / Corpus, Lesion / Infested, and Nikana Prime / Grineer using supported normal/heavy-slam pairs, five sampled mod candidates, owned rank caps R0–R1, at most two slots, rank-30 Catalyst capacity, and zero Forma; each optimizer result matches the exhaustive legal ordered-subset/rank winner. A separate full-catalog eight-slot Broken War regression confirms a positive target-aware score, a retained Tennokai enabler, and capacity legality. Local timing observations on the 111-record Broken War pool were 0.88s for three slots, 1.21s for eight max-rank slots, and 4.10s for eight slots with non-max ranks enabled; these are machine-specific, not a latency guarantee. App/test TypeScript, focused ESLint, source validation, `git diff --check`, and a fresh production Vite build pass. The coverage audit remains 698 weapon profiles, 600 eligible records, 507 parsed, 93 with no parsed effect, and 68 conservative candidates (31 partial / 37 full; zero weapon pools without parsed damage). Codex IAB queued both the supplied localhost and the temporary production preview without returning rendered content. Current-source visual review remains unverified. No Underframe comparison or live-game accuracy claim follows from these model tests.

The follow-up seed `20261161` raises the exact sampled-pool oracle to three slots and owned caps through R3 across the same four weapon/faction strata. Each fixture contains Master's Edge plus four shuffled candidates from the existing Tennokai/damage set; all compatible subsets and rank tuples through three slots are placed against the weapon's default polarities and filtered for legality at rank-30 Catalyst capacity with no Forma. The optimizer matches each exact sampled winner and returns a capacity-legal build whose selected ranks stay within the randomized owned caps. Focused Vitest passes 1/1 (30.16s test body); test-project TypeScript, focused ESLint, and CRLF-aware diff check pass. PR [#360](https://github.com/Appl3Tree/Tenno-Hub/pull/360) squash-merged as `e196638fdb8654c9cf3bf55fcada2285eb918240`; Pages run [#439](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45313294690) completed its artifact check and deployment successfully. This is a test-only extension: it does not change the deployed scorer or establish full-pool/global optimality, Underframe parity, or gameplay accuracy.

## D3-MOD-MELEE-COMBO-DURATION-001 — flat-duration support in Tennokai timeline (implemented, 2026-11-23)

Generated mod records store `+Ns Combo Duration` as a flat second value. The timeline initially added this to a generic five-second base; the follow-up below replaces that assumption with each weapon's exported base and supports percentage modifiers. Flat duration summaries are shown in seconds. Rank data such as Drifting Contact `+10s` is covered by the integration regression; a simulated long attack gap verifies the extended timeout preserves combo.

Focused timeline/optimizer tests pass 23/23; the explanation regression confirms Amalgam Furax Body Count's parsed `+15s` is displayed in seconds. The subsequent percentage support below supersedes the earlier fixed-base duration description.

## D3-MOD-MELEE-COMBO-DURATION-002 — base-relative percentage support (deployed, 2026-11-24)

The [Corrupt Charge Wiki page](https://wiki.warframe.com/w/Corrupt_Charge) and [True Punishment Wiki page](https://wiki.warframe.com/w/True_Punishment) say their combo-duration penalty is calculated from the weapon's base value: a rank-3 −50% removes 2.5 seconds from the standard five-second timer. The [Combo Counter page](https://wiki.warframe.com/w/Combo_Counter) sets a 0.1-second minimum and lists weapon exceptions. The Wiki's [weapon data schema](https://wiki.warframe.com/w/Module:Weapons/data) maps `ComboDur` to the export's `comboDuration`; the existing WFCD-derived records carry that value.

`WeaponEntry` now retains the exported melee base timeout, and Tennokai Cycle DPS computes `max(0.1, baseSeconds × (1 + sum(percentage bonuses)) + sum(flat seconds))`. This handles Corrupt Charge and True Punishment percentages against the base, then adds Drifting Contact or other flat seconds; the formula yields 12.5 seconds for Broken War with rank-3 Drifting Contact (+10s) and Corrupt Charge (−50%). Guandao Prime (6s), Pulmonars (9s), and Vitrica (10s) regressions verify non-default weapon bases. Burst can score Corrupt Charge's initial combo on an attack row that uses combo damage; timed Scaling/TTK/window objectives block duration mods because they do not simulate combo expiry. Explanations use the generic label `Combo Duration` because non-melee equipment can also carry this stat.

Additional Combo Count Chance is still random: the Tennokai timeline assumes one combo point per regular hit. True Punishment and other mods with that effect therefore remain blocked from Tennokai Cycle DPS Auto Optimize until event-level combo-gain probability is modeled; the manual timeline surfaces the limitation. The focused timeline/optimizer selection passes 5/5 relevant tests; app/test TypeScript, focused ESLint, `npm run validate:sources`, CRLF-aware diff check, and a fresh Vite build pass. The refreshed effect-coverage report is 698 profiles / 600 eligible records / 507 parsed / 93 without parsed effects / 73 candidates (36 partial / 37 fully unparsed) / zero empty pools. PR #357 squash-merged as `13d1685e0e6712c55036d2d19a391bbd357e9bd8`. Pages run [#436](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45309291029) hit the artifact metadata race; the polling guard in PR #358 resolved it and Pages run [#437](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45310495589) succeeded. Current-source visual review and gameplay behavior remain open.

## D3-OPS-PAGES-ARTIFACT-METADATA-WAIT-001 — workflow indexing guard (released in PR #358, 2026-11-24)

Pages runs #435 and #436 both succeeded through `Build` and `Upload Pages artifact`, then failed in `deploy-pages@v4` because GitHub returned zero artifacts for that run. The artifact endpoint later listed one non-expired `github-pages` artifact for #436. Retrying #435's failed job created duplicate artifacts, so #436 was not rerun. PR #358 adds `actions: read` and polls the current run's artifact endpoint for exactly one `github-pages` artifact, retrying for up to 60 seconds before deployment. Workflow YAML parses, the application production build passes, and CRLF-aware diff check passes. Pages run [#437](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45310495589) completed successfully through the metadata wait and deploy steps on merge commit `bd818b16`.

## D3-MOD-RELENTLESS-COMBINATION-SLASH-TICK-001 — ordered Tennokai Slash/Bleed timeline (released in PR #363; 2026-11-24)

The current [Relentless Combination Wiki page](https://wiki.warframe.com/w/Relentless_Combination) describes Melee Combo generation from melee-caused Slash procs. The local raw mod record lists +25/+50/+75/+100% chance by rank when Slash Status deals damage. The [Slash Status page](https://wiki.warframe.com/w/Damage/Slash_Damage) gives a one-second first Bleed tick and a six-second base lifetime, with one tick each second. The Wiki's mechanic notes describe combo gain on Slash application and from each subsequent Bleed damage tick; the effect therefore depends on the status lifetime and the target remaining alive.

The user selected a full ordered model in Tennokai Cycle DPS: Slash applications, per-stack Bleed ticks, rank-scaled Relentless gains, target death/cancellation, and repeated identical target profiles. The implementation maps the Wiki stat text to 25/50/75/100% rank chance with no unmatched source lines; ticks are scheduled one second after application and once per second, each stack retains its own tick damage and duration, ticks use the shared Slash active-pool resolver, and direct/tick kills reset pools and clear old-target Bleeds. Relentless gains update later combo tiers and expiry. Tennokai Status Chance now affects modeled Slash applications; unrelated status types remain excluded. PR [#363](https://github.com/Appl3Tree/Tenno-Hub/pull/363) squash-merged as `d60b50f4029bda36280cc69284f18f7c493a61fc`; Pages run [#442](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45323148212) completed successfully and deployed the change.

The bounded estimate uses expected fractional applications and combo gains rather than sampled proc rolls. Slash-tick kills reset the target but do not activate Truth's Flame's Tennokai kill chain; only a direct Tennokai Heavy Attack kill does. The dedicated objective's optimizer can select Relentless when it improves the configured cycle: a focused 20-regular-hit fixture scores above an enabler-only baseline. A 25-case exact mini-oracle enumerates every two-mod subset and R0–R3 rank tuple for Relentless Combination plus Condition's Perfection; the optimizer matches the maximum score in that bounded pool. The full related Tennokai/Relentless selection passes 29 tests / 211 skipped, including the prior seeded two-/three-slot sampled-pool optimizer oracles. App/test TypeScript, focused ESLint, source validation, coverage audit, CRLF-aware diff check, and a temporary-output 989-module Vite production build pass. The current coverage audit reports 698 profiles / 600 eligible records / 508 parsed / 92 with no parsed effect / 73 conservative candidates (37 partial / 36 fully unparsed) / zero empty weapon pools. The package `npm run build` path hit EPERM writing TypeScript/Vite temporary files through the shared `node_modules` link; separate typechecks and Vite build with `--configLoader runner` pass. Current-source rendered review is open because IAB queued the localhost request without returning content. Reopen if authoritative timing/stacking rules change, or if a focused fixture disagrees with the event schedule. This bounded sample does not establish global optimality, Underframe parity, live-game accuracy, or visual correctness.

## D3-OPT-TENNOKAI-RELENTLESS-SAMPLED-POOL-001 — four-stratum exact-winner oracle (2026-11-24)

Seed `20261162` adds a seeded optimizer correctness check with Relentless Combination available in four melee/faction contexts: Broken War / Grineer, Gram Prime / Corpus, Lesion / Infested, and Nikana Prime / Grineer. Every sampled pool includes Master's Edge and Relentless Combination plus three shuffled candidates from Condition's Perfection, Opportunity's Reach, Organ Shatter, and Fury. Owned-rank caps vary through R1–R2 and the regular-hit cadence varies from 4–20 between Heavy Attacks. For each fixture, the oracle exhaustively scores compatible legal subsets and rank tuples through two slots at rank-30 Catalyst capacity, default weapon polarities, and no Forma; each fixture has more than 40 legal candidates. All four `Tennokai Cycle DPS` optimizer outputs equal the sampled-pool maximum and satisfy capacity/owned-rank checks.

The isolated oracle passes 1/1 (7.14s); the focused Tennokai/Relentless selection passes 30 tests / 211 skipped (61.47s). Test-project TypeScript, focused ESLint, and CRLF-aware diff check pass. PR [#365](https://github.com/Appl3Tree/Tenno-Hub/pull/365) squash-merged as `df4474607f866a945069852e56dfd1f992dff89b`; Pages run [#444](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45327137358) succeeded. This test-only change does not alter application scoring. It adds four contexts to the bounded sample, not full-catalog ranking, global optimality, Underframe parity, or gameplay validation.

## D3-OPT-TENNOKAI-RELENTLESS-THREE-SLOT-R0-R3-ORACLE-001 — higher-rank legal-pool follow-up (2026-11-24)

Seed `20261163` extends Relentless Combination exact-winner checks to three slots and owned caps through R1–R3, with R0 also available as an optimizer choice. It uses the same four weapon/faction strata as the prior seed: Broken War / Grineer, Gram Prime / Corpus, Lesion / Infested, and Nikana Prime / Grineer. Each five-mod pool always contains Master's Edge and Relentless Combination plus three shuffled candidates from Condition's Perfection, Opportunity's Reach, Organ Shatter, and Fury. The editable regular-hit cadence varies from 4–20. The oracle enumerates legal compatible subsets and rank tuples, assigns them to three slots with default weapon polarities, and checks rank-30 Catalyst capacity without Forma. Every fixture has over 100 legal candidates; all four optimizer scores match the exact sampled-pool maxima and remain within owned ranks/capacity.

The isolated test passes 1/1 (97.67s test body); the Tennokai/Relentless selection passes 31 tests / 211 skipped (149.51s). App/test TypeScript, focused ESLint, `npm run validate:sources`, the mod-effect audit (698 profiles / 600 eligible records / 508 parsed / 92 without parsed effects / 73 candidates: 37 partial and 36 full / zero empty pools), temporary 989-module Vite production build, and CRLF-aware diff check pass. The full repository and optimizer suites were not run. PR [#367](https://github.com/Appl3Tree/Tenno-Hub/pull/367) squash-merged as `8776f13bb9fd95d39b4426d51c1240a266655d02`; Pages run [#446](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45329119039) succeeded. This is a stronger bounded sample, not full-catalog/global optimization, Underframe parity, or gameplay validation.

The audit's Relentless Combination note now states that Slash-application and Bleed-tick combo gains are modeled only in Tennokai Cycle DPS; standard weapon-scoring objectives exclude that history. Focused assertions cover both contexts. The aggregate 73-candidate count does not change, because this corrects scope disclosure rather than parser coverage.

## D3-MOD-DEADLY-MANEUVER-BURST-SNAPSHOT-001 — Magnus headshot Critical Chance snapshot (released in PR [#351](https://github.com/Appl3Tree/Tenno-Hub/pull/351); 2026-11-23)

Deadly Maneuvers now parses the four rank values listed by the [current Wiki page](https://wiki.warframe.com/w/Deadly_Maneuvers): +100%, +200%, +300%, and +400% Headshot Critical Chance. Following the user's selected interpretation of the rank text, the bonus multiplies the existing headshot Critical Chance after other buffs, producing ×2/×3/×4/×5 on each buffed headshot at ranks 0–3. The selected effect is limited to Magnus and Magnus Prime direct attacks that can headshot.

The Mod Builder exposes an editable 0–2 remaining-shot snapshot after a dodge. Burst calculates the configured direct headshot share for each of the next two shots and averages the one or two remaining buffed shots with the unbuffed remainder. Zero means the dodge buff is inactive. The value is saved/restored with build state and disclosed in the build explanation and attack math trace. Dodge timing and the actual shot sequence are not simulated.

The augment can enter Burst Auto Optimize only when Magnus/Magnus Prime, a headshot-capable direct attack, a nonzero configured headshot share, and a positive remaining-shot snapshot are selected. Scaling, sustained DPS, finite Expected TTK, and fixed-window/5s DPS strip the snapshot and leave the augment unavailable. Area attacks and unsupported contexts fail closed.

Focused regressions cover all rank values, 0/1/2 remaining shots, the ×2–×5 multiplier order, configured headshot share, Burst-only damage, and optimizer objective/weapon gates. The filtered catalog/calculator/optimizer run passes 5/5, and the additional optimizer scope assertion passes 1/1; the full affected catalog/calculator files pass 221/221. App/test TypeScript, focused ESLint, source validation, mod-effect coverage audit, CRLF-aware diff check, and a temporary 988-module Vite build pass. The audit reports 698 weapon profiles / 600 eligible mod records / 501 parsed / 99 with no parsed effect / 68 conservative candidates / zero empty pools.

The local `http://localhost/Tenno-Hub/` endpoint timed out during this checkpoint, so no current-source rendered review is claimed. The full repository suite, full optimizer suite, live-game behavior, and Underframe parity were not validated. PR #351 squash-merged as `67bbdf58168e580311ff2e3ef90d688ce3e32e6c`; Pages run [#431](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45260382142) succeeded. Reopen if a supported Magnus attack context or the rank-text interpretation changes.

## D3-MECH-VULCAX-SINGLE-SHOT-RADIAL-SEQUENCE-001 — charged Impact plus attached Radial Attack (released in PR #327; 2026-11-23)

### Source behavior and bounded model

The [Vulcax Wiki page](https://wiki.warframe.com/w/Vulcax) lists a 500 Heat hitscan Impact, one ammo per shot, and a 100 Blast Radial Attack with 20% Critical Chance, 2.5× Critical Multiplier, 20% Status Chance, 5m radius, and 100%→50% radial falloff. The page describes one charged Heat shot and presents the radial damage as a separate attack row. [Fire Rate](https://wiki.warframe.com/w/Fire_Rate) lists a 1.00s Vulcax charge time and defines charged cadence as charge time plus the post-charge interval. The direct Impact uses the Wiki's 300m hitscan limit, supported by [Range](https://wiki.warframe.com/w/Range) and [Hitscan](https://wiki.warframe.com/w/Hitscan); this is enforced as a hard cap.

The catalog now links one immediate Radial Attack to each directly hit Impact and scores that bounded event against the struck target. The target is treated as centered at the blast origin, so the attached radial component uses 100% damage; its standalone row retains 0–5m / 50%-minimum falloff and is reference-only to prevent double counting. The link is an explicit inference from the same charged shot and its separately listed radial component, not independent in-game confirmation. Other targets and area coverage are excluded. This models neither companion targeting reliability nor projectile/direct-hit misses.

`weaponCatalog.ts` adds per-row 1.0s charge and 1-round cost overrides, the 300m Impact hit cap, radial falloff, a linked single-target component, a score boundary note, and a standalone-component limitation. Tests cover the catalog source values, initial charge and 0.5 follow-up attacks/sec from the Wiki formula, the 100-damage centered radial component, zero damage at 301m, and finite-target optimization. The optimizer accepts Impact for Burst/Expected TTK and rejects standalone Radial Attack.

### Validation and limits

- Focused Vulcax catalog/calculator/optimizer regressions: 3/3 passed.
- Full affected catalog and calculator files: 211/211 passed.
- Focused Vulcax optimizer regression: 1/1 passed; combined TTK beats the direct-only control for the 700-Health / zero-Armor Corpus fixture, and the standalone radial row is rejected.
- App/test TypeScript, `npm run validate:sources`, and `npm run audit:prerequisites` (162 entries; no unresolved references or cycles) pass.
- Focused ESLint over all four changed code/test files passes. Production Vite build transforms 987 modules and succeeds in 10.27s to a temporary output directory; the existing large-chunk warning remains.
- `git -c core.whitespace=cr-at-eol diff --check` passes. Plain `git diff --check` treats this repository's CRLF endings as trailing whitespace.

No full repository suite, live-game hit/charge calibration, Underframe comparison, or current-source IAB visual test was performed. This session exposes no integrated-browser interaction/screenshot control; the previously supplied localhost is documented as stale at `version=2bf6faea`. Do not use an external browser. PR [#327](https://github.com/Appl3Tree/Tenno-Hub/pull/327) squash-merged as `8c15e58cdce71fda42f0862bd6cbff9a0966b76a`; Pages run [#407](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45176106906) succeeded at `version=8c15e58`. Hosted visual review remains open. Reopen this item if an authoritative source or reproducible game observation shows a different charge time, ammo cost, falloff, or impact/radial relationship.

## D3-OPT-RANK-OWNED-FIVE-SLOT-R1-R2-TTK-ORACLE-001 — first two-fixture shard (released in PR #329; 2026-11-23)

Seed 20261154 samples five fully modeled, pairwise-compatible damage mods and one supported attack from each Braton Prime / Grineer and Lex Prime / Corpus fixture. Each sampled mod has an owned cap through R2 (or its lower fusion limit), and the exhaustive oracle scores every legal ordered subset and rank tuple through five slots. Both fixtures use rank-30 Catalyst capacity and default weapon polarities; the run alternates zero Forma for Braton Prime and one Forma for Lex Prime. Exilus and Arcane search are disabled.

The optimizer matches the exact sampled-pool finite Expected TTK winner for both fixtures and returns rank-, capacity-, and Forma-legal builds. PR #329 squash-merged as 60d8657ff822a7a7fe130b5512cf6deb71996115; push-triggered Pages run [#409](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45181274288) succeeded. The test-only change has no app source, and GitHub reported no PR status checks or PR-triggered workflow runs. The focused Vitest run passes 1/1 in 537.52s (201 unrelated tests skipped). The test project TypeScript check, focused ESLint, and CRLF-aware diff check pass. No application source changed, so no production build or deployment applies.

The earlier four-fixture R1–R2 attempt exceeded its five-minute test timeout without a result. At its release this two-fixture split completed only the Braton and Lex strata. Later PR #332 adds Cedo / Broken War and completes the four selected strata at R1–R3 for finite TTK. Both results remain bounded sampled-pool evidence, not global optimizer quality, fixed-window optimization, Underframe parity, or gameplay accuracy. No separate Arcane, Exilus, or live-game validation was performed.
## D3-OPT-RANK-OWNED-FIVE-SLOT-R1-R2-SECOND-SHARD-ORACLE-001 — Cedo / Broken War shard (released in PR #330; 2026-11-23)

The first shard is released and covers Braton Prime / Grineer and Lex Prime / Corpus. This second shard uses seed 20261155 to sample five fully modeled, pairwise-compatible mods for Cedo / Grineer and Broken War / Infested. The oracle enumerates every legal ordered subset and rank tuple through five slots with owned caps through R2, rank-30 Catalyst capacity, default polarities, and alternating zero/one Forma. Both optimizer results match the exact finite Expected TTK winner. The focused Vitest run passes 1/1 in 365.26s (202 unrelated tests skipped); test-project TypeScript, focused ESLint, and CRLF-aware diff check pass. The already validated Braton / Lex shard was not repeated. PR #330 squash-merged as cffe29ce3e5d73671c0ff883c0dbbbe08e3f81bd; Pages run [#410](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45183373476) succeeded. Along with PR #329, the two shards cover Braton Prime / Grineer, Lex Prime / Corpus, Cedo / Grineer, and Broken War / Infested for R0–R2 five-slot TTK. The four-stratum result remains bounded sampled-pool evidence. Later PR #332 adds R1–R3 finite-TTK evidence for the same four fixtures; fixed-window optimization, global optimizer quality, Underframe parity, and gameplay accuracy remain open.
## D3-OPT-RANK-OWNED-FIVE-SLOT-R1-R3-FIRST-SHARD-ORACLE-001 — Braton / Lex shard (released in PR #332; 2026-11-23)

Seed 20261156 samples five fully modeled mods whose owned caps are shuffled across R1, R2, and R3, plus one supported attack for Braton Prime / Grineer and Lex Prime / Corpus. The oracle enumerates every legal ordered subset and rank tuple through five slots with rank-30 Catalyst capacity, default polarities, and alternating zero/one Forma. Exilus and Arcane search are disabled; the objective is finite Expected TTK. Both optimizer results match their exact exhaustive sampled-pool winners while obeying the owned-rank, capacity, and Forma limits. The focused Vitest run passes 1/1 in 775.98s (203 unrelated tests skipped); test-project TypeScript, focused ESLint, and CRLF-aware diff check pass. The complementary Cedo / Broken War shard also passes; together the two shards cover four selected weapon/faction strata for R1–R3 finite TTK. PR #332 squash-merged as 1228f0ca03256ce99ddfb5ac8a82c0135fd2d7cc; Pages run [#412](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45189629842) succeeded. GitHub reported no PR-triggered workflow runs. This is bounded sampled-pool model evidence, not global optimizer quality, Underframe parity, or gameplay validation.
## D3-OPT-RANK-OWNED-FIVE-SLOT-R1-R3-SECOND-SHARD-ORACLE-001 — Cedo / Broken War shard (released in PR #332; 2026-11-23)

Seed 20261157 samples five fully modeled mods whose owned caps are shuffled across R1, R2, and R3, plus one supported attack for Cedo / Grineer and Broken War / Infested. The oracle enumerates every legal ordered subset and rank tuple through five slots with rank-30 Catalyst capacity, default polarities, and alternating zero/one Forma. Exilus and Arcane search are disabled; the objective is finite Expected TTK. Both optimizer results match their exact exhaustive sampled-pool winners while obeying the owned-rank, capacity, and Forma limits. The focused Vitest run passes 1/1 in 392.68s (204 unrelated tests skipped); test-project TypeScript, focused ESLint, and CRLF-aware diff check pass. Along with the Braton / Lex shard, this completes the four selected weapon/faction strata for R1–R3 five-slot finite TTK. PR #332 squash-merged as 1228f0ca03256ce99ddfb5ac8a82c0135fd2d7cc; Pages run [#412](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45189629842) succeeded. GitHub reported no PR-triggered workflow runs. This is bounded sampled-pool model evidence, not global optimizer quality, fixed-window quality, Underframe parity, or gameplay validation.
## D3-MOD-WEAKPOINT-BONUS-HEAD-PROFILE-001 — bounded head weakpoint bonus support (released in PR [#278](https://github.com/Appl3Tree/Tenno-Hub/pull/278), squash merge `e3c3d776a210f7643d3bc7843dde09997d93cdb4`)

### Source behavior and selected scope

The current [Enemy Body Parts Wiki page](https://wiki.warframe.com/w/Enemy_Body_Parts) says weakpoint and headshot hitbox flags are distinct but often overlap. For a weakpoint that is also a head, Weak-point Damage bonuses add to the hitbox multiplier at 1.5× rate; Weak-point Critical Chance adds to the shot's Critical Chance. Non-head weakpoints do not use that 1.5× rate, and some weakpoint hits promote critical tier, which the planner does not model. The Wiki's [Damage Calculation page](https://wiki.warframe.com/w/Damage/Calculation) gives DoT seeds the separate weakpoint multiplier × (1 + Weak-point Damage bonus) formula.

Per the bounded implementation decision, the planner reuses the configured headshot hit share as the estimated share of direct hits on a confirmed head weakpoint. Faction-only synthetic profiles mark only established representative heads. Named MOA/Amalgam MOA and ambiguous Murmur/Techrot faction profiles do not treat non-head or uncertain locations as head weakpoints. The Charger page reports an additional weak point on the Grineer head at 1×; the profile retains no critical-headshot bonus.

### Implementation and validation

- `EnemyProfile`, faction hit-location data, target overrides, and target assumptions now carry `headIsWeakPoint`. Direct hit multipliers add 1.5 × Weak-point Damage bonus to a confirmed head's multiplier before ordinary headshot multiplier bonuses. Weak-point Critical Chance increases crit probability only for that head-hit share. The separate DoT branch uses 1 + Weak-point Damage bonus and preserves hit-location crit effects. AoE/radial attacks and melee remain ineligible under the existing headshot model.
- Auto Optimize admits weakpoint-only effects only when the selected target profile marks its head as a weakpoint; otherwise it keeps the conservative exclusion. Mod/Arcane picker warnings and Why This Build use the same target context. The help text discloses the head-share assumption and excludes non-head weakpoints and critical-tier promotion.
- Focused enemy-profile and damage-calculator suites pass 156/156; the optimizer regression (`scores Wiki-backed headshot bonuses at the configured hit share and keeps weak-point-only bonuses unscored`) passes 1/1, covering head-weakpoint, zero-headshare, and non-weakpoint filtering. App and test-project TypeScript checks pass (`npx tsc -p tsconfig.app.json --noEmit --incremental false`; `npx tsc -p tsconfig.test.json --noEmit --incremental false`). `npm run build` passes in 10.16s with the existing >500 KB chunk advisory. Focused ESLint and `git diff --check` pass.

- `npm run audit:mod-effect-coverage` still conservatively reports 697 weapon profiles, 600 eligible mod records, 495 parsed effects, 105 with no parsed effect at max rank, 69 review candidates (20 partial, 49 fully unparsed), and zero empty weapon pools. Because that audit has no target context, weakpoint-only effects remain in its review list; selected-target scoring is separately covered by the optimizer regression. Local production IAB rendered Braton Prime / Lancer and changed Average Shot from 39 to 91 at 50% estimated headshare.
- PR [#278](https://github.com/Appl3Tree/Tenno-Hub/pull/278) squash-merged as `e3c3d776a210f7643d3bc7843dde09997d93cdb4`. Push-triggered Pages run [#358](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45061336779) succeeded; GitHub reported no PR-triggered workflow runs or status contexts. Hosted production IAB at `https://appl3tree.github.io/Tenno-Hub/?version=e3c3d77` verified Faction Focus / named Lancer, 50% headshare, and the same 39 → 91 Average Shot response. The transient build was not saved; no saved build changed.

Known limits: the configured share remains a player estimate; faction profiles are synthetic; other weakpoint regions, weakpoint hit-location distributions, weakpoint critical-tier promotion, radial weakpoint behavior, and in-game hitbox variability remain unmodeled. This does not establish Underframe parity or gameplay accuracy.

## D3-MOD-STINGING-TRUTH-FLAT-MAGAZINE-001 — flat capacity and Truth proc boundary (released in PR [#276](https://github.com/Appl3Tree/Tenno-Hub/pull/276), squash merge `31bbbff4f26c930445900f06108a8025bbf4d03c`)

### Source-backed behavior

The current [Stinging Truth page](https://wiki.warframe.com/w/Stinging_Truth) lists rank 0–3 flat Magazine Capacity bonuses of +10/+20/+30/+40. It is exclusive to Viper and Viper Wraith and does not apply to Twin Vipers variants. The Wiki says the max-rank +40 changes their base magazines from 14/20 to 54/60. The [Upgrade page](https://wiki.warframe.com/w/Upgrade) says percentage Magazine Capacity is applied to the base value before flat bonuses and gives the example `14 × (1 + 0.3) + 40`. The [Primed Slip Magazine page](https://wiki.warframe.com/w/Primed_Slip_Magazine) documents nearest-whole-number rounding for non-integer magazine values.

The [Syndicates page](https://wiki.warframe.com/w/Syndicates) and [Weapon Augment page](https://wiki.warframe.com/w/Weapon_Augment) describe the separate Affinity-earned gauge and Truth effect. Truth adds radial Gas damage, 25% Health restore, and a temporary +25% Parkour Maneuvers buff. The planner still has no Affinity/gauge timeline or multi-target radial resolution, so these effects are not scored.

### Implementation and test evidence

- Added `magazineCapacityFlatBonus` independently from percentage `magazineBonus`. Rank parsing covers flat Magazine Capacity/Clip Size source lines; calculation applies percentage bonuses first, then flat rounds, then nearest-integer rounding in baseline magazine size, charged ammo-scaling, and final displayed magazine size.
- Manual Viper/Viper Wraith builds now include the supported capacity effect and the explanation lists `+N Magazine Capacity`. The unsupported Truth proc is disclosed at every affected rank, links to the Wiki, and blocks that mod rank from Auto Optimize while preserving supported manual stats. The same Truth warning covers Stinging Truth, Gilded Truth, Avenging Truth, and Truth's Flame raw `+N 'Truth'` lines.
- The focused damage calculator file passes 150/150, covering all four rank values, Viper and Viper Wraith totals, Twin Vipers exclusion, and percentage-plus-flat combinations (max-rank Slip Magazine gives modeled 55 and 62 magazines under the current sourced rounding rule). The focused optimizer test passes 1/1, verifies Stinging Truth and Gilded Truth are skipped at all ranks, and checks the Wiki-linked Truth warning. The Tennokai catalog test confirms Truth's Flame also exposes that distinct warning.
- `npm run build` passes app TypeScript and Vite production bundling; Vite reports the repository's existing large-chunk advisory. Focused ESLint and `git diff --check` pass. `npm run audit:mod-effect-coverage` reports 697 weapon profiles, 600 unique eligible mod records, 495 records with parsed effects, 105 with no parsed effect at max rank, 69 conservative review candidates (20 partial / 49 fully unparsed and excluded), and zero weapon pools without a parsed damage effect.
- Reproduce with `npx vitest run src/domain/logic/__tests__/damageCalc.test.ts --reporter=dot` and `npx vitest run src/domain/logic/__tests__/buildOptimizer.test.ts -t "models Stinging Truth" --reporter=dot`.

The local production preview at port 4182 timed out. After merge, Pages run [#356](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45054715475) completed successfully. Hosted production IAB at `version=31bbbff` verified the Build Planner with Viper selected: max-rank Stinging Truth displays `+40 Magazine Capacity`, the calculated Magazine stat is 54 (14 base + 40), and the mod card shows the Wiki-linked unscored Truth-effect warning and states that Auto Optimize skips it. The transient build was not saved and no saved build was edited. No full-suite, Underframe parity, or live-game claim; reopen only if source evidence or a reproducible calculation/UI regression contradicts these results.

## D3-OPT-UNDERFRAME-BRATON-COORDINATED-PAIR-001 — finite Expected TTK pair refinement (released in PR [#271](https://github.com/Appl3Tree/Tenno-Hub/pull/271), squash merge `1fdad3d962ae24ed1a4f820cefc13ffbd4494f88`)

The state-matched replay in PR #270 found the Braton Prime / Normal Attack / Grineer / 100,000 Health / 3,000 Armor Fully Stacked optimizer at 1.610498s, 1.1% slower than the captured Underframe list at 1.593232s. The exact legal one-mod neighborhood had 216 candidates and no improvement. Exhaustive two-mod review then found a coordinated move: remove Thermite Rounds R3 + Bladed Rounds R5, add Rime Rounds R3 + Vile Acceleration R5. This lowers modeled finite Expected TTK to 1.496829s (66,807.89 modeled DPS).

The cause was shortlist coverage. Vile Acceleration's `tempo-damage-tradeoff` family was absent from the incoming pair candidate order. After adding it, the incoming Rime + Vile pair's proxy-best outgoing slots still differed from the profitable Thermite + Bladed removal; the exact profitable slot choice ranked 96th. Pair refinement now keeps an alternate outgoing slot choice among the strongest incoming pairs and prioritizes distinct incoming/outgoing family signatures before additional elemental themes. A regression checks the selected pair, capacity/FORMA legality, and independently scored finite TTK.

The full pair universe examined 52,948 raw outgoing-pair × incoming-pair tuples and 17,726 legal pairs. Before the correction it found improvements including the move above; after correction the optimizer selects the 1.496829s build and a second exact pass found no improving pair in the same neighborhood. This only closes the fixed Braton target/state/pool pair neighborhood; it is not global optimizer optimality or gameplay accuracy.

State-matched comparison after the correction, using the same Catalyst / maximum three Forma / no Arcane constraints:

| State | Captured Underframe list | Tenno-Hub optimizer |
|---|---:|---:|
| Realistic | 2.197561s | 2.119475s |
| Fully Stacked | 1.593232s | 1.496829s |

Reproduce with:
```sh
npx tsx scripts/auditExpectedTtkPairSample.ts --worker --weapon="Braton Prime" --attack="Normal Attack" --samples=100000 --seed=20261172 --state=fullyStacked
npx tsx scripts/compareUnderframeBratonAutoBuild.ts --state=realistic
npx tsx scripts/compareUnderframeBratonAutoBuild.ts --state=fullyStacked
```

The exact pair-audit output reports 3,408.5ms optimizer time for this desktop Node run; this is one warm run, not browser Worker, cold-start, mobile, or tail-latency evidence. The full local optimizer file passes 181/181 tests in 1,218.90s, including the added regression; this local checkout also contains other uncommitted tests not included in PR #271. App and node TypeScript checks pass with per-project `--incremental --tsBuildInfoFile "$env:TEMP\\tenno-hub-*-check.tsbuildinfo" --noEmit` overrides. Standard `tsc -b` cannot write the shared `node_modules/.tmp/*.tsbuildinfo` paths in this checkout (EPERM). Production Vite build passes in 12.90s with the existing large-chunk warning; focused ESLint and feature-path `git diff --check` pass. Release checkpoint (2026-11-22): PR #271 squash-merged as `1fdad3d962ae24ed1a4f820cefc13ffbd4494f88`. Pages run [#351](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45045979792) completed the app build and Pages artifact upload, but deployment failed because GitHub's artifact lookup found zero artifacts. A rerun of the failed job uploaded a second `github-pages` artifact, after which the deploy action found two and failed. No source build failure occurred. Docs-only PR [#272](https://github.com/Appl3Tree/Tenno-Hub/pull/272) squash-merged as `2d1d8f28c31d2407d7c53db0d65930f9394da072`; fresh Pages run [#352](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45046794615) succeeded at 2026-11-22 17:00:28 UTC. Hosted production IAB at `version=2d1d8f2` verified the Braton Prime / Normal Attack / Grineer / custom 100,000 Health / 3,000 Armor / Fully Stacked setup with Catalyst and maximum three Forma. The optimizer returned Rime Rounds R3 + Vile Acceleration R5, 59/60 capacity, and three Forma; Why This Build showed 1.50s / 39 attacks / 66,807.9 modeled DPS, matching the exact audit's 1.496829s. No saved build changed; the supplied localhost preview remains stale at `version=2bf6faea`. PR #271's code diff is isolated to `buildOptimizerCore.ts`, `buildOptimizer.test.ts`, and `auditExpectedTtkPairSample.ts`.

## D3-MOD-DREADFUL-KILLSHOT-BURST-SNAPSHOT-001 — Basmu current-health snapshot (released in PR #287)

The current [Dreadful Killshot Wiki page](https://wiki.warframe.com/w/Dreadful_Killshot) describes a Basmu-exclusive Augment. At ranks 0–5, it grants +10/12/14/16/18/20% Weapon Damage and Status Chance for each 75 current Warframe Health, up to 360%. The total bonus rounds down to the nearest 20% and its Damage and Status Chance bonuses stack additively. The Wiki notes that health bonuses or damage taken can change the effect during play. Per the user's decision, the Mod Builder now has an editable current-Health snapshot, held constant for Burst scoring and Burst Auto Optimize. The selected rank's per-75 value is multiplied by whole 75-Health steps, rounded down to 20% increments, and capped at 360%. Current Health is normalized to a nonnegative integer. No health-buff or damage timeline is inferred.

The effect applies only to Basmu and contributes additively to weapon Damage and Status Chance in the selected-state/Burst calculation. Auto Optimize may consider Dreadful Killshot for the Burst objective. The saved planner config carries the health snapshot; the field, Math Trace, exported calculation notes, saved-build summary, and Why This Build disclose it. Scaling, sustained/stance DPS, direct finite TTK, Expected TTK, and five-second Avg DPS strip the snapshot. Those non-Burst objectives also exclude the mod from optimizer candidate generation so it cannot be selected with an inactive modeled effect.

The user separately chose to keep Amalgam Argonak Metal Auger's Dagger armor-strip effect excluded until the planner supports linked weapons. The catalog's current coverage audit flags that mod as partially parsed; no external Argonak assumption is applied to Dagger direct hits, status DoTs, or transferred/area damage.

The focused catalog/calculator/optimizer filter passes 5/5 across `weaponCatalog.test.ts`, `damageCalc.test.ts`, and `buildOptimizer.test.ts` using `npx vitest run --configLoader runner --maxWorkers=1 src/domain/__tests__/weaponCatalog.test.ts src/domain/logic/__tests__/damageCalc.test.ts src/domain/logic/__tests__/buildOptimizer.test.ts -t "Dreadful Killshot" --reporter=dot`. Separately, the complete catalog and damage-calculator test files pass 180/180; the Dreadful optimizer regression passes 1/1, including exclusion from Scaling and five-second Avg DPS. App TypeScript passes with `npx tsc --noEmit --project tsconfig.app.json --incremental false --pretty false`; source validation passes; the mod-effect audit reports 697 catalog weapons, 600 unique builder-eligible records, 496 records with parsed damage/performance effects, 68 conservative unmatched candidates, and zero weapon pools without a parsed damage effect. Focused ESLint and `git diff --check` pass. A 987-module production Vite build passes in 16.27s to `$env:TEMP\TennoHub-Dreadful-Build` with the existing large-chunk warning. The default `dist` output location failed with filesystem `EPERM`, so the successful build used the allowed temporary output directory. PR [#287](https://github.com/Appl3Tree/Tenno-Hub/pull/287) squash-merged as `c23eb62dbc9bea22c05bf04c6b39ccfcb038b3e3`; GitHub Pages run [#367](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45086971566) succeeded. Full repository suite and rendered UI verification remain open; the supplied localhost page was not rechecked, and this is sourced model behavior rather than live-game validation.

## D3-MECH-ATTACK-TRIGGER-CHARGED-PROFILES-001 — source-backed charged attack profiles (released in PR [#266](https://github.com/Appl3Tree/Tenno-Hub/pull/266), squash merge `e89c7e52ce935c7eb75bc071187f5f02d98fd941`)

Attack-specific Charge triggers and Wiki-listed per-shot ammo costs are now applied to Aeolak Alt-Fire/explosion (10), Quellor Alt-Fire (50), Stahlta Alt-Fire/AoE (20), and Tenora/Tenora Prime Charged Attack (10). Their charge times are 0.30s, 1.20s, 1.60s, and 0.80s respectively. Aeolak's page explicitly says Fire Rate mods do not shorten its 0.30s charge; its post-charge interval still scales with Fire Rate. Other profiles use the standard Fire Rate charge-time formula. The selected attack's rate tooltip now explains this distinction.

Aeolak and Stahlta Alt-Fire score their direct hit plus linked explosion against the directly struck target; Aeolak detonates on impact and Stahlta's explosion follows 0.36s later. Explosion-only rows direct users to the full attack row. Area coverage is not scored, and Stahlta's fuse assumes the target remains at the impact point. Quellor's charged direct hit now uses the Wiki-listed 100%→33.43% falloff from 9m to 18m, extended by Projectile Speed; the UI notes that spread/missed hits are not modeled. Tenora and Tenora Prime retain single-target charged-shot scoring.

Focused regressions: `npx vitest run src/domain/logic/__tests__/damageCalc.test.ts -t "source-backed per-attack Auto-Charge profiles|models Quellor Alt-Fire linear falloff|scores Aeolak and Stahlta single-target" --reporter=dot --configLoader runner` passes 3/3; `npx vitest run src/domain/logic/__tests__/buildOptimizer.test.ts -t "scores the verified charged attack rows in finite Expected TTK" --reporter=dot --configLoader runner` passes 1/1. App/test TypeScript, source validation, prerequisite audit (162 entries, no unresolved references/cycles), focused ESLint, and CRLF-aware `git diff --check` pass. `npm run build` cannot write shared `node_modules/.tmp/*.tsbuildinfo` (`EPERM`); `npx vite build --configLoader runner --outDir dist --emptyOutDir` succeeds in 10.61s with the existing large-chunk warning. The full suite was not run.

The source pages are [Aeolak](https://wiki.warframe.com/w/Aeolak), [Quellor](https://wiki.warframe.com/w/Quellor), [Stahlta](https://wiki.warframe.com/w/Stahlta), [Tenora](https://wiki.warframe.com/w/Tenora), [Tenora Prime](https://wiki.warframe.com/w/Tenora_Prime), and [Fire Rate](https://wiki.warframe.com/w/Fire_Rate). This is not a full trigger audit or gameplay validation. PR [#266](https://github.com/Appl3Tree/Tenno-Hub/pull/266) squash-merged as `e89c7e52ce935c7eb75bc071187f5f02d98fd941`; Pages run [#346](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45035189035) succeeded. Hosted IAB at `version=e89c7e5` verified Aeolak's `Alt-Fire 0.3 s charge`, the direct-plus-on-impact explosion note and Math Trace's uncharged start; Quellor's `Alt-Fire 1.2 s charge` and `100%→33.43%` falloff note; and Stahlta's `Alt-Fire 1.6 s charge`, 0.36s fuse assumption, and excluded nearby targets. The Stahlta note rendered without clipping at 1280×720. The supplied localhost page remains stale at `2bf6faea`.

## D3-OPT-RANK-OWNED-FIVE-SLOT-ORACLE-001 — seeded R1-owned five-slot Expected TTK oracle (2026-11-22; released in PR [#264](https://github.com/Appl3Tree/Tenno-Hub/pull/264), squash merge `62caa31492ca6544a847d7249882aef8b3ef708f`)

Seed `20261136` randomly selects five fully modeled, mutually compatible damage mods and one supported attack from each Braton Prime / Grineer, Lex Prime / shielded Corpus, Cedo / Grineer, and Broken War / Infested pool. Each sampled mod is capped at owned Rank 1, and the oracle enumerates every legal ordered subset and rank tuple (0–1) through five slots. Builds use a Catalyst, weapon-default polarities, and alternating zero/one-Forma budgets. The score is finite Expected TTK; Exilus and Arcane selection are disabled. The sampled target profiles are 70,000 Health / 2,400 Armor (Braton), 36,000 Health + 44,000 Shields (Lex), 140,000 Health / 1,800 Armor (Cedo), and 95,000 Health / 300 Armor (Broken War).

All four optimizer outputs match the exhaustive sampled-pool Expected TTK, time, and DPS winners. Each result remains capacity-legal and within its owned R1 cap and Forma budget. The focused test passes 1/1 in 173.51s. Test-project TypeScript, focused ESLint, and `git diff --check` pass. The full suite was not run; this test-only change has no production build or deployment.

A preliminary uncatalyzed fixture could place only four mods and was discarded. The broader R1–R3 five-slot search was stopped at 10 minutes, and an R1–R2 version was stopped at five minutes. The final R1 cap kept this regression bounded at the time. Later PR #332 adds R1–R3 five-slot finite-TTK evidence across four selected fixtures; broader and fixed-window search remain open.

Reproduce with:

```sh
npx vitest run --maxWorkers=1 src/domain/logic/__tests__/buildOptimizer.test.ts -t "seeded five-mod, five-slot R1-owned Expected TTK" --reporter=dot --configLoader runner
```

PR [#264](https://github.com/Appl3Tree/Tenno-Hub/pull/264) squash-merged as `62caa31492ca6544a847d7249882aef8b3ef708f`; GitHub reported no status checks or PR-triggered workflow runs. This is four randomized sampled pools, not full-catalog optimization, exhaustive high-rank search, joint Arcane search, Underframe parity, or gameplay validation.

## D3-MOD-MOTUS-SETUP-ACTIVE-SNAPSHOT-001 — allow the explicitly active conditional in Auto Optimize (2026-11-22; released in PR [#259](https://github.com/Appl3Tree/Tenno-Hub/pull/259), squash merge `fcc04cd22a01bb1390383b999a4cf7f6ed81d9d7`)

The catalog already parsed Motus Setup's rank values as +25/+50/+75/+100% Critical Chance and Status Chance, with 1/2/3/4s duration after a Double or Bullet Jump. The current [Motus Setup Wiki page](https://wiki.warframe.com/w/Motus_Setup) says another jump refreshes the duration. The damage calculator already kept the buff inactive for Initial/Realistic states and allowed Fully Stacked/Custom to represent a static active snapshot. However, the global mod-effect coverage guard still marked its jump-landing condition unsupported, excluding it from Auto Optimize in every state. That blanket exclusion is removed: optimization can now compare the saved condition snapshot, while the UI assumption explains that jump activation, expiry, and refresh timing are not simulated. This does not infer realistic uptime or claim finite-sequence buff uptime.

The optimizer regression confirms that the Realistic baseline does not select Motus Setup and a Fully Stacked state can select it when beneficial. Existing calculator coverage continues to verify its ranks, durations, and active/inactive snapshots.

The hosted check at `version=fcc04cd` confirms the released picker and active-state display. Full-catalog Auto Optimize selected four other mods, so it does not establish that Motus wins a broad candidate pool. No saved build was changed.

Focused reproduction:

```sh
npx vitest run --maxWorkers=1 src/domain/logic/__tests__/buildOptimizer.test.ts src/domain/logic/__tests__/damageCalc.test.ts -t "Motus Setup|static jump-landing" --reporter=dot --configLoader runner
```

The focused run passes 2/2. App, test, and node TypeScript checks; `npm run validate:sources`; focused ESLint; `npx tsx scripts/auditModEffectCoverage.ts`; and `git diff --check` pass. The audit reports 67 review candidates, including 17 partially parsed and 50 fully unparsed records, with zero weapon pools lacking a parsed damage effect. `npm run build` could not write shared `node_modules/.tmp/*.tsbuildinfo` files (`EPERM`); a production Vite bundle using the imported project config and OS-temp output completed in 10.34s, with the existing large-chunk warning. The full suite was not run. Local current-source visual QA remains unavailable: the supplied IAB page is stale at `2bf6faea`, and the port-4189 preview timed out. Hosted production IAB at `https://appl3tree.github.io/Tenno-Hub/?version=fcc04cd` verified the Motus picker without the unsupported-effect warning; manually selecting rank 3 in Fully Stacked changed Critical Chance from 22% to 44% and Status Chance from 28% to 56%. Full-catalog Auto Optimize selected four other mods, so this is not a broad-pool Motus selection result. The check used only an ephemeral build; no saved build changed. GitHub reported no Pages/workflow run.

Changed files: `src/domain/catalog/modEffectUtils.ts`, `src/domain/logic/damageRuleset.ts`, the corresponding `buildOptimizer` and `damageCalc` test files, and the three continuation documents. This removes only the false global exclusion for a condition the planner can explicitly snapshot. Reopen if source evidence changes the activation/refresh rule, or if the UI lets an inactive Initial/Realistic state receive this conditional unintentionally. PR [#259](https://github.com/Appl3Tree/Tenno-Hub/pull/259) squash-merged as `fcc04cd22a01bb1390383b999a4cf7f6ed81d9d7`; GitHub reported no status checks or PR-triggered workflow runs.

# Build Planner Optimizer Benchmark

## D3-MECH-BATTACOR-MORGHA-TRIGGERS-001 — source-backed trigger profiles (2026-11-22; bounded; released in PR [#257](https://github.com/Appl3Tree/Tenno-Hub/pull/257), squash merge `4103392dd9abab3db476e7d22eb3c51c2d7d18d6`)

Current [Battacor](https://wiki.warframe.com/w/Battacor) data lists the primary as a fully automatic two-round burst with a 2.5 trigger-pull rate and 0.08s between rounds. WFCD supplies a combined weapon-level Auto-Burst / Charge label to the individual rows, so the catalog now gives Normal Attack explicit Burst timing. The resulting base effective projectile rate is `2 / (1 / 2.5 + 0.08)` (4.1667/s), with Fire Rate scaling both the burst cycle and intra-burst delay.

Battacor Alt-Fire is an Auto-Charge shot with a 0.4s charge time, but the Wiki says it consumes one to three charges earned through primary-fire kills and damage scales with the stored charge count. Since the finite model has no cross-mode kill/charge history, both direct and explosion rows preserve the Charge trigger and charge-time metadata for reference, then block damage scoring and Auto Optimize with a source-linked explanation. This prevents a single Alt-Fire shot from being modeled as freely repeatable at a fixed, unstated charge count.

The current [Morgha](https://wiki.warframe.com/w/Morgha) table lists its launcher attack as a two-round Auto-Burst and its Charged Shot rows as Semi-Auto at 0.83 attacks/s. The generated weapon-level Auto-Burst label was incorrectly inherited by those charged rows; they now use the Semi trigger with their listed rate, while the launcher burst rows retain their existing two-round timing.

Focused reproduction:

```sh
npx vitest run src/domain/logic/__tests__/buildOptimizer.test.ts -t "covers instantaneous, simultaneous, and attack-specific burst modes|uses Wiki Auto-Burst, Auto-Charge, and Semi-Auto triggers for Battacor and Morgha" --reporter=dot --configLoader runner
```

The focused burst group passes 3/3. `npx tsc -p tsconfig.test.json --noEmit --pretty false`, `npx tsc -p tsconfig.app.json --noEmit --incremental false --pretty false`, `npm run validate:sources`, focused ESLint, and `git -c core.whitespace=cr-at-eol diff --check` pass. The standard `npx tsc -b` could not write the configured build-info cache under shared `node_modules/.tmp` (`EPERM`); the non-incremental app TypeScript check passed. Vite's CLI config loader also hit `.vite-temp` `EPERM`, but the production bundle completed in 10.44s after importing the same config programmatically. The full test suite was not run. The supplied IAB URL still served stale `2bf6faea`; the current-branch port-5173 preview timed out, so the new note was not visually verified. GitHub reported no status checks or PR-triggered workflow runs for the merge; deployment was not independently verified.

This closes only the identified Battacor and Morgha trigger-label errors. Other attack-specific charge, spool, burst, duplex, held, and active-trigger sequences remain subject to source audit; the open trigger checklist is not complete. References: [Battacor](https://wiki.warframe.com/w/Battacor), [Morgha](https://wiki.warframe.com/w/Morgha), [Fire Rate](https://wiki.warframe.com/w/Fire_Rate).

## D3-OPT-MAUSOLON-DUAL-PROFILE-WINDOW-ORACLE-001 — seeded profile-specific fixed-window oracle (2026-11-22; released in PR #252)

Implementation commit: 011a81b1; PR #252 squash-merged as e6ff7b20304ae075411cbe35f5350f4c0fa56421. GitHub reported no status checks or PR-triggered workflows; no deployment applies.

The four-weapon six-mod/four-slot `5s Avg DPS` oracle covers Primary, Secondary, Shotgun, and Melee, while existing Mausolon checks cover linked damage and profile range boundaries but not an exact sampled-pool optimizer oracle for both selectable Arch-Gun profiles. Seed `20261131` draws one shared six-mod sample that is fully modeled and compatible with both Mausolon profiles: Magazine Extension R5, Primed Deadly Efficiency R10, Primed Rubedo-Lined Barrel R10, Rubedo-Lined Barrel R5, Critical Focus R5, and Hollowed Bullets R3.

Both profiles use Auto at 250m against a synthetic Grineer profile with 10,000,000 Health and 3,000 Armor in Realistic state over `[0,5s)`. This distance is inside the Atmosphere Auto 300m cap and below the Archwing Auto falloff start; it does not test the conflicting Archwing 300m limit. The search uses a Catalyst, four main slots, default polarities, max-ranked sampled mods, no Arcane/Exilus, and zero Forma for Archwing versus up to one for Atmosphere. The independent scorer enumerates legal ordered sampled subsets and ranks; it finds 347 legal loadouts in each profile. Both optimizer results match the exact sampled-pool winner, and each uses zero Forma.

| Profile / Auto | Winning sampled build | Exact 5s Avg DPS | Applied damage in `[0,5s)` | Legal sampled loadouts |
| --- | --- | ---: | ---: | ---: |
| Mausolon (Archwing) | Primed Rubedo-Lined Barrel R10, Hollowed Bullets R3, Critical Focus R5, Primed Deadly Efficiency R10 | 3,950.6734 | 19,753.3672 | 347 |
| Mausolon (Atmosphere) | Primed Rubedo-Lined Barrel R10, Critical Focus R5, Hollowed Bullets R3, Primed Deadly Efficiency R10 | 5,925.9509 | 29,629.7547 | 347 |

The Atmosphere result is 1.5× the Archwing result with the same sampled mods, consistent with the two sourced Auto damage profiles in this fixture. Focused test passes 1/1 (0.90s Vitest time); the full test TypeScript project, focused ESLint, and `git diff --check` pass. The full test suite was not rerun. This is model-local sampled-pool evidence, not full-catalog/global optimization, a resolution of the Archwing range conflict, Underframe parity, or live-game validation. Reopen on a reproducible exact-oracle mismatch, changed profile data, or new source/gameplay evidence.

## D3-MOD-ARGONAK-DAGGER-ARMOR-001 — cross-weapon armor-strip boundary (scope resolved by exclusion)

The generated mod inventory marks Amalgam Argonak Metal Auger as Argonak-compatible, and the raw upgrade type is `WEAPON_MELEE_ARMOR_REDUCTION`. Official [Warframe Update 25.0.8](https://www.warframe.com/en/patch-notes/switch/25-0-8) lists armor reduction from Dagger damage. The current [WARFRAME Wiki mod page](https://wiki.warframe.com/w/Amalgam_Argonak_Metal_Auger) gives rank 0–5 values of 1–6 base Armor removed per qualifying Dagger damage event, describes additive stacking like Shattering Impact, and says Dagger damage/status events can trigger the reduction. Electricity chains, Gas clouds, Blast AoE, and transferred Melee Influence damage may also trigger it; lingering Gas ticks after the enemy dies do not. The Wiki [Armor page](https://wiki.warframe.com/w/Armor) classifies the reduction as base Armor.

The mod is equipped on Argonak while the effect benefits a separate Dagger build. The current planner scores one weapon at a time and has no saved cross-weapon loadout state. The user chose to keep the effect excluded until linked-weapon support exists. No external Argonak/rank assumption or Dagger scoring benefit is modeled; the unsupported effect remains outside Auto Optimize.

Reopen only when the planner supports saved linked-weapon assumptions or new source/gameplay evidence changes the eligibility boundary. At that point, validate rank scaling, Dagger-only eligibility, additive interaction with Shattering Impact, status-damage ticks, and supported transfer triggers while keeping unscored multi-target coverage explicit.
## D3-TEST-TS-CLEANUP-001 — test-project TypeScript diagnostics cleared (2026-11-22)

The test TypeScript project had 57 diagnostics across eight test files. `tsconfig.test.json` now includes the already-installed Node types; registry tests explicitly use string-keyed maps/sets and normalize branded source IDs; test fixtures now satisfy complete public shapes; and stale properties, goal aliases, and widened literals use the APIs' actual types. Two direct-hit per-status optimizer tests also now use a valid nested 200-damage weapon fixture instead of silently passing ignored top-level `impact` / `heat` fields.

Validation: `npx tsc -p tsconfig.test.json --noEmit --pretty false` exits successfully with no diagnostics. Focused Vitest checks pass 56/56 across six files (4 optimizer, 2 damage calculator, and 50 prerequisite/quest/source/AlecaFrame cases), ESLint passes across the six edited test files, and `git diff --check` passes. Production code and the full optimizer search behavior are unchanged; the full repository test suite was not rerun. This is type-check coverage and targeted regression evidence, not a full-suite or gameplay-accuracy claim.

PR [#185](https://github.com/Appl3Tree/Tenno-Hub/pull/185) merged these local changes as `d90c0aedcee3d0c8fd50da9ad041bb0f83963986` on 2026-11-21. The GitHub connector returned no combined checks or PR-triggered workflow runs for that merge commit; Pages deployment and production availability are not independently verified. The current-branch IAB preview timed out, while port 80 served an older build, so rendered QA for this scoring-only change remains unverified.

## D3-MOD-THERMAGNETIC-SHELLS-SCORE-BOUNDARY-001 — corrected identity and source boundary (2026-11-22; released, hosted IAB verified)

The Thermagnetic Shells Wiki page identifies the mod and its Detron, Mara Detron, and Tenet Detron compatibility. Its four ranks provide 20/40/60/80 flat Magnetic damage, 10/20/30/40% of the triggering enemy's max Health as Blast damage, and rank-specific 1.5/3/4.5/6m radii. The notes specify linear 100%-to-0% falloff and line of sight. Hotfix 44.1.3 prevents Elemental Ammo status effects from recursively retriggering death explosions while retaining their damage/status benefit.

The 2026-11-16 checkpoint correctly recorded the rank-scaled radius but missed the import identity. The 2026-11-22 correction found the identity /Lotus/Upgrades/Mods/Rifle/Event/CorpusArena/SupraCorpusArenaMod and confirmed all three compatible weapons, but incorrectly repeated the generated description's 6m max-rank radius for every rank. The Wiki rank table is followed by the new implementation. The previous app displayed a warning and excluded the effect because on-kill area damage, adjacent-target deaths, and mission-specific max-Health scaling were not modeled.

The original rank/source/compatibility and Auto Optimize exclusion regressions passed, along with focused ESLint and production build. PR #244 shipped that boundary. Pages run #324 failed deployment after build/upload (artifact lookup saw zero then duplicate artifacts); docs-only PR #245 triggered successful run #325. Hosted IAB on version=1441ed1 verified the warning and optimizer exclusion. These historical checks do not validate the later bounded score model.

## D3-OPT-EXPECTED-TTK-REMOVAL-001 — bounded single-mod removal refinement and ranked oracle (2026-11-22; released)

A bounded exhaustive test found a finite Expected TTK miss on Cedo / Alt-Fire Glaive against Grineer (155,000 Health / 1,800 Armor), Realistic state, three uncatalyzed rank-10 slots, up to one Forma, 1,500 Warframe Armor, and 1,000 maximum Energy at 50%. The sampled pool is Contagious Spread R0–R1, Incendiary Coat R0–R1, Shredder R0–R1, and Blaze R0–R2. The optimizer's pre-fix build retained rank-zero Shredder and scored 145s; exact scoring of the legal removal proposal produces Blaze R2 + Incendiary Coat R1 with Primary Bulwark R5 at 142s. The change proposes legal one-mod removals during finite-encounter refinement with a separate allowance of up to eight exact scores beyond the existing add/replace cap of 40 (44 for fixed-window). Proposal capacity, slot assignment, and Forma accounting use the existing legality helpers.

The focused Cedo regression passes 1/1 in 8.88s. A second seeded oracle (seed `20261126`) samples four compatible, fully scoreable Lex Prime damage mods, varies owned rank caps through R1–R2, and exhaustively compares legal ordered subsets/rank tuples through three slots under uncatalyzed rank-10 capacity and up to one Forma. It passes 1/1 in 2.52s with an empty Arcane slot; it checks the sampled three-mod/rank neighborhood, not the Arcane dimension. An initial two-fixture exhaustive oracle with every compatible Arcane rank took 579s and exposed the Cedo removal miss. Because that broad run was expensive, coverage was split into the targeted Cedo regression and this smaller seeded ranked oracle. This does not add multi-fixture joint Arcane/FORMA oracle evidence.

The first removal implementation tried to stay within the existing add/replace candidate cap by evicting the last replacement proposals. The complete optimizer file then reported four regressions (166 passed, 4 failed, 883.02s), including established melee slot-family, Braton fire-rate, Cedo elemental, and Laetum critical neighborhoods. The fix now leaves that shortlist intact and gives removal alternatives a separate allowance of up to eight exact scores per pass (up to 48 total Expected TTK proposals; fixed-window has its existing four extra add/replace candidates, for up to 52). The four existing cases and both new regressions pass together (6/6, 32.94s); the complete optimizer file passes 170/170 in 867.14s after the correction. Focused ESLint, `npx tsc -b`, `git diff --check`, and a production Vite build with output redirected to system temp pass. The ordinary build command reached Vite but the sandbox denied creation of `dist` inside this registered worktree; the source build itself completed successfully with the temp output. The standard large-chunk warning remains.

Reproduce the focused checks with:

```sh
npx vitest run --maxWorkers=1 src/domain/logic/__tests__/buildOptimizer.test.ts -t "drops a rank-zero Cedo mod when its removal improves finite Expected TTK" --reporter=dot
npx vitest run --maxWorkers=1 src/domain/logic/__tests__/buildOptimizer.test.ts -t "matches a seeded four-mod, three-slot ranked Expected TTK oracle with an empty Arcane slot" --reporter=dot
```

PR [#235](https://github.com/Appl3Tree/Tenno-Hub/pull/235) squash-merged as `f4cefa9cd9725404d47d1fb6cc1f08335584a08b`; Pages deployment [run #315](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/44986057689) succeeded. The hosted IAB at `version=f4cefa9` shows “Why This Build” explaining that finite refinement tests bounded one-mod additions/replacements and removals, followed by a bounded two-mod search and explicit model limitations. Resetting the transient Braton test build returned the planner to 0/30 capacity; no saved build was modified. This validates the deployed explanation and workflow, not optimizer parity with Underframe or gameplay behavior.

The release and hosted explanation check are complete. These fixtures establish a reproducible model-local removal correction and one small ranked sample, not full-catalog optimality, broad Arcane/Forma search, Underframe parity, stochastic history, or gameplay accuracy.

## D3-OPT-EXPECTED-TTK-POST-REMOVAL-CORPUS-001 — seeded post-fix neighborhood audit (2026-11-22; bounded)

After PR #235, `npx tsx scripts/auditExpectedTtkCorpus.ts --seed=20261127` ran the eight fixed anchors and four seed-selected fixtures against Grineer / 100,000 Health / 3,000 Armor, Realistic state, eight standard slots, Catalyst, MR 30, up to three Forma, no Exilus or Arcane optimization. The independent scorer enumerated legal one-mod additions, removals, and replacements from each optimizer result and exact-scored 3,890 candidates total; no fixture had an improving neighbor.

| Weapon / attack | Selection | Optimizer and best-neighbor Expected TTK | Legal neighbors | One-case harness wall time |
| --- | --- | ---: | ---: | ---: |
| Braton Prime / Normal Attack | fixed | 2.1195s | 234 | 27.16s |
| Cedo / Normal Attack | fixed | 2.9840s | 412 | 10.72s |
| Laetum / Normal Attack | fixed | 1.8000s | 276 | 9.11s |
| Soma Prime / Fully Spooled | fixed | 1.7542s | 420 | 29.22s |
| Broken War / Normal Attack | fixed | 8.8065s | 351 | 8.56s |
| Kuva Nukor / Normal Attack | fixed | 1.4400s | 359 | 42.59s |
| Nataruk / Perfect Shot | fixed | 2.0000s | 396 | 7.14s |
| Torid / Grenade Impact | fixed | 4.7544s | 238 | 17.58s |
| Acceltra Prime / Rocket Explosion | seeded | 1.3158s | 385 | 8.22s |
| Corvas Prime / Charged Shot | seeded | 1.5625s | 196 | 5.20s |
| Helstrum / Explosion | seeded | 52.0000s | 317 | 7.62s |
| Arca Titron / Heavy Slam Attack | seeded | 1.5592s | 306 | 7.08s |

The one-case harness wall-time median is 8.84s and maximum 42.59s (Kuva Nukor). The script starts a separate Node process per fixture, so this duration includes subprocess startup and is not an isolated optimizer measurement; it is not Worker or browser latency evidence. The seeded four include explosive primary, Archgun, Companion weapon, and heavy melee categories. This demonstrates bounded one-mod local stability across varied weapon families, not pair/global optimality, Arcane joint optimality, Underframe parity, or gameplay accuracy.

Reproduce with `npx tsx scripts/auditExpectedTtkCorpus.ts --seed=20261127`.

## D3-OPT-EXPECTED-TTK-POST-REMOVAL-PAIR-SAMPLE-001 — seeded two-mod audit (2026-11-22; bounded)

Using the same 12 fixtures and Grineer / 100,000 Health / 3,000 Armor / Realistic / eight-slot / Catalyst / MR 30 / up-to-three-Forma assumptions, `npx tsx scripts/auditExpectedTtkPairSample.ts --seed=20261127 --samples=1024` sampled 1,024 legal maximum-rank two-mod replacements per fixture. The deterministic sampler examined 24,987 raw outgoing-pair × incoming-pair tuples and exact-scored 12,288 legal moves; no sampled pair improved the optimizer result.

| Weapon / attack | Optimizer baseline TTK | Best sampled TTK | Raw tuples examined | Legal pair samples |
| --- | ---: | ---: | ---: | ---: |
| Braton Prime / Normal Attack | 2.1195s | 2.4618s | 2,990 | 1,024 |
| Cedo / Normal Attack | 2.9840s | 3.2060s | 1,594 | 1,024 |
| Laetum / Normal Attack | 1.8000s | 2.0000s | 2,415 | 1,024 |
| Soma Prime / Fully Spooled | 1.7542s | 2.1927s | 1,541 | 1,024 |
| Broken War / Normal Attack | 8.8065s | 9.6774s | 1,908 | 1,024 |
| Kuva Nukor / Normal Attack | 1.4400s | 1.7143s | 1,762 | 1,024 |
| Nataruk / Perfect Shot | 2.0000s | 2.0000s | 1,594 | 1,024 |
| Torid / Grenade Impact | 4.7544s | 5.0000s | 3,109 | 1,024 |
| Acceltra Prime / Rocket Explosion | 1.3158s | 1.3684s | 1,682 | 1,024 |
| Corvas Prime / Charged Shot | 1.5625s | 1.5625s | 2,204 | 1,024 |
| Helstrum / Explosion | 52.0000s | 59.0000s | 2,084 | 1,024 |
| Arca Titron / Heavy Slam Attack | 1.5592s | 1.7053s | 2,104 | 1,024 |

The sample is without replacement over legal outgoing-pair × incoming-full-catalog-pair tuples, with incompatible or illegal proposals rejected. The reported best sampled time may tie the baseline within the scorer's improvement tolerance; the runner found zero improvements in all fixtures. This complements the exact one-mod audit but does not exhaust the pair neighborhoods or prove global, Arcane-joint, Underframe, or gameplay optimality.

Reproduce with `npx tsx scripts/auditExpectedTtkPairSample.ts --seed=20261127 --samples=1024`.

## D3-OPT-EXPECTED-TTK-REMOVAL-IAB-LATENCY-001 — hosted Worker repeatability sample (2026-11-22; bounded)

On the deployed planner at [`version=f4cefa9`](https://appl3tree.github.io/Tenno-Hub/?probe=removal-review-20261122&version=f4cefa9), three clean IAB runs used Kuva Nukor / Normal Attack, Expected TTK, Grineer damage modifiers, custom current-level target pools of 100,000 Health / 3,000 Armor, Realistic state, eight standard slots, Catalyst enabled, MR 30, up to three Forma, and Exilus/Arcane optimization disabled. Each click-to-result run returned the same legal 60/60 build with three Forma and 1.93s modeled Expected TTK (51,785.7 modeled damage/s): Pistol Pestilence R3, Convulsion R5, Anemic Agility R5, Magnetic Might R3, Accelerated Isotope R3, Lethal Torrent R5, Galvanized Diffusion R10, and Galvanized Shot R10.

The three click-to-result readings were 8.9s, 8.2s, and 8.3s. “Why This Build” visibly disclosed the bounded finite-search stages, including up to eight single-mod removals per pass. This is a three-repeat, same-tab IAB sample on one environment, not cold-start, p95, mobile, or population-tail latency evidence. The transient test build was reset to Braton Prime at 0/30 uncatalyzed capacity, MR 0, with Balanced synthetic target and temporary options cleared; no saved build was changed.

## D3-OPT-JOINT-ARCANE-FULLPOOL-001 — coordinated mod/Arcane finite Expected TTK refinement (2026-11-21; PR #199 merged)

The exact full-pool audit exposed a coordination miss on Braton Prime / Normal Attack against Grineer (100,000 Health / 3,000 Armor), Realistic state, two slots, zero Forma, 1,500 Warframe Armor, and 1,000 maximum Energy at 100%. Before the change, the optimizer selected Thermite Rounds + Heavy Caliber with Primary Overcharge R5 at 20.703236s / 4,830.16 DPS. Exact joint scoring found Thermite Rounds + Galvanized Chamber with Primary Bulwark R5 at 17.005950s / 5,880.29 DPS, a 17.9% lower modeled Expected TTK.

The finite-encounter refinement now evaluates bounded legal mod proposals with proposal-specific Arcane effects. Most Arcane pools use a fast estimate on up to eight varied proposals per pass. With at most two candidate Arcanes and no pre-equipped effects, up to twelve proposals use exact finite-encounter Arcane selection; small mod/Arcane candidate pools use exact selection throughout their shortlist. When pre-equipped effects are present, repeated path searches use a two-proposal proxy cap. Each candidate is compared under both its proposal Arcane and the pass's current Arcane. Two-mod proposals are screened when a proposal-specific Arcane produces an exact improvement or the single-mod shortlist stalls. The selected Arcane is rechecked against the returned list. The Mod Builder explanation describes this bounded search and its final Arcane recheck.

The focused regression exhaustively checks all legal two-slot ordered builds from Thermite Rounds, Heavy Caliber, and Galvanized Chamber against every modeled rank of all compatible Braton Arcanes. The optimizer returns Galvanized Chamber with Primary Bulwark and matches the exact Expected TTK winner. Five focused regressions pass, covering this coordination case, the pre-existing tempo tradeoff, a small exhaustive joint mod/Arcane oracle, the catalog-backed Braton fixed-window neighborhood, and the 82-path Laetum Incarnon search.

Final full-pool validation uses 62 eligible mods, 14 compatible Arcanes, 84 modeled Arcane ranks, and the exact legal max-rank one-mod add/remove/replacement neighborhood around the returned two-slot build. The audit exact-scores 121 neighbors / 10,370 Arcane variants; none improves the 17.005950s baseline. One in-process optimizer run took 6,069.9ms after adding the pre-equipped-effect runtime guard. Local validation passes: serial suite 833/833 tests across 54 files in 468.45s; production build; focused ESLint; and `git diff --check`. PR [#199](https://github.com/Appl3Tree/Tenno-Hub/pull/199) squash-merged as `f2a734963f9510e8e1976d261a12aacee6941164`. GitHub reported no status checks or PR-triggered workflow runs for the merge commit, so Pages deployment is not independently verified. The in-app browser timed out connecting to the local Vite preview, so rendered explanation QA is unverified. This is a single bounded local-model fixture, not exhaustive full-catalog mod/Arcane search, multiple-mod global optimality, Underframe objective parity, random encounter-history validation, or live-game accuracy.

Reproduce the joint full-pool audit with:

```sh
npx tsx scripts/auditExpectedTtkFullPool.ts --weapon="Braton Prime" --attack="Normal Attack" --slots=2 --forma=0 --state=realistic --health=100000 --armor=3000 --warframe-armor=1500 --warframe-max-energy=1000 --warframe-energy-percent=100 --joint-arcane=true
```

## D3-OPT-JOINT-ARCANE-FULLPOOL-3SLOT-001 — three-slot full-catalog joint Arcane neighborhood (2026-11-21; PR #203 merged)

The released Braton Prime / Normal Attack / Grineer / Realistic / 100,000 Health / 3,000 Armor / zero-Forma joint-Arcane audit was repeated with three slots, 1,500 Warframe Armor, and 1,000 maximum Energy at 100%. The optimizer selected Malignant Force R3 + Primed Cryo Rounds R10 + Wildfire R3 with Primary Bulwark R5 at 8.9770355s / 11,139.53 modeled DPS. The optimizer search took 5,888.4ms.

The full pool contains 106 proposals, of which 62 are eligible after the existing PvE/source/effect gates; 14 compatible Arcanes expose 84 modeled ranks. The exact one-mod add/remove/replacement audit found 178 legal neighbors and scored 15,215 Arcane variants. None improved the optimizer build; the best neighbor is the baseline itself. This extends the two-slot full-pool result from 121 neighbors / 10,370 Arcane scores to three slots. The roughly 15-minute end-to-end audit is a single local desktop observation. PR [#203](https://github.com/Appl3Tree/Tenno-Hub/pull/203) squash-merged as `7afcf2b3f7e57bf694b0b67f2e6a86848038aa59`; GitHub reported no status checks and the change does not alter the app bundle. These results establish no improving one-mod move for this one finite-model fixture, not joint two-plus-mod optimality, global search quality, Underframe objective/simulator parity, Forma optimization, or live-game accuracy.

Reproduce with:

```sh
npx tsx scripts/auditExpectedTtkFullPool.ts --weapon="Braton Prime" --attack="Normal Attack" --slots=3 --forma=0 --state=realistic --health=100000 --armor=3000 --warframe-armor=1500 --warframe-max-energy=1000 --warframe-energy-percent=100 --joint-arcane=true
```

## D3-OPT-JOINT-ARCANE-3SLOT-ORACLE-001 — seeded three-slot mod/Arcane oracle (2026-11-21; PR #201 merged)

The new seed `20261122` broadens the joint mod/Arcane oracle from four sampled mods / two slots to five sampled mods / up to three slots in four fixtures: Braton Prime / Grineer / Realistic; Lex Prime / shielded Corpus / Initial; Cedo / armored Grineer / Realistic; and Broken War / Infested / Initial. Each fixture samples a supported attack and five max-rank damage mods from that weapon's full compatible catalog. Candidate eligibility and unsupported effects are filtered using the same source/effect gates as the existing eight-case oracle. The exhaustive scorer enumerates every legal subset up to three slots under the three native slot polarities and scores each with every modeled rank of each compatible Arcane, including the no-Arcane option. Warframe Armor is 1,500 in every case; current Energy varies from 50% to 100%, with target Health/Shields/Armor and faction/state varying by fixture.

All four optimizer outputs are capacity-legal and match the exhaustive winner under the exact Expected TTK ranking. The focused Vitest run passes in 173.22s (177.72s process duration); the full serial suite passes 834/834 tests across 54 files in 625.62s, including this test. Focused ESLint and `git diff --check` pass. A separate `tsc -p tsconfig.test.json --noEmit` attempt fails on pre-existing test typing errors in other test code and earlier lines of `buildOptimizer.test.ts`; it reports no diagnostics in the added three-slot test block. No application source changed, so a production build was not rerun. PR [#201](https://github.com/Appl3Tree/Tenno-Hub/pull/201) squash-merged as `9a5183edd1dc98aa48bb63f20687800069f77e4`; GitHub reports no status checks, and a Pages deployment does not apply to this test/docs-only change. This is an exhaustive search over each sampled five-mod pool, not the weapon's full mod catalog, rank variants, Forma configurations, global multi-mod neighborhood, Underframe's private scorer, or live gameplay.

The regression is in `src/domain/logic/__tests__/buildOptimizer.test.ts` under `matches seeded exhaustive three-slot mod-and-Arcane optima across weapon classes`.

## D3-OPT-RANK-FORMA-WINDOWDPS-ORACLE-001 — seeded rank-limited mod/Arcane oracle (2026-11-21; PR #209 merged)

Seed `20261124` broadens the fixed-window joint oracle to include owned-rank and capacity constraints. Four fixtures reuse Braton Prime / Primary / Grineer, Lex Prime / Secondary / shielded Corpus, Cedo / Shotgun / Grineer, and Broken War / Melee / Infested, each with a randomly selected supported attack and three randomly selected compatible damage mods. Each sampled mod receives an owned maximum-rank cap between R1 and R3, and the exhaustive scorer considers every rank from R0 through that cap. The two main slots use an uncatalyzed rank-10 weapon capacity; alternating fixtures permit zero or one Forma. For each legal ordered loadout/rank tuple, the scorer compares the no-Arcane case and every modeled compatible Arcane rank against the fixed five-second applied-damage objective.

All four optimizer results match the exact sampled-pool winner, report the same score, and remain capacity/FORMA-legal. The focused test passes 1/1 in 9.39s; the complete optimizer test file passes 161/161 in 545.08s. Focused ESLint and `git diff --check` pass. `tsconfig.test.json` still fails on 52 existing diagnostics elsewhere in the test sources, with no diagnostics in the new block. PR [#209](https://github.com/Appl3Tree/Tenno-Hub/pull/209) was squash-merged as `5679a3294e83c28c1997ad7cb9278cea9500d339`; GitHub reported no statuses or PR-triggered workflows. This is a test/docs-only change, so the application build and full suite were not rerun. The bounded sample does not search the full mod catalog/rank space, exhaustive multi-Forma combinations, global joint neighborhoods, Underframe's private simulator, or live gameplay.

Reproduce the focused test with:

```sh
npx vitest run src/domain/logic/__tests__/buildOptimizer.test.ts -t "seeded rank-limited joint mod, Arcane, and one-Forma" --reporter=dot
```

## D3-OPT-JOINT-ARCANE-SEEDED-ORACLE-001 — seeded joint mod/Arcane sample (2026-11-21; PR #196 merged)

`src/domain/logic/__tests__/buildOptimizer.test.ts` now adds seed `20261121` to the joint Expected TTK oracle. Eight fixtures span Primary, Secondary, Shotgun, and Melee weapons against Grineer, Corpus, and Infested target pools, with initial, realistic, and fully stacked states; target Health/Shields/Armor; Warframe Armor; and current Energy vary by case. Each case deterministically selects a supported attack profile and draws four max-rank mods from that weapon's full compatible catalog. The oracle exhaustively scores every legal ordered subset of up to two slots with every modeled rank of every compatible Arcane. The optimizer must match the exact finite-encounter TTK and return a capacity-legal build.

PR [#196](https://github.com/Appl3Tree/Tenno-Hub/pull/196) was squash-merged as `7c7b81ff50d2f7cd10902fa2d8d6c1515ae74daf`. The focused seeded test passes all eight cases (one test, 113.15s test time). The serial full suite passes 832/832 across 54 files in 350.74s (299.42s test time). Production TypeScript/Vite build, focused ESLint, and `git diff --check` pass. This test-and-docs change does not alter the deployed app bundle. The four-mod/two-slot exhaustive mod pool is deliberately bounded: it does not establish full-catalog mod optimality, larger joint searches, Forma optimization, stochastic proc-history parity, Underframe parity, or gameplay accuracy. Do not mark full-catalog and joint Arcane verification complete from this sample.

## D3-MECH-HEAT-PRESENCE-PROBABILITY-001 — fractional Heat group presence (2026-11-21; PR #185 merged, deployment unverified)

The current [Heat Damage Wiki page](https://wiki.warframe.com/w/Damage/Heat_Damage) describes Heat armor reduction as a staged, target-level effect: 15%, 30%, 40%, then 50% at half-second intervals, with one shared ramp rather than a ramp per proc. The [Damage Calculation page](https://wiki.warframe.com/w/Damage/Calculation) describes a shared +1 Heat tick accumulator. Both effects depend on whether the target has an active Heat group; additional proc count does not multiply the accumulator or the strip.

The finite encounter previously advanced the shared group's `activeWeight` by fractional expected Heat applications, capped at one. With a 25% Heat chance per attack, that treated two rolls as 50% presence instead of the union probability `1 − (1 − 0.25)^2 = 43.75%`. The implementation now combines the refreshed group's existing presence with the probability of a new application, `1 − (1 − previousPresence) × (1 − newPresence)`, and uses the resulting presence weight for both the single shared tick accumulator and staged Heat strip. Guaranteed forced proc fixtures now say so explicitly; deterministic p=1 behavior is unchanged.

Focused regressions cover a fractional 25% Heat chance across successive attacks for both the shared tick accumulator and the strip ramp. `src/domain/logic/__tests__/targetDamage.test.ts` passes 114/114. This remains an expected-value model: it does not represent every stochastic proc history, independently timed status-group refresh, or the full spread of strip states. The local source correction changes the current Mausolon displayed-stat alignment values: Fully Stacked / direct Auto becomes 23,812.7 DPS at 3,000 Armor (from 24,065.9), and linked Auto plus radial becomes 28,096.7 DPS (from 28,115.4); the zero-Armor values remain 87,568.5 and 102,549.4. Underframe's hidden Luck Averaged state and damage-bucket semantics remain unresolved; see [the comparison record](docs/UNDERFRAME_COMPARISON.md).

## D3-OPT-MAUSOLON-ARCHWING-NEIGHBORHOOD-001 — final-pass single-mod refinement and seeded corpus (2026-11-21; PR #185 merged, deployment unverified)

The seeded 20261144 full-pool audit previously selected Mausolon / Charged Shot Explosion. That attack is now correctly blocked from Auto Optimize because its five-kill charge/recharge history is unsupported. The seeded Archgun stratum now selects the supported `Mausolon (Archwing)` / `Auto` profile; `auditExpectedTtkCorpus.ts`, `auditExpectedTtkFullPool.ts`, and the pair-sample runner resolve exact display-profile names as well as catalog internal names.

The new full-pool case exposed a one-mod miss after the fifth and final finite-refinement pass: the last accepted move left a build whose Charged Bullets → Parallax Scope replacement improved modeled Expected TTK from 1.1372970 s to 1.0109307 s. Refinement now runs six passes so it can rescore a neighborhood exposed by a late accepted move. The full-pool regression selects Parallax Scope and independently scores the returned list at 1.0109307 s / 98,918.75 DPS; the build is legal with three Forma. The exact audit scores 167 legal one-mod neighbors around the returned build and finds no improvement. Reproduce with:

```sh
npx tsx scripts/auditExpectedTtkFullPool.ts --weapon="Mausolon (Archwing)" --attack=Auto --state=realistic
```

The seeded 12-case corpus was rerun after both the Heat-presence and six-pass corrections. Its settings remain Grineer, 100,000 Health / 3,000 Armor, Realistic state, eight slots, Catalyst, MR30, up to three Forma, and no Arcane/Exilus optimization. Exact scoring found no improving legal one-mod add/remove/replacement across 3,845 neighbors:

| Weapon / attack | Legal one-mod neighbors | Optimizer Expected TTK |
| --- | ---: | ---: |
| Braton Prime / Normal Attack | 234 | 2.1194748 s |
| Cedo / Normal Attack | 412 | 2.9839612 s |
| Laetum / Normal Attack | 276 | 1.8000000 s |
| Soma Prime / Fully Spooled | 420 | 1.7541983 s |
| Broken War / Normal Attack | 344 | 8.8064516 s |
| Kuva Nukor / Normal Attack | 359 | 1.4400000 s |
| Nataruk / Perfect Shot | 396 | 1.3000000 s |
| Torid / Grenade Impact | 238 | 4.7543860 s |
| Kuva Ogris / Rocket Explosion | 450 | 2.0000000 s |
| Mausolon (Archwing) / Auto | 167 | 1.0109307 s |
| Verglas Prime / Normal Attack | 250 | 2.8070175 s |
| Arca Titron / Heavy Slam Attack | 299 | 1.5591503 s |

This is bounded single-mod evidence over a fixed target/state, not global or pairwise optimality. At this audit checkpoint, the matched Underframe Mausolon comparison used a different simulator/objective with hidden Luck Averaged conditions, and separate profile range behavior had not yet been resolved; the later D3-MOD-MAUSOLON-RANGE-CAP-001 follow-up models Atmosphere and charged-Laser caps while retaining the Archwing Auto conflict.

The updated seeded two-mod sample, using `npx tsx scripts/auditExpectedTtkPairSample.ts --seed=20261144 --samples=1024`, drew 1,024 legal replacements per fixture. It scored 12,288 legal moves after inspecting 25,813 raw tuples; no sampled pair improved its optimizer baseline:

| Weapon / attack | Baseline TTK | Best sampled TTK | Improving samples |
| --- | ---: | ---: |
| Braton Prime / Normal Attack | 2.1194748 s | 2.4476280 s | 0 |
| Cedo / Normal Attack | 2.9839612 s | 3.1088712 s | 0 |
| Laetum / Normal Attack | 1.8000000 s | 2.0000000 s | 0 |
| Soma Prime / Fully Spooled | 1.7541983 s | 2.1401632 s | 0 |
| Broken War / Normal Attack | 8.8064516 s | 9.0967742 s | 0 |
| Kuva Nukor / Normal Attack | 1.4400000 s | 1.7500000 s | 0 |
| Nataruk / Perfect Shot | 1.3000000 s | 1.4750000 s | 0 |
| Torid / Grenade Impact | 4.7543860 s | 5.0000000 s | 0 |
| Kuva Ogris / Rocket Explosion | 2.0000000 s | 2.6666667 s | 0 |
| Mausolon (Archwing) / Auto | 1.0109307 s | 1.0741139 s | 0 |
| Verglas Prime / Normal Attack | 2.8070175 s | 3.0263158 s | 0 |
| Arca Titron / Heavy Slam Attack | 1.5591503 s | 1.8190086 s | 0 |

The sample uses the same Grineer / 100,000 Health / 3,000 Armor / Realistic / eight-slot / Catalyst / up-to-three-Forma context as the one-mod corpus. It is sampled, not an exhaustive pair neighborhood; this is not global optimality or gameplay validation. The initial run stopped at the renamed Mausolon display profile because the pair runner resolved internal names only. Its profile-aware lookup was fixed, and this complete 12-fixture rerun is the reported result.

Four in-process optimizer calls compared the prior five-pass cap with six passes on Mausolon (Archwing) / Auto. The five-pass build repeated at 1.1372970 s and 253 exact evaluations; call times were 2.751, 2.132, 1.864, and 1.932 s. The six-pass build repeated at 1.0109307 s and 301 evaluations; call times were 2.994, 2.188, 2.004, and 2.227 s. Excluding each first call from the warm comparison, median latency rose from 1.932 to 2.188 s (about 13.3%) and the warm maximum from 2.132 to 2.227 s. This is one desktop Node fixture and a small in-process sample; it does not measure packaged browser Worker, cold-start, or mobile latency.

### Current-model rescore of existing Underframe fixtures

The Heat-presence correction changes finite Expected TTK results for builds that apply Heat; earlier benchmark sections retain their recorded historical model outputs. Re-running the existing common-model comparison scripts on this branch gives the following current scores:

| Fixture | Captured Underframe list | Current Tenno-Hub optimizer | Current neighborhood / stability |
| --- | ---: | ---: | --- |
| Gram Prime / Normal Attack / Initial | 11.2500 s / 8,888.9 DPS | 6.8387 s / 14,622.6 DPS; legal 60/60, 1 Forma | 391 legal one-mod neighbors, none better; 3 identical builds, 133 exact refinement candidates/run |
| Cedo / Normal Attack / Realistic | 5.3176 s / 18,805.6 DPS | 2.9840 s / 33,512.5 DPS; legal 59/60, 2 Forma | 412 legal one-mod neighbors in seeded corpus, none better; 133 refinement candidates |

Gram was reproduced with `npx tsx scripts/compareUnderframeGramAutoBuild.ts` and `npx tsx scripts/auditExpectedTtkSlotFamilyNeighborhood.ts`. The three optimizer calls returned the same list: Primed Pressure Point R10, Primed Smite Grineer R10, Melee Elementalist R5, True Steel R5, Organ Shatter R5, Primed Fury R10, Melee Prowess R5, and Carnis Mandible R5. Current elapsed times were 3,487.9, 2,723.7, and 2,612.1 ms (median 2,723.7 ms, maximum 3,487.9 ms). The exact neighborhood rescored all 391 legal candidates and tied the optimizer baseline at best. The native Underframe capture remains 49,816 DPS / 2.01 s from its separate standard calculator; the modeled common scorer does not reproduce Lashing Tempest timing.

Cedo was reproduced with `npx tsx scripts/compareCedoUnderframeMatched.ts`; its fixed capture remains 5.3176 s in Realistic, 6.8764 s in Initial, and 2.4941 s Fully Stacked. The optimizer's current list still uses Frail Momentum, Galvanized Hell, Primed Chilling Grasp, Toxic Barrage, Scattering Inferno, Blaze, Shotgun Barrage, and Galvanized Savvy, but the corrected finite scorer returns 2.9840 s rather than the historical 2.6110 s. These current-model results supersede those older score readouts; the older sections preserve what the earlier model measured. Both are bounded common-model rescoring, not Underframe search-objective parity, gameplay validation, or global optimality.

## D3-MECH-WEAPON-FALLOFF-001 — attack falloff and weapon-range propagation (PR #182 merged; deployed QA complete)

Wiki source profiles now feed an optional attack-distance assumption through the calculator, finite single-target scoring, optimizer, saved build configuration, and math trace. [Damage Falloff](https://wiki.warframe.com/w/Damage_Falloff) describes linear falloff, Projectile Speed and weapon Range scaling, blast-radius scaling for AoE falloff, and the known Condition Overload/Galvanized exception. [Vaykor Hek](https://wiki.warframe.com/w/Vaykor_Hek) supplies a 10–25m, 100%→26.67% direct profile affected by Projectile Speed. [Mausolon](https://wiki.warframe.com/w/Mausolon) supplies separate profile values: Archwing Auto 1,400–2,800m to 0%, Auto radial 0–1.8m to 10%, and charged explosion 0–8m to 60%; Atmosphere Auto has no direct falloff, its radial reaches 20% minimum at 1.8m, and its charged explosion table has no profile-specific falloff entry. Ballista Measure now parses +5/10/15/20% Range by rank.

Both Mausolon Wiki Auto rows list a 300m Range. Keep the rest of the source profile separate: Archwing Auto has an explicit 1,400–2,800m direct falloff curve, while Atmosphere Auto has no direct falloff entry and its radial component has a distinct 100%→80% curve (Archwing radial: 100%→90%). The generic [Atmospheric Archgun page](https://wiki.warframe.com/w/Atmospheric_Archgun) says atmospheric Archguns lack damage falloff, while almost all zero-gravity Archguns have it. The [Range page](https://wiki.warframe.com/w/Range) lists Archguns among exceptions to the default 300m hit-scan range, but Mausolon's individual rows still list 300m; the [Damage Falloff page](https://wiki.warframe.com/w/Damage_Falloff) separately states a general 300m hit-scan limit except for sniper rifles. At the PR #182 implementation checkpoint, Tenno-Hub left both 300m values informational. D3-MOD-MAUSOLON-RANGE-CAP-001 now enforces Atmosphere Auto and both Charged Shot Laser caps; Archwing Auto remains informational because its listed cap conflicts with its falloff curve. Do not use Archwing's falloff curve as a substitute for a missing Atmosphere curve. An attached radial event scores at a 0m offset from the struck target. The model remains single-target, assumes full damage when distance is blank, does not reproduce the CO/Galvanized falloff bug, and multiplies independent Range and Projectile Speed extensions when both apply; the combined formula is not source-confirmed.

Focused regressions pass: `damageCalc.test.ts` 138/138 and `buildOptimizer.test.ts` 153/153. The full serial suite passes 826/826 across 54 files; app/node TypeScript, production build, source validation, prerequisite audit (162 entries, no unresolved references/cycles), mod-effect coverage (695 weapons / 600 eligible mods / 492 parsed / 108 without effects / 70 review / 18 partial / 52 unparsed / zero empty pools), focused ESLint, and CRLF-aware diff check pass. The Build Planner route chunk is 785.58 KB (203.34 KB gzip), with Vite's large-chunk warning still present; cold/mobile impact is unmeasured. Vaykor Hek test points are ×1 through 9.9m, ×0.6333 at 17.5m, and ×0.2667 at 25m; a synthetic +50% Projectile Speed bonus extends endpoints to 15–37.5m and yields ×0.9185 at 17.5m. Public IAB verified the separate Mausolon profiles and, at 2,100m, Archwing Auto ×0.5 with the exact 1,400–2,800m trace; Atmosphere Auto has no direct falloff. PR [#182](https://github.com/Appl3Tree/Tenno-Hub/pull/182) was squash-merged as `d93932a745c4933600dd89a5dfa22c00eeac887f`; Pages deployment [run #262](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/44878932279) succeeded. The Wiki-listed 300m maximum remains informational and is not enforced, the CO/Galvanized exception and combined scaling formula remain unresolved, spatial AoE is excluded, and live-game/mobile behavior was not verified. Implementation and source details are in `BUILD_PLANNER_WORK_STATUS.md`.

### 2026-11-21 Mausolon range-control reread

The existing Underframe Mausolon test copy identifies its selected profile from the displayed 180 Auto / 72 radial damage as Atmosphere. Its direct Auto Distance slider is bounded to 1,400–2,800m, so the saved copy cannot probe around the Wiki-listed 300m range in that mode. The Auto control starts exactly at the Archwing falloff threshold even though Atmosphere has no source-listed direct Auto falloff. This strengthens the evidence for a calculator/UI profile-range mismatch, but it does not establish the in-game hit limit. The Wiki supports the Atmosphere cap; Archwing Auto retains conflicting 300m/falloff fields. No saved build was changed. At this reread's checkpoint, `damageCalc.test.ts` checked both Auto rows as full damage at 301m and treated both 300m values as informational. Follow-up D3-MOD-MAUSOLON-RANGE-CAP-001 now enforces Atmosphere Auto and both Charged Shot Laser caps while preserving Archwing Auto's falloff and informational range. Validation: damageCalc.test.ts 138/138; full serial suite 831/831 across 54 files (223.76s); focused ESLint and CRLF-aware diff check pass. PR #193 was squash-merged as `2212a957149bae4b60d59771446a75f68af05f61`; GitHub reported no check contexts or workflow runs.

## D3-OPT-UNDERFRAME-MAUSOLON-001 — Mausolon profiles and objective-matched audit (2026-11-21; profiles released, comparison gap open)

The [Mausolon Wiki page](https://wiki.warframe.com/w/Mausolon) lists distinct Archwing and deployed Heavy Weapon (Atmosphere) damage profiles. Tenno-Hub exposes both as selectable `Mausolon (Archwing)` and `Mausolon (Atmosphere)` entries, as requested. Archwing Auto / radial / charged laser / charged explosion are 120 (24 Impact / 46 Puncture / 50 Heat) / 48 Heat / 1,000 (150 Impact / 400 Puncture / 450 Heat) / 3,000 Heat. Atmosphere values are 180 (35 Impact / 70 Puncture / 75 Heat) / 72 Heat / 1,500 (150 Impact / 600 Puncture / 750 Heat) / 4,500 Heat.

Auto links one fixed-count radial event to each direct hit on the struck target. The radial event has no multishot scaling. This single-target score excludes spatial coverage and other enemies. Lifted targets can receive additional damage instances, and spatial AoE is still outside this bounded model. Charged fire remains preview-only for Auto Optimize because the five-kill charge and subsequent recharge history is not modeled. The current [Archgun Ace mod data](https://wiki.warframe.com/w/Module:Mods/data?mobileaction=toggle_view_mobile) specifies +50% Fire/Charge Rate and +100% Reload Speed for 9 seconds on headshot kill; Tenno-Hub now carries the same rank-specific duration on both parsed stats.

### Underframe capture

The integrated browser used an Underframe Mausolon copy with Auto Build's five-second simulation, Sample Size Multiplier 3, Final Refinement size 200, Luck Averaged and Elemental Candidates on, Cost Control on, and a three-Forma cap. The captured Stats panel showed 180 Auto damage and 72 radial damage, identifying this as the Atmosphere profile. The target was Grineer / 100,000 Health / 3,000 Armor, no Shields/Overguard, no headshots, and no external statuses/buffs. The captured list was Archgun Ace R5, Automatic Trigger R5, Ballista Measure R3, Containment Breach R3, Critical Focus R5, Deadly Efficiency R5, Dual Rounds R5, and Hollowed Bullets R3. Manual Auto Polarize yielded 2/60 capacity with three Forma.

The original Auto Build capture had Primary Bulwark 500/500 and Secondary Outburst 12/12 enabled; these inapplicable category Arcanes are not used as comparison results. Three later Auto-only runs began with both sliders cleared to zero, repeated the same list and 21,760 Best DPS, and the UI reset the sliders to 500/12 after each run. This confirms repeatability for those Auto-only runs, while the initial capture's provenance remains separate.

The captured list was then read in `[C] Auto (Combined)` (Auto + Auto Radial Attack at a 1:1 ratio). At 100,000 Health / 3,000 Armor, three Luck Averaged reads repeated 25,755 DPS / 3.89 s TTK, with 1,383 raw +72 DoT average damage per shot. At 2,000,000 Health / 3,000 Armor, three reads gave 28,724 DPS, 1,531 raw +107 DoT per shot, and no kill. At 2,000,000 Health / 0 Armor, one read gave 107,028 DPS, 5,773 raw +329 DoT per shot, and no kill. All three used zero category-Arcane sliders. These are calculator readouts for the captured list; none is an Auto Build winner for Combined mode.

### Attack-mode and conditional-state alignment diagnostic (2026-11-21)

The integrated browser was used to separate Underframe's `Auto` from `[C] Auto (Combined)` on the same captured list. With Grineer / 2,000,000 Health / 3,000 Armor / zero Shields and Overguard / headshots off / both category Arcane sliders at zero, three Luck Averaged Auto-only reads returned 22,361 DPS and 1,211 raw +64 DoT average damage per shot; the target survived. At zero Armor, one Auto-only read returned 87,418 DPS and 4,762 raw +221 DoT per shot; the target survived. These readings are distinct from the Combined reads above. They are calculator outputs for the captured build, not additional Auto Build winners.

Reproduce the current profile-aware Tenno-Hub audit with:

```sh
npx tsx scripts/auditMausolonAttackModeAlignment.ts --profile=Atmosphere --distance=300
npx tsx scripts/auditMausolonAttackModeAlignment.ts --profile=Atmosphere --distance=301
npx tsx scripts/auditMausolonAttackModeAlignment.ts --profile=Archwing --distance=1400
```

The Nov 22 review found that the prior helper populated `targetDistanceMeters` for distance-gated mod conditions but omitted `attackFalloffDistanceMeters`, which is the calculator input that applies weapon falloff and hard hit caps. Therefore the earlier 1,400m Tenno-Hub numbers below were full-damage scores, not actual 1,400m results. The revised helper accepts `--profile=Atmosphere|Archwing` (defaults to Atmosphere) and applies `--distance` to both fields; it reports both inputs explicitly. This corrects the audit harness, not production scoring, which already uses `attackFalloffDistanceMeters`.

At 3,000 Armor / Fully Stacked / 2,000,000 Health with the captured eight-mod list, the corrected profile matrix is:

| Profile / distance | Auto direct-only DPS | Auto + linked radial DPS |
| --- | ---: | ---: |
| Atmosphere / 300m | 23,812.72 | 28,096.68 |
| Atmosphere / 301m | 0 | 0 |
| Atmosphere / 1,400m | 0 | 0 |
| Archwing / 1,400m | 15,875.18 | 18,731.16 |
| Archwing / 2,100m | 12,122.95 | 14,941.59 |
| Archwing / 2,800m | 5,099.33 | 7,848.01 |

The captured `Ballista Measure` R3 extends Archwing's 1,400–2,800m falloff endpoints by 20% to 1,680–3,360m. That is why Archwing still deals direct damage at 2,800m in this modded setup. Atmosphere Auto's hard 300m cap suppresses both the direct hit and its linked radial component beyond 300m. At exactly 300m, the Atmosphere output reproduces the prior full-damage matrix; at 301m it correctly becomes a miss.

Underframe's Luck Averaged calculator still does not expose its effective conditional-state mixture. The 1,400m Underframe readouts below use a generic Mausolon page with active category-Arcane sliders and do not establish which profile was selected internally. The prior 1,400m percentage deltas and per-attack bucket comparison are withdrawn as distance-matched evidence. The Tenno-Hub direct-only row remains a diagnostic ablation, not product behavior; none of these model rows establishes simulator or gameplay parity.

The prior direct-only per-attack split is a full-damage diagnostic, not a distance-matched comparison: the old helper set target distance without setting attack falloff distance. Its damage-bucket totals cannot be compared with the 1,400m Underframe readout until profile, effective range, conditional sliders, and output bucket definitions are aligned.

#### Controlled-distance intermediate-Armor read

The integrated-browser control showed distance 1,400m within a 1,400–2,800m range before and after the Auto-only samples. With the same 2,000,000-Health Grineer target, no Shields/Overguard/headshots, zero category Arcane sliders, and the captured mod list, three Luck Averaged reads at 500 Armor repeated at 60,510 DPS / 3,300 raw +149 DoT per shot. Three reads at 3,000 Armor repeated at 22,361 DPS / 1,211 raw +64 DoT per shot. The raw observations are in `underframeControlledDistanceAutoHighHealthArmorMatrix` in `scripts/fixtures/underframeMausolonAutoBuild.json`.

The historical 500-Armor helper recorded 1,400m only as a condition distance; it did not pass the value to weapon falloff. Its Tenno-Hub result is a full-damage control, not a valid 1,400m prediction. Reproduce the current profile-aware audit with:

```sh
npx tsx scripts/auditMausolonAttackModeAlignment.ts --profile=Atmosphere --distance=300
npx tsx scripts/auditMausolonAttackModeAlignment.ts --profile=Archwing --distance=1400
```

At 500 Armor, 61,425.7 DPS / 3,490.1 total damage per attack remains the Fully Stacked Atmosphere full-damage control, valid only when no falloff distance is entered or the target is at or inside 300m. Underframe's 60,510 DPS / 3,449 displayed raw-plus-DoT per shot was read at 1,400m on a generic Mausolon page, so the former +1.5% figure is not a distance-matched comparison. Underframe's effective Luck Averaged conditional-state mixture remains hidden. Keep the Archwing 1,400–2,800m curve separate; the Tenno-Hub Atmosphere profile now produces zero damage beyond 300m. Sources: [Mausolon](https://wiki.warframe.com/w/Mausolon), [Damage Falloff](https://wiki.warframe.com/w/Damage_Falloff), and [Ballista Measure data](https://wiki.warframe.com/w/Module:Mods/data).

Earlier 500-Armor Auto-only readings taken before distance 1,400m was verified remain excluded. The controlled Underframe UI transition is reproduced, but the old Tenno-Hub helper did not apply distance to attack falloff. The corrected profile-aware matrix below supersedes the claimed distance-matched Tenno-Hub deltas; the difference between Underframe's generic Mausolon readout and the source-backed profiles remains open under D3-OPT-UNDERFRAME-AVG-DPS-SEMANTICS-001.

#### Reproduced distance transition and profile-specific score difference (2026-11-21)

The in-app browser showed Underframe's Atmosphere Auto control at 1,400m inside 1,400–2,800m. After setting 2,100m and switching to `[C] Auto (Combined)`, the control reset to 0m inside 0–2,800m. Switching back to Auto reset it to 1,400m inside 1,400–2,800m. The same reset occurred from Auto's 1,400m starting point. No Save action was used; the saved page was restored to its starting settings. This reproduces mode-dependent reset-to-minimum behavior, rather than distance preservation.

With the captured Atmosphere Auto list and Grineer / 2,000,000 Health / 3,000 Armor / zero Shields and Overguard / no headshots / zero category Arcane sliders, Underframe's standard `Calculate DPS` returned:

| Underframe Atmosphere Auto distance | Average DPS | Average damage per shot |
| ---: | ---: | ---: |
| 1,400m | 25,504 | 1,377 raw + 77 DoT |
| 2,100m | 13,461 | 704 raw + 64 DoT |
| 2,800m | 0 | 0 |

These are one standard-calculator read per point, distinct from the earlier three-run Luck Averaged values at 1,400m and not Auto Build results. They demonstrate that Underframe's calculator uses its distance input for this Atmosphere-labeled build. Raw damage per shot falls from 1,377 to 704 at the midpoint distance (51.1%), close to the ×0.5 multiplier of the separately sourced Archwing curve; this suggests Underframe may apply Archwing falloff while displaying Atmosphere damage, but does not prove its internal profile selection. The calculator evidence does not establish game behavior or which mechanic causes the reduction.

The previous Tenno-Hub audit accepted `--distance=<meters>` but only stored it as `targetDistanceMeters`, so it did not apply attack falloff or a hard hit cap. Those historical outputs remain useful only as no-falloff controls. The corrected audit accepts a profile and sends one physical distance to both distance-gated conditions and weapon falloff. Reproduce the current separate profiles with:

```sh
npx tsx scripts/auditMausolonAttackModeAlignment.ts --profile=Atmosphere --distance=300
npx tsx scripts/auditMausolonAttackModeAlignment.ts --profile=Atmosphere --distance=301
npx tsx scripts/auditMausolonAttackModeAlignment.ts --profile=Archwing --distance=1400
npx tsx scripts/auditMausolonAttackModeAlignment.ts --profile=Archwing --distance=2100
npx tsx scripts/auditMausolonAttackModeAlignment.ts --profile=Archwing --distance=2800
```

The Underframe page labels its weapon only `Mausolon`; the related captured Auto Build was inferred to use Atmosphere from its 180 Auto / 72 radial stats, but the page exposes no explicit profile selector. Its displayed 1,400/2,100/2,800m results remain calculator evidence, not verified gameplay behavior. The corrected Tenno-Hub helper reports Atmosphere's 300/301m boundary and the separate Archwing falloff curve; it does not copy Archwing falloff into Atmosphere or adjust the scorer to match Underframe. The cross-tool profile discrepancy remains open.

The earlier local probe accepted 1,400, 2,100, and 2,800m but omitted `attackFalloffDistanceMeters`, so those Tenno-Hub values were full-damage controls. The Underframe UI measurements above remain calculator observations. The Nov 22 corrected audit and readout repeatability fixture below replace the old helper interpretation; the UI work used only the integrated in-app browser and changed no saved build data.

The follow-up harness/fixture update is locally validated: two audit runs are byte-identical, strict TypeScript and focused ESLint pass for the script, the fixture parses as JSON, and `git diff --check` passes. No application code changed.

The attack-mode/state alignment helper and fixture are released in PR [#180](https://github.com/Appl3Tree/Tenno-Hub/pull/180), squash-merged as `d3c34e27767c84dff8af35d9cc9ca2727b0e1f02`; Pages run [#260](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/44870380703) succeeded. Validation passed twice with deterministic output, strict TypeScript, focused ESLint, fixture JSON parsing, and `git diff --check`. No app source changed in that checkpoint.

### Corrected fixed-window scorer and reproducible comparison

Reproduce the shared-model and exact one-mod audits with:

```sh
npx tsx scripts/compareUnderframeFixedWindowDps.ts --weapon="Mausolon (Atmosphere)" --health=100000 --armor=3000 --runs=1
npx tsx scripts/compareUnderframeFixedWindowDps.ts --weapon="Mausolon (Atmosphere)" --health=2000000 --armor=3000 --runs=3
npx tsx scripts/compareUnderframeFixedWindowDps.ts --weapon="Mausolon (Atmosphere)" --health=2000000 --armor=0 --runs=1
npx tsx scripts/auditFixedWindowDpsFullPool.ts --weapon="Mausolon (Atmosphere)" --attack=Auto --health=2000000 --armor=3000 --runs=3
npx tsx scripts/auditFixedWindowDpsFullPool.ts --weapon="Mausolon (Atmosphere)" --attack=Auto --health=2000000 --armor=3000 --runs=3 --baseline-file=scripts/fixtures/underframeMausolonAutoBuild.json
```

The deterministic `windowDps` score applies damage in `[0,5s)`, clips overkill, and starts event-triggered mod buffs inactive. The model has no trigger history for headshots, reloads, kills, or similar events during the interval; the explicit Fully Stacked state remains available. This corrects the prior steady-state estimate that could credit a reload-from-empty buff although the finite clip had not reloaded. The explanation now states that these histories are not simulated. It is still a mean-field single-target scorer, not Underframe's seeded stochastic engine.

| Target / build | Tenno-Hub fixed-window result | Underframe calculator result |
| --- | ---: | ---: |
| 2,000,000 Health / 3,000 Armor; captured Auto list | 42,732.0 damage / 5s = 8,546.4 DPS; 67 attacks; no kill | 28,724 DPS; 1,531 raw +107 DoT / shot; no kill |
| 2,000,000 Health / 0 Armor; captured Auto list | 156,085.4 damage / 5s = 31,217.1 DPS; 67 attacks; no kill | 107,028 DPS; 5,773 raw +329 DoT / shot; no kill |
| 100,000 Health / 3,000 Armor; captured Auto list | 42,732.0 damage / 5s = 8,546.4 DPS; 67 attacks; no kill | 25,755 DPS; 3.89 s TTK |
| 2,000,000 Health / 3,000 Armor; optimized Auto list | 1,575,206.1 damage / 5s = 315,041.2 DPS; no kill | No matched Underframe optimization run |

The initial high-health 3.36x / 3.43x values and the later smaller percentage deltas are withdrawn as distance-matched comparisons. Tenno-Hub's fixed-window runs omitted distance and therefore used full damage, while the Underframe readout used 1,400m on a generic Mausolon page with no confirmed profile selection. The Fully Stacked stats still align with Underframe's visible Stats panel, but this does not align falloff, objective, or Luck Averaged condition history. No cause has been isolated; do not adjust the scorer to force agreement.

The captured list is legal at 58/60 and three Forma under Tenno-Hub capacity rules. The current full-pool rerun scores it at 8,546.4 DPS / 42,732.0 damage in five seconds; this supersedes the earlier 8,561.5 / 42,807.6 output. Its exact legal one-mod neighborhood contained 181 candidates; the best replacement (Archgun Ace → Primed Rubedo-Lined Barrel) scores 24,527.95 DPS, 187.0% above that baseline (the earlier 24,571.3 score is superseded). The optimizer returns the same legal 59/60, three-Forma list at 315,041.23 DPS in three runs, with 245 refinement candidates per run. The refreshed exact neighborhood contains 139 legal one-mod neighbors, none improving the baseline; the best is Parallax Scope → Magnetized Cycle at 308,465.67 DPS. The captured and optimized builds use the deterministic Tenno-Hub model and its default full-damage assumption when distance is omitted. The captured list remains much weaker under that shared model, while Underframe's hidden Luck Averaged state and profile-range behavior prevent a native score comparison. These are bounded Tenno-Hub results, not global optimality, Underframe parity, or gameplay validation.

### Release and deployed browser verification

PR [#178](https://github.com/Appl3Tree/Tenno-Hub/pull/178) was squash-merged as `c3a6a315aaa8638452036c775988b66844ae8957`; Pages deployment [run #258](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/44866105479) succeeded. Cache-busted IAB verification on the deployed page showed both Mausolon profile choices and their distinct Auto/radial values, the component-row warning with Auto Optimize disabled, the charged-laser history warning with Auto Optimize disabled, and the `5s Avg DPS` explanation that event-trigger history during the window is not simulated. The visual check covered the selector and attack controls; the explanation was confirmed in the rendered accessibility content. Full workflow coverage and the numerical Underframe discrepancy remain open.

Pre-release validation passed: optimizer tests 152/152, full serial suite 820/820 across 54 files, app/node TypeScript and production Vite build, source validation, prerequisite audit (162 entries), mod-effect coverage audit (695 weapons / 600 eligible mod records / 491 parsed / 109 without parsed effects / zero empty weapon pools), strict TypeScript checks for both changed audit scripts, focused ESLint, fixture JSON parsing, and CRLF-aware `git diff --check`. The existing large-chunk warning remains. The feature is now released in PR [#178](https://github.com/Appl3Tree/Tenno-Hub/pull/178) / commit `c3a6a315aaa8638452036c775988b66844ae8957`; Pages run [#258](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/44866105479) succeeded. Deployed IAB QA verified the profile selector and attack boundaries. The remaining score discrepancy is still open.

### D3-OPT-FIXED-WINDOW-TRIGGER-START-STATE-001 — event-trigger state in `[0,5s)` (2026-11-21; bounded correction released, event history remains open)

New Mausolon evidence exposed that realistic uptime estimation treated on-reload-from-empty effects as if a finite five-second encounter inherited steady-state trigger history. The window scorer now removes event-triggered conditional stats at its initial state unless the user explicitly chooses Fully Stacked; passive conditions and the separate modeled non-critical/no-status hit stack sequence remain available. This correction applies to the exact finite score used by optimization and the debug evaluator. A regression verifies that a 40-round weapon fired for five seconds does not receive a reload-from-empty damage bonus, while Fully Stacked still does. The “Why This Build” summary explains that trigger histories are not simulated.

The remaining limitation is explicit: event activations that could happen during `[0,5s)` are not simulated either. Modeling them needs an event-by-event reload, hit, and kill history; the current score should not be read as a full stochastic DPS estimate. Validation passed at 152/152 optimizer tests and 820/820 serial tests / 54 files, strict TypeScript for the changed audit scripts, app TypeScript/production build, source/prerequisite/mod-effect audits, focused ESLint, fixture JSON parsing, and CRLF-aware diff check. PR [#178](https://github.com/Appl3Tree/Tenno-Hub/pull/178) merged as `c3a6a315aaa8638452036c775988b66844ae8957`; Pages run [#258](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/44866105479) succeeded. Reopen if a trigger is incorrectly suppressed despite an existing sequence model, or if an event-level fixed-window simulator is implemented.

### D3-OPT-UNDERFRAME-AVG-DPS-SEMANTICS-001 — distance/profile and surviving-target gap (in progress)

The public Underframe Desktop port specification at commit `fe38d07f3515a995a068015314ad85acc65bef61` documents mean `avgDps` over seeded five-second simulations, but its private engine is unavailable for an independent audit. The initial 3.35–3.43x result is superseded as a matched comparison: it paired Tenno-Hub Realistic/linked Auto with Underframe's displayed Fully Stacked stats and Combined mode. The later +6.5%, +1.5%, +0.2%, −2.2%, and −4.2% differences are also withdrawn as distance-matched comparisons. The helper recorded those distances only in `targetDistanceMeters`; it omitted `attackFalloffDistanceMeters`, so the Tenno-Hub values were full-damage controls. The corrected profile-aware matrix is documented above. Underframe's effective condition mixture in Luck Averaged reads remains hidden, and its displayed raw/DoT split still differs from Tenno-Hub's direct/status split.

Source-backed mechanics provide checks for Tenno-Hub's side, not a way to infer Underframe's bucket definitions: [Damage/Calculation](https://wiki.warframe.com/w/Damage/Calculation) describes weapon-generated Heat ticks from modded base damage with a shared +1 tick accumulator; [Heat Damage](https://wiki.warframe.com/w/Damage/Heat_Damage) gives a 0.5 coefficient, one-second ticks beginning after one second, faction/Heat/status bonuses, and a staged armor strip that reaches 50% over two seconds; [Armor](https://wiki.warframe.com/w/Armor) gives the standard enemy reduction formula `90% × sqrt(Net Armor / 2700)` through 2,700 Armor. These mechanics are represented in Tenno-Hub's model, including the recently corrected fractional Heat group-presence weighting. The remaining direct/status attribution cannot be assigned to one mechanic from the two UI totals: Underframe's Luck Averaged condition mixture, seeded proc history, quantization, and displayed-bucket semantics are not observable in this comparison.

A separate standard `Calculate DPS` probe on the captured Atmosphere Auto list / Grineer / 2,000,000 Health / 3,000 Armor returned 25,504 at 1,400m, 13,461 at 2,100m, and zero at 2,800m (one read per point; not Luck Averaged or Auto Build). All three distances exceed the 300m Range listed for both Mausolon Auto profiles, so this is a UI formula-response probe, not an in-range gameplay comparison. At that pre-cap checkpoint, Tenno-Hub's Atmosphere profile was distance-invariant because its profile had no direct Auto falloff entry and the generic Atmospheric Archgun page says this category lacks falloff; its Archwing profile retained its separately listed 1,400–2,800m curve. D3-MOD-MAUSOLON-RANGE-CAP-001 now treats Atmosphere Auto shots beyond 300m as misses; the scores recorded here are historical. The Underframe distance response remains a profile/source discrepancy, but does not establish which rule Underframe applies in-game. Keep each profile's range/falloff facts distinct and do not adjust either score to force agreement.

#### Cedo surviving-target readout repeat (2026-11-22)

On the existing Cedo Normal Attack capture, with Grineer / 2,000,000 Health / 3,000 Armor / zero Shields and Overguard / 5s / 26m, Galvanized Hell 4/4 and Galvanized Savvy 2/2, three Standard Calculate DPS reads returned 61,468 DPS (4,744 raw + 0 DoT per shot), 46,766 (3,609 + 0), and 79,875 (6,165 + 0); all displayed `>5s` TTK and the target survived. Three Luck Averaged reads repeated 53,070 DPS and 4,096 raw + 0 DoT per shot; the TTK control displayed `? ttk`. The Cedo conditional and external statuses/buffs were off. The only changed target input was restored to 100,000 Health after the reads; no Save action or mod/build edit was used.

This extends the earlier single surviving-target Standard read (46,279 DPS; 3,572 raw + 0 DoT per shot) with three more Standard trials and three identical Luck Averaged trials. The Standard output varied substantially, while Luck Averaged repeated exactly in this small sample. This is calculator/readout evidence for one explicit weapon attack, not a diagnosis of the website engine, a proof of the displayed score denominator, or an Auto Build result.

#### Explicit Arch-Gun fixed-window fallback (2026-11-22)

The generic Underframe Mausolon page exposes no profile selector and its Auto distance slider starts at 1,400m, so it cannot be matched to a known Mausolon profile at an in-range distance. The source-verified fallback is the explicit Tenno-Hub `Mausolon (Atmosphere)` / Auto profile at 250m, inside its modeled 300m hard cap. Reproduce the full-pool fixed-window optimizer and exact one-mod neighborhood with:

```sh
npx tsx scripts/auditFixedWindowDpsFullPool.ts --weapon="Mausolon (Atmosphere)" --attack=Auto --health=2000000 --armor=3000 --attack-distance=250 --runs=3
```

Under Grineer / 2,000,000 Health / 3,000 Armor / Realistic / `[0,5s)` / eight standard slots / Catalyst / up to three Forma / no Arcane, the three runs return the same legal 59/60, three-Forma build at 315,041.23 DPS (1,575,206.13 applied damage; 67 attacks; target survives). The optimizer evaluates 261 candidates per run. Exact scoring of 147 legal one-mod add/remove/replacement neighbors finds no improvement; the best is Parallax Scope → Magnetized Cycle at 308,465.67 DPS. The audit output distinguishes sourced per-attack falloff/hard caps from informational or conflicting range fields. This is profile-explicit Tenno-Hub model evidence only, not a matched Underframe score, global optimum, or gameplay result.

#### Mausolon readout repeatability and corrected distance audit (2026-11-22)

On the existing `Codex Mausolon Window DPS audit` page, the generic `Mausolon` Auto readout remained at 1,400m in a 1,400–2,800m slider range. The category-Arcane controls were enabled with Primary Bulwark at 500/500 and Secondary Outburst at 12/12, unlike the zero-slider fixture. Three standard Calculate DPS reads returned 86,957 / 1.15s / 4,762 raw + 0 DoT, 96,774 / 1.03s / 5,263 raw + 0 DoT, and 82,192 / 1.22s / 4,545 raw + 0 DoT. One Luck Averaged read returned 100,130 / 1.00s / 5,453 raw + 3 DoT. These n=3 and n=1 observations do not establish the distributions or repeatability. The page has no profile selector, but its association with the same captured Auto Build page and that page's 180 Auto / 72 radial stats make Atmosphere the best supported profile inference; the generic UI still does not state the internal profile. No Save action was used. Full state is recorded in `scripts/fixtures/underframeMausolonReadoutRepeatability.json`.

The same page was then reread after clearing both category sliders to zero, with no Save action. Standard Calculate DPS returned 14,606 / >5s / 793 raw +40 DoT, 20,339 / 4.92s / 1,084 +65, and 20,067 / 4.98s / 1,088 +48. Three Luck Averaged reads repeated 21,899 DPS and 1,174 raw +67 DoT per shot; the TTK display remained `? ttk`. The zero-slider Stats panel showed 48% critical chance, 5.29x critical multiplier, 26% status chance, 17.49 attack speed, 1.90 multishot, and 618.75 total Auto damage. The difference from the active-slider state confirms the page's sliders change its displayed weapon stats, but the generic page does not explain how these category controls are applied to Arch-Guns. The same-page 180 Auto / 72 radial source readout supports Atmosphere as a profile inference; the generic UI still lacks an explicit selector. The standard results vary across three reads; the repeated Luck Averaged value is a page-level observation, not proof of its seed policy or model semantics.

The helper audit had a distance omission: earlier `--distance` values set `targetDistanceMeters` (for range-gated mod conditions) but did not set `attackFalloffDistanceMeters` (for weapon falloff and hard hit caps). The corrected `scripts/auditMausolonAttackModeAlignment.ts` has explicit `--profile=Atmosphere|Archwing` selection and applies the requested physical distance to both fields. It also accepts `--health` and `--armor`; supplying `--armor` evaluates only that armor value, while omitting it retains the 3,000 / 500 / 0 matrix. With the captured eight-mod list at 2m Health / 3k Armor / Fully Stacked, the corrected linked/direct-only DPS is Atmosphere 300m 28,096.68 / 23,812.72; Atmosphere 301m and 1,400m 0 / 0; Archwing 1,400m 18,731.16 / 15,875.18; Archwing 2,100m 14,941.59 / 12,122.95; and Archwing 2,800m 7,848.01 / 5,099.33. Ballista Measure R3 extends Archwing's sourced endpoints by 20% to 1,680–3,360m. The 1,400m Underframe generic-profile read therefore has no profile-matched Tenno-Hub result: Atmosphere is out of range, while Archwing is a separate profile and its 300m source conflict remains unresolved.

For the zero-category-slider Underframe sample, the matched nominal target is Grineer / 100,000 Health / 3,000 Armor / 1,400m. The same-page 180 Auto / 72 radial source stats support Atmosphere as the profile inference, but the UI has no explicit profile selector and its 1,400m minimum is inconsistent with Atmosphere's 300m source cap. Under that inference, Tenno-Hub Atmosphere returns zero; Archwing is a separate alternative profile and scores 5,697.64 DPS (Realistic) and 18,731.16 DPS (Fully Stacked) with linked Auto radial damage against only the struck target. Its direct-only diagnostics are 4,774.87 and 15,875.18 DPS. Fully Stacked applies 93,655.80 damage in five seconds, below Tenno-Hub's 20,000 target-clipped DPS ceiling. Underframe's three standard zero-slider reads ranged from 14,606 to 20,339 DPS and its three Luck Averaged reads repeated 21,899 DPS. Its effective conditional-state sampling and raw/DoT score denominator remain hidden. The Underframe output at the inferred Atmosphere profile and 1,400m is a calculator/source conflict, not an accuracy or parity result; the Archwing score is not a matched alternative without an explicit profile setting.

Reproduce the target-matched matrix with `npx tsx scripts/auditMausolonAttackModeAlignment.ts --profile=Atmosphere --distance=1400 --health=100000 --armor=3000` and the same command with `--profile=Archwing`. Range-boundary controls are `--profile=Atmosphere --distance=300` / `301`; Archwing falloff controls are 1,400 / 2,100 / 2,800. This fixes the audit harness; production UI scoring already supplied `attackFalloffDistanceMeters`, and existing tests cover the Atmosphere cap and Archwing falloff. The readout is evidence about a UI calculator response only, not gameplay or simulator parity. The generic Underframe page cannot choose or reveal a profile, so an exact profile match remains unavailable through this saved page.

#### Fixed-window alternate-faction neighborhood follow-up (2026-11-22; bounded)

Seed `20261148` reran the 12-fixture full-pool `[0,5s)` corpus against two synthetic, unarmored target profiles, using Realistic state, eight standard slots, Catalyst, MR30, up to three Forma, and no Exilus or Arcane search. Each exact neighborhood enumerates all legal maximum-rank one-mod additions, removals, and replacements around the returned optimizer build. Shielded Corpus (2,000,000 Health + 2,000,000 Shields / zero Overguard and Armor) scored 3,846 legal neighbors with no improvements. Infested (10,000,000 Health / zero Shields, Overguard, and Armor) scored 4,021 with no improvements. The 10m Infested pool avoids a five-second target-health ceiling; the Corpus pool was selected so all fixture scores remain below its combined 4m pools.

The initial Corpus run exposed Arca Titron / Heavy Slam Attack at 274,749.64 DPS; an exact 427-neighbor audit found Shocking Touch → Primed Fury at 305,336.18. After that attack-speed alternative was reserved, the optimizer reached 305,336.18 but still missed Galvanized Elementalist → Melee Elementalist at 317,580.30. The refined result is capacity-legal at 56/60 with three Forma, repeated identically in three optimizer runs (317 exact refinement candidates per run); its exact 404-neighbor audit found no improvement. The Infested run found Kuva Ogris / Rocket Explosion at 197,530.25 DPS, with Nightwatch Napalm → Hellfire improving to 198,203.56. The optimizer now selects the legal 60/80, three-Forma Hellfire build; three runs repeat its score (397 refinement candidates per run), and the exact 450-neighbor audit found no improvement.

These misses refined the bounded `windowDps` shortlist: melee attack speed is separated from firearm/charge rate, second choices are reserved for multishot, critical, melee attack speed, and status families, standalone heat has its own incoming family, and proposals that remove a modeled weapon-specific damage effect receive priority in outgoing-slot alternatives. The additional proposal limits are fixed and the exact audits report stable results; this is not exhaustive multi-mod or Arcane search. Reproduce the corpora with `npx tsx scripts/auditFixedWindowDpsCorpus.ts --seed=20261148 --faction=Corpus --health=2000000 --shields=2000000 --armor=0 --runs=1` and the equivalent `--faction=Infested --health=10000000 --shields=0 --armor=0`. Reproduce the focused exact neighborhoods with `npx tsx scripts/auditFixedWindowDpsFullPool.ts --weapon="Arca Titron" --attack="Heavy Slam Attack" --faction=Corpus --health=2000000 --shields=2000000 --armor=0 --runs=3` and `npx tsx scripts/auditFixedWindowDpsFullPool.ts --weapon="Kuva Ogris" --attack="Rocket Explosion" --faction=Infested --health=10000000 --shields=0 --armor=0 --runs=3`.

This adds 7,867 exact legal one-mod neighbors across 24 fixtures with no improving moves under Tenno-Hub's deterministic scorer. It is common-model local-optimum evidence only: it does not establish Underframe objective parity, global optimizer quality, a multi-mod optimum, or gameplay accuracy. Underframe's private engine, website Luck Averaged condition history, and raw/DoT bucket semantics remain unresolved.

The shortlist refinement, regressions, and audit record were released in PR [#281](https://github.com/Appl3Tree/Tenno-Hub/pull/281), squash-merged as `17b2a1b6c9526f2884a86c11937f9f9bb9e2a18c`. GitHub reported no combined status checks or PR-triggered workflow runs; the Pages deployment was not independently verified.

#### Public Underframe Desktop wrapper and seed-policy audit (2026-11-22; bounded)

The public [Underframe Desktop repository](https://github.com/NevermindNilas/underframe-desktop/tree/fe38d07f3515a995a068015314ad85acc65bef61) makes the app wrapper inspectable, but its [README](https://github.com/NevermindNilas/underframe-desktop/blob/fe38d07f3515a995a068015314ad85acc65bef61/README.md#L60-L75) says the `core/` submodule contains the private damage engine and game data. Without that submodule, the public tests that require the core are skipped; the engine's internal random event resolution and output formulas cannot be audited from this repository.

The public [engine worker](https://github.com/NevermindNilas/underframe-desktop/blob/fe38d07f3515a995a068015314ad85acc65bef61/src/renderer/engine.worker.js#L66-L115) calls `seed_rng` before each `calculate_dps_wasm` trial. Its Auto Build scoring path sums one selected result property per successful seed: `avgDps`, `avgRawPerShot`, or `avgDotPerShot`. The Desktop Readout's [`SIM_SEEDS`](https://github.com/NevermindNilas/underframe-desktop/blob/fe38d07f3515a995a068015314ad85acc65bef61/src/renderer/model.js#L36) are fixed at `[1, 2, 3, 4, 5, 6, 7, 8]`; the [Readout controller](https://github.com/NevermindNilas/underframe-desktop/blob/fe38d07f3515a995a068015314ad85acc65bef61/src/renderer/controller.js#L440-L455) uses them for its displayed simulation. The [Auto Build search](https://github.com/NevermindNilas/underframe-desktop/blob/fe38d07f3515a995a068015314ad85acc65bef61/src/shared/auto-build.js#L491-L500) uses seeds 1..n when Luck Averaged is enabled and random seeds when disabled; its [post-search readout](https://github.com/NevermindNilas/underframe-desktop/blob/fe38d07f3515a995a068015314ad85acc65bef61/src/renderer/auto-build-job.js#L22-L53) again uses the fixed eight Readout seeds.

This is evidence about the Desktop wrapper at the cited commit, not proof that the website uses the same seed schedule or that either UI exposes the same settings. It does not reveal the private engine's per-run mechanics or bucket formulas. The variable standard Calculate DPS results observed on the website's Gram capture therefore remain website evidence; do not explain them using Desktop seed policy. Underframe website semantics and Tenno-Hub parity remain open.

#### Gram Prime calculator repeatability probe (2026-11-22)

The in-app browser replay opened the existing saved **Codex Matched Corpus Gram Prime** page and recalculated the saved Normal Attack / Lashing Tempest (Forward) / five-second / Grineer / 100,000 Health / 3,000 Armor / zero Shields / zero Overguard / zero-combo setup. The page showed 3/60 capacity with three Forma. No Save action was used.

| Standard Calculate DPS run | Average DPS | TTK | Average damage per shot |
| ---: | ---: | ---: | ---: |
| 1 | 40,890 | 2.45 s | 4,076 raw + 15,924 DoT |
| 2 | 49,816 | 2.01 s | 13,584 raw + 11,416 DoT |
| 3 | 49,816 | 2.01 s | 10,660 raw + 14,340 DoT |

Two separate Luck Averaged DPS recalculations both returned 46,237 DPS / 2.20 s and 9,781 raw + 13,954 DoT average damage per shot. The page initially retained a 62,279 DPS / 1.62 s Braton result until recalculation; that stale display was not treated as a Gram measurement.

This is a small repeatability probe, not a gameplay-accuracy finding. Standard runs varied in score/time and damage buckets; two runs matched score/time while their raw/DoT split differed. Luck Averaged repeated exactly twice, which is too few reads to establish its distribution or underlying condition semantics. Tenno-Hub's generic Gram Normal Attack does not reproduce Underframe's Lashing Tempest (Forward) stance sequence, so these readings are not a direct shared-objective score comparison. The Underframe Luck Averaged semantics, bucket attribution, and native melee sequence remain open under this issue.

#### Mod Builder range note checkpoint (2026-11-21; released and IAB verified)

The PR #194 release's distance input explained Mausolon Auto's profile-specific source values. Archwing text identified the listed 300m range and separate 1,400–2,800m falloff while leaving the hit cap unverified; Atmosphere text noted its 300m listing, absence of direct falloff, and informational handling. This was the pre-cap behavior and made no scoring change. IAB verified those then-deployed notes on `version=21e421b` at desktop and 390×844; the current D3-MOD-MAUSOLON-RANGE-CAP-001 follow-up updates the Atmosphere Auto/charged Laser notes and retains the Archwing conflict. Local TypeScript/production build, focused ESLint, and diff check passed for PR #194. No saved build was changed. PR [#194](https://github.com/Appl3Tree/Tenno-Hub/pull/194) merged as `21e421bed4ca5c4e13baec42356531fbc6cbca4a`; Pages run [#274](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/44905510158) succeeded. The IAB local port-80 site then served stale build `2bf6faea`, and the workspace preview on port 4173 was unreachable; deployed-browser QA superseded that local preview gap.

#### Common-model re-score of captured Underframe lists (2026-11-21)

The saved Underframe mod identities and ranks for Cedo, Lex Prime, Broken War, and Mausolon (Atmosphere) were re-scored with Tenno-Hub's same deterministic five-second `windowDps` objective used for its optimizer. Each case uses Grineer / 2,000,000 Health / 3,000 Armor / Realistic state / eight normal slots / Catalyst / MR30 / up to three Forma / no Exilus or Arcanes. No attack distance is supplied, so Tenno-Hub applies its full-damage profile default; spatial coverage is excluded, and Broken War is the generic Normal Attack without Underframe's Lone Vengeance sequence or combo growth. The target survives each window. This controls the model and target for the two Tenno-Hub lists, but does not match Underframe's native Luck Averaged state, target settings, distance behavior, or Auto Build objective.

| Captured list / attack | Captured list score | Tenno-Hub optimized score | Optimizer build capacity / Forma | Candidates / repeatability |
| --- | ---: | ---: | --- | --- |
| Cedo / Normal Attack | 10,592.48 DPS | 29,769.16 DPS | 58/60 / 3 | 349; same build and score in 3 runs |
| Lex Prime / Normal Attack | 6,623.68 DPS | 38,011.00 DPS | 60/60 / 3 | 373; same build and score in 3 runs |
| Broken War / Normal Attack | 1,669.32 DPS | 5,071.25 DPS | 60/60 / 2 | 193; same build and score in 3 runs |
| Mausolon (Atmosphere) / Auto | 8,546.40 DPS | 315,041.23 DPS | 59/60 / 3 | 245; same build and score in 3 runs |

Reproduce all four with `npx tsx scripts/compareUnderframeFixedWindowDps.ts --health=2000000 --armor=3000 --runs=3`; individual rows accept `--weapon="Cedo"`, `--weapon="Lex Prime"`, `--weapon="Broken War"`, or `--weapon="Mausolon (Atmosphere)"`. These large model-local score gaps mean the captured lists are not local optima under this Tenno-Hub objective. They do not mean the Underframe search lost the same objective: the native simulator is not observable, and Underframe's saved target/state and search configuration are not fully aligned to this scorer.

#### Mausolon target-health ceiling probe (2026-11-21)

Reproduce the Tenno-Hub side with `npx tsx scripts/compareUnderframeFixedWindowDps.ts --weapon="Mausolon (Atmosphere)" --health=100000 --armor=3000 --runs=1`. On Grineer / 100,000 Health / 3,000 Armor, the captured Underframe Auto list applies 42,732 damage during `[0,5s)`, or 8,546.4008 target-health-clipped DPS, with 67 attacks and no kill. The optimizer reaches 99,999.99999999999 applied damage (20,000 DPS, the maximum possible under this clipped objective) and reports a separate 1.440576s TTK diagnostic after 89 candidates; its result is legal at 60/60 with two Forma. The captured list is also legal at 58/60 with three Forma.

Underframe's native Auto Build reports 21,760 `Best DPS` for this same nominal target and captured list. Since this exceeds the 20,000 DPS ceiling of Tenno-Hub's target-health-clipped objective, the displayed scores cannot be treated as the same metric. The public Underframe port notes describe mean `avgDps` over seeded five-second runs, but its private damage engine prevents verifying its target-death handling, denominator, or exact score semantics. This is evidence of an objective boundary, not proof of post-death damage or a Tenno-Hub win/loss. Keep the Underframe objective, profile-range behavior, condition mixture, and raw/status attribution gaps open.

The public Underframe Featured Builds page for Larkspur was also inspected read-only. Its listed Larkspur Prime build has zero Forma and is over capacity at −15/60; the page provides no calculator. It cannot serve as a legal Auto Build comparison. Do not use Copy & Edit/Test or alter saved builds.

Next, obtain direct gameplay verification for Atmosphere's sourced 300m cap and resolve Archwing Auto's conflicting 300m/falloff fields, then compare damage buckets and cadence under a known condition/proc state if Underframe exposes one. Preserve the standard-versus-Luck-Averaged distinction. Continue the independent captured-list one-mod neighborhood gap and representative `windowDps` corpus. Until the profile range, mechanics, and stochastic semantics are attributed, `windowDps` remains a deterministic applied-damage proxy inspired by Underframe's documented metric, not verified score parity.


## D3-OPT-SEED-CORPUS-003 — third seeded 12-case Expected TTK audit (2026-11-18; bounded)

Reproduce with:

- `npx tsx scripts/auditExpectedTtkCorpus.ts --seed=20261145`
- `npx tsx scripts/auditExpectedTtkPairSample.ts --seed=20261145 --samples=1024`

Both runs use Grineer, 100,000 Health, 0 Shields, 0 Overguard, 3,000 Armor, Realistic state, eight main slots, Catalyst, MR30, and up to three Forma. Arcane and Exilus optimization are disabled. The first script exactly scores every legal one-mod add/remove/replacement from the optimizer result. The second samples 1,024 legal maximum-rank two-out/two-in replacements per fixture, without replacement after legality checks.

Seeded selections were Tenet Envoy / Rocket Explosion, Corvas Prime / Charged Shot, Verglas Prime / Normal Attack, and Arca Titron / Heavy Slam Attack, alongside the same eight fixed anchors used by the prior seeded corpus.

| Fixture | Selection | Exact legal one-mod neighbors | Optimizer Expected TTK |
| --- | --- | ---: | ---: |
| Braton Prime / Normal Attack | Fixed | 234 | 2.119475 s |
| Cedo / Normal Attack | Fixed | 412 | 2.610966 s |
| Laetum / Normal Attack | Fixed | 292 | 1.886792 s |
| Soma Prime / Fully Spooled | Fixed | 420 | 1.719111 s |
| Broken War / Normal Attack | Fixed | 365 | 8.000000 s |
| Kuva Nukor / Normal Attack | Fixed | 359 | 1.440000 s |
| Nataruk / Perfect Shot | Fixed | 396 | 1.300000 s |
| Torid / Grenade Impact | Fixed | 238 | 4.723058 s |
| Tenet Envoy / Rocket Explosion | Seeded | 419 | 2.536462 s |
| Corvas Prime / Charged Shot | Seeded | 175 | 1.538462 s |
| Verglas Prime / Normal Attack | Seeded | 250 | 2.807018 s |
| Arca Titron / Heavy Slam Attack | Seeded | 299 | 1.559150 s |

None of the 3,859 exact legal one-mod neighbors improved its optimizer baseline. The pair audit scored 12,288 legal sampled replacements after inspecting 25,088 raw tuples; none beat its optimizer baseline. The one-mod script's fixture `elapsedMs` values sum to about 114.2 seconds for this serial audit; this is neighborhood-audit time, not user-facing optimizer latency.

This is bounded model-local evidence from one faction, target pool, and conditional state. The pair sweep is sampled rather than exhaustive. It does not prove global optimality, gameplay accuracy, or Underframe parity, and does not cover Arcane/Exilus optimization. The new seeded selections broaden the corpus to explosive, Archgun, companion, and heavy-melee attacks.


## D3-OPT-UNDERFRAME-AUTOBUILD-CORPUS-001 -- Braton Prime and Gram Prime captures (2026-11-18; bounded comparison)

Two new Underframe builds were created in the integrated browser: [Codex Matched Corpus Braton Prime](https://www.underframe.site/Codex-Matched-Corpus-Braton-Prime) and [Codex Matched Corpus Gram Prime](https://www.underframe.site/Codex-Matched-Corpus-Gram-Prime). Both use Normal Attack, a single Grineer target at 100,000 Health / 3,000 Armor / zero Shields / zero Overguard, headshots off, zero external combo, no external statuses or buffs, Catalyst installed, Exilus and Arcanes off, and a five-second standard simulation. The Braton common-model pair uses Realistic state; the Gram pair uses Initial state, matching the prior Gram audit. Read scores only within their row.

Underframe Auto Build used Copy of Default: 28 CPU cores, GPU off, five-second Auto Build simulation, Sample Size Multiplier 3, final refinement on with sample size 200, Luck Averaged on, Elemental Candidates and Cost Control on, and maximum three Forma. Raw-damage/status goals and blacklist options were off. In both cases the list returned by Auto Build was over capacity before any polarity changes: Braton at -21/60 with zero Forma and Gram at -29/60 with zero Forma. I then clicked Auto Polarize manually. The Braton page showed 0/60 capacity with three Forma; the Gram page showed 3/60 with three Forma. Thus these are usable captured lists after a separate legality step, not proof that Auto Build itself returned a legal polarity plan.

The captured Braton list was Malignant Force R3, High Voltage R3, Rime Rounds R3, Galvanized Chamber R10, Vile Acceleration R5, Galvanized Aptitude R10, Vital Sense R5, and Primed Bane of Grineer R10. The captured Gram list was Rending Crane, Volcanic Edge R3, Galvanized Steel R10, Primed Smite Grineer R10, Primed Pressure Point R10, Berserker Fury R5, Galvanized Elementalist R10, Molten Impact R5, and Condition Overload R5. The standard Calculate DPS button was run after Auto Polarize; its results are separate from the Luck Averaged Auto Build objective.

| Underframe capture | Standard Calculate DPS, 5-second simulation | Underframe UI capacity after manual Auto Polarize |
| --- | ---: | ---: |
| Braton Prime | 3,413 raw + 159 DoT average damage/shot; 66,667 DPS; 1.50 s TTK | 0/60; 3 Forma |
| Gram Prime | 15,880 raw + 9,120 DoT average damage/shot; 49,816 DPS; 2.01 s TTK | 3/60; 3 Forma |

The reproducible runners scripts/compareUnderframeBratonAutoBuild.ts and scripts/compareUnderframeGramAutoBuild.ts score each fixed capture and a current Tenno-Hub Expected TTK build with Tenno-Hub's finite evaluator. The common target pools are the same. Rending Crane is counted for Gram capacity only; Tenno-Hub does not simulate the Underframe Lashing Tempest (Forward) melee hit sequence.

| Weapon / state | Underframe captured list, scored by Tenno-Hub | Tenno-Hub optimizer | Captured list capacity in common planner | Optimizer capacity | Exact refinement candidates |
| --- | ---: | ---: | ---: | ---: | ---: |
| Braton Prime / Realistic | 2.197561 s / 45,505.0 DPS / 41 attacks | 2.119475 s / 47,181.5 DPS / 51 attacks | 60/60; 3 Forma | 59/60; 3 Forma | 301 |
| Gram Prime / Initial | 11.000 s / 9,090.91 DPS / 9 attacks | 6.000 s / 16,666.67 DPS / 8 attacks | 57/60; 3 Forma | 56/60; 1 Forma | 277 |

The Gram common-model timing is not an objective-parity result: the captured Underframe build uses a stance hit sequence which Tenno-Hub's Normal Attack encounter does not represent. The native Underframe values above also come from its standard Calculate DPS simulator, not a reported Auto Build candidate score. These two weapon classes establish repeatable UI captures and bounded shared-model scoring only; they do not establish optimizer parity, general quality, or live-game accuracy. Repeat runs, more weapon categories, matched Arcane/conditional cases, and browser/mobile performance remain open.

PR [#163](https://github.com/Appl3Tree/Tenno-Hub/pull/163) was squash-merged as `b039dbd8f4b0c06dd89620e85dfb6eb0bdb7cc8e`; Pages deployment [run #243](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/44275755814) succeeded.

## D3-OPT-UNDERFRAME-BRATON-CURRENT-REPLAY-001 — current saved-build and condition-matched replay (2026-11-22; bounded, optimizer follow-up open)

The in-app browser reopened the existing `Codex Matched Corpus Braton Prime` page read-only. It remains Braton Prime / Normal Attack / Grineer / 100,000 Health / 3,000 Armor / zero Shields and Overguard / three Forma / no Arcane. Its visible Galvanized Chamber and Galvanized Aptitude condition controls were at 5/5 and 2/2, respectively. No build edit or Save action was used.

Three fresh standard `Calculate DPS` runs returned 78,947 DPS / 1.27s TTK, then 62,500 DPS / 1.60s twice. Their displayed average-shot rows also differed (4,074 raw + 93 DoT; 3,251 + 82; 3,286 + 48). This confirms that one ordinary simulator run is not a stable comparator for this status-heavy build. Three `Luck Averaged DPS` runs repeated 62,279 DPS / 1.62s and 3,237 raw + 92 DoT average damage per shot. The prior 2026-11-18 standard-calculator capture of 66,667 DPS / 1.50s did not reproduce in this session; retain it as a historical observation.

`scripts/compareUnderframeBratonAutoBuild.ts` now accepts `--state=realistic` or `--state=fullyStacked`; default remains `realistic`. The `fullyStacked` run matches the page's visible Galvanized stacks:

| Braton Prime, 100k Health / 3k Armor | Captured Underframe list scored by Tenno-Hub | Tenno-Hub optimizer |
| --- | ---: | ---: |
| Realistic | 2.197561s / 45,505.0 DPS / 41 attacks | 2.119475s / 47,181.5 DPS / 51 attacks |
| Fully Stacked | 1.593232s / 62,765.5 DPS / 30 attacks | 1.610498s / 62,092.6 DPS / 28 attacks |

Both lists are legal within the three-Forma cap: the captured list uses 60/60 capacity and the optimizer list 59/60. In the Fully Stacked common model, the saved capture beats the current optimizer result by 0.01727s (about 1.1%). An exact full-catalog one-mod neighborhood scores 216 legal neighbors and finds no improvement over the optimizer result, so the observed better capture is a coordinated multi-mod basin rather than a single replacement. The native Luck Averaged result (1.62s) is close to the Tenno-Hub Fully Stacked captured-list result (1.593s), but the simulators' scoring implementations are not identical; this is a bounded alignment diagnostic, not parity or gameplay evidence.

Validation: both runner states repeated deterministically; unsupported `--state=other` exits with a validation error; the exact one-mod audit reproduced the optimizer baseline and found no better one-mod neighbor. Focused TypeScript, ESLint, and `git diff --check` pass. This script/docs-only update has no app build or full-suite run. The next benchmark step is to inspect a bounded pair neighborhood around the Fully Stacked optimizer output and determine whether multi-mod refinement can close the 1.1% gap. Keep the larger Underframe comparison corpus open.

## D3-OPT-UNDERFRAME-RESULT-RETENTION-001 — saved-page result retention and legal Perigale exclusion (2026-11-22; bounded, read-only)

When the in-app browser navigated from the Cedo readout to the saved `Codex Matched Corpus Braton Prime` page, the selected weapon and saved configuration were Braton Prime / Normal Attack / Grineer / 100,000 Health / 3,000 Armor / zero Shields and Overguard / 5 seconds, but the result panel still showed the preceding Cedo Luck Averaged result (53,070 DPS, 4,096 raw and 0 DoT average damage per shot, and unknown TTK). After clicking `Calculate DPS` on the Braton page, its result panel changed to 64,516 DPS, 3,419 raw + 29 DoT average damage per shot, and 1.55s TTK. The visible Galvanized Chamber and Galvanized Aptitude controls were 5/5 and 2/2.

On the next navigation to the saved `Codex Matched Corpus Gram Prime` page, the result panel retained the Braton result until `Calculate DPS` was pressed again. The saved Gram setup was Normal Attack / Lashing Tempest (Forward) / Grineer / 100,000 Health / 3,000 Armor / zero Shields and Overguard / 5 seconds, with Galvanized Steel and Galvanized Elementalist at 4/4. Recalculation returned 49,816 DPS, 6,937 raw + 18,063 DoT average damage per shot, and 2.01s TTK.

On the saved `Codex Perigale Prime build-quality sample` page, the result panel then retained the Gram readout until recalculation. The Perigale setup showed Normal Attack / Grineer / 83,818 Health / 2,700 Armor / zero Shields and Overguard / 5 seconds / 300m, with Galvanized Chamber 5/5 and the visible Primary Overcharge 350/350, Scope 0, and Perigale Prime Passive 0 conditionals. Its eight installed mods occupied `-20 / 60` capacity with zero Forma. One standard `Calculate DPS` read returned 2,514,540 DPS, 41,909 raw + 0 DoT average damage per shot, and 0.03s TTK. This page is over capacity and the score is excluded from valid-build comparisons; it is not attributed to an Auto Build operation. None of these saved pages was edited or saved.

These three page transitions confirm that a displayed result can persist while navigating between saved pages; an Underframe number should only be attributed to the currently selected weapon after recalculation. This does not identify the simulator formula or invalidate the Cedo, Braton, or Gram results, each of which was calculated on its own page. The Gram result is one standard read of a stance sequence that Tenno-Hub does not model, and the Perigale page is illegal at its displayed capacity; neither is an objective-matched parity result or gameplay validation.

## D3-OPT-UNDERFRAME-CEDO-PASSIVE-ALIGNMENT-001 — isolate the Cedo passive condition (2026-11-22; bounded, scratch copy only)

On `/Codex-Matched-Corpus-Cedo-Copy`, the Tenno-Hub Fully Stacked optimizer list was held at Cedo / Normal Attack / Grineer / 2,000,000 Health / 3,000 Armor / five seconds. The installed list was Frigid Blast R3, Galvanized Hell R10, Toxic Barrage R3, Scattering Inferno R3, Repeater Clip R5, Atomic Fallout R3, Shotgun Barrage R5, and Galvanized Savvy R10. The visible Underframe-specific Cedo passive checkbox was initially off. Its Luck Averaged read returned 55,463 DPS and 4,874 raw + 7 DoT average damage per shot. Toggling only the Cedo passive on changed one subsequent read to 84,391 DPS and 7,418 raw + 10 DoT per shot, a 52.2% increase.

Tenno-Hub's deterministic Fully Stacked fixed-window score for the same list and target is 79,578.45 DPS / 397,892.24 damage over `[0,5s)`, across 56 attacks; the target survives. With the Underframe passive enabled, its one Luck Averaged read is 6.0% above that score. This isolates a material condition mismatch in the earlier passive-off comparison. The earlier 55,463 DPS result must not be treated as a matched comparison to the Tenno-Hub result. One read per toggle state and the different scoring implementations are insufficient to establish simulator parity, objective parity, or gameplay accuracy.

The Tenno-Hub source path already represents Cedo and Cedo Prime Normal Attack's +0.6 intrinsic damage per unique status as an additive-base passive in `src/domain/catalog/weaponCatalog.ts`; `src/domain/logic/targetDamage.ts` applies it from the active direct/unique status types. No product-code change is justified by this condition mismatch alone. Reopen if repeated, explicitly passive-on matched reads contradict the current encounter model.

After this measurement, a separate attempt to reconstruct the Tenno-Hub Realistic optimizer list on the scratch copy became incomplete and over capacity; the Underframe mod search did not return Vigilante Armaments. No score from that partial state is retained. No Save action was used, and the original saved Cedo capture was not touched. The local Build Planner URL loaded in the IAB at `version=2bf6faea`, but this is an older bundle and does not verify the current source revision. Reopen the comparison only with repeatable passive-on/off reads and a complete legal list; keep area and simulator-parity claims out of scope.

Release reference: PR [#291](https://github.com/Appl3Tree/Tenno-Hub/pull/291) squash-merged as `3a1559d770104dcec269a51c65db2b02b5683451`. Documentation-only; no app deployment applies.

## D3-OPT-UNDERFRAME-BRATON-LIVE-001 — current production Braton Prime replay (2026-11-18; bounded browser comparison)

The integrated in-app browser opened the cache-busted production Build Planner at `https://appl3tree.github.io/Tenno-Hub/?probe=20261118-0728&version=0cd9e12`. It loaded the current hashed Build Planner bundle, selected Braton Prime / Normal Attack, and optimized for Expected TTK. Inputs were Grineer damage modifiers with custom current pools of 83,818 Health, 0 Shields, 0 Overguard, and 2,700 Armor; Realistic conditional state; zero assumed headshot share; no external status stacks, buffs, or nearby enemies; a Catalyst; weapon rank 30; and a maximum of three Forma. Primary Bulwark was enabled at the Underframe page's 500/500 cap and mapped to 1,500 Warframe Armor in Tenno-Hub. There was no Exilus or Arcane selected. Tenno-Hub displayed a capacity-valid eight-slot build at 60/60 capacity and three Forma.

The returned mods/ranks were Malignant Force R3, Rime Rounds R3, Thermite Rounds R3, Vile Acceleration R5, Primed Bane of Grineer R10, Galvanized Chamber R10, Galvanized Aptitude R10, and Vital Sense R5. The “Why This Build” panel confirmed Expected TTK, the custom current-level Grineer pool, Realistic state, and a finite expected encounter of 1.70 s across 32 attacks at 49,214.7 modeled damage/s (82,077 direct plus 1,741 status damage).

The integrated browser then opened Underframe's existing `/Braton-Prime-benchmark-Copy` build. It showed the same raw target pools and faction, 500/500 Primary Bulwark, zero Shields/Overguard, no external statuses/buffs, headshots disabled, three Forma, and the saved eight-mod list Amalgam Serration R10, Bane of Corpus R5, Bane of Grineer R5, Bane of Infested R5, Malignant Force R3, Rime Rounds R3, Thermite Rounds R3, and Vital Sense R5. The target level label was 145; Tenno-Hub used custom current pools without level scaling. Underframe's Auto Build configuration was `Copy of Default`: 28 CPU cores, GPU off, five-second simulation, Sample Size Multiplier 3, Final Refinement on with sample size 200, Luck Averaged on, Elemental Candidates and Cost Control on, and a three-Forma maximum. It reached Step 4 refinement and returned to idle with the visible mod list unchanged and no result panel. Thus this replay yielded no verified Underframe Auto Build winner.

Underframe's standard `Calculate DPS` button was then run on that unchanged saved list. It showed 1,628 raw + 277 DoT average damage per shot, 18,354 Average DPS, and 4.57 s TTK. The saved list contains Bane mods for Corpus, Grineer, and Infested; those distinct mods can coexist, and the current build is capacity-valid (3 capacity remaining with three Forma). For this Grineer target, only Bane of Grineer matches. The displayed score is recorded as UI behavior on the unchanged saved list, not as a new Auto Build candidate.

| Rendered outcome | Model/objective | Displayed result | Build status |
| --- | --- | ---: | --- |
| Tenno-Hub Auto Optimize | Finite expected encounter / Expected TTK | 1.70 s; 49,214.7 modeled damage/s | 8/8 slots; 60/60 capacity; 3 Forma |
| Underframe saved copy after Auto Build returned idle | Standard Calculate DPS on the unchanged saved list | 4.57 s TTK; 18,354 Average DPS | Pre-existing capacity-valid list; only one Bane matches Grineer; no optimizer winner |

This is not an objective-matched optimizer comparison: Underframe's Auto Build config had Luck Averaged enabled, but the run exposed no candidate or score, while the 4.57 s number came from its standard Calculate DPS button on the old saved list. The simulators also differ. No Underframe winner, general parity, or gameplay-accuracy claim is made. This is a production UI workflow and model-output smoke result for one custom single-target scenario.

### Stale production lazy-chunk observation and recovery (2026-11-18)

An existing tab at `?version=4aa30b8` and a newly opened unversioned tab failed to load the Build Planner route and requested the missing hashed chunk `BuildPlanner-sNBsZINI.js`; a direct request returned 404. This reproduced a stale HTML/client-to-removed-chunk mismatch in one browser session. PR [#160](https://github.com/Appl3Tree/Tenno-Hub/pull/160) adds a pre-mount listener for Vite `vite:preloadError`: it stores a per-build retry marker in session storage, reloads once, and allows a repeated failure or blocked storage to reach the existing error boundary. Focused coverage passes 3/3; app/node TypeScript checks, a production Vite build, focused ESLint, and `git diff --check` pass. After merge, a fresh cache-busted production page at `version=c643cda` rendered the Build Planner. This confirms the merged bundle is live; it does not establish the cache-header/old-chunk retention cause, broad prevalence, or recovery behavior for tabs already running older JavaScript.

## D3-OPT-UNDERFRAME-GRAM-SLOT-FAMILY-001 — Gram Prime family-dependent Expected TTK replacements (2026-11-18; released)

A Gram Prime / Normal Attack neighborhood audit exposed a full-pool shortlist miss under Grineer, 100,000 Health / 3,000 Armor, Initial state, eight slots, Catalyst, and at most three Forma. Rending Crane R3 is included as an extra capacity slot; the finite encounter scorer does not model the Underframe Lashing Tempest hit sequence.

The prior Tenno-Hub build scored 8.0 s Expected TTK and contained Lasting Sting. Exact scoring found that replacing Lasting Sting with True Steel produced a legal 6.2258065 s build. A second exact neighbor replaced Condition Overload with Primed Pressure Point and reached 6.0 s. The optimizer now retains the original 40-proposal exact shortlist and appends at most eight proposals that introduce an outgoing effect family not yet represented for a shortlisted incoming mod. This leaves the established shortlist intact while covering interactions such as critical chance replacing status-duration utility and base damage replacing conditional status damage.

The reproducible audit is `npx tsx scripts/auditExpectedTtkSlotFamilyNeighborhood.ts`. Its 62 eligible full-pool candidates are filtered to parsed, faction-compatible damage/performance records and omit flawed variants when a standard family member exists. The stable result contains Primed Fury R10, Primed Smite Grineer R10, Virulent Scourge R3, Vicious Frost R3, Volcanic Edge R3, True Steel R5, Organ Shatter R5, and Primed Pressure Point R10. It scores 6.0 s / 16,666.67 DPS, is capacity-valid at 56/60 with one Forma, and evaluates 277 exact refinement candidates per run. Across three Windows x64 runs, the median optimizer time was 2.158 s and the maximum was 2.548 s. Exact scoring of 398 legal one-mod removals/replacements around the final build found no improvement.

The integrated Underframe replay used Gram Prime / Normal Attack, Rending Crane R3, Lashing Tempest (Forward), Grineer / 100,000 Health / 3,000 Armor, zero Shields/Overguard, zero initial combo, no external statuses/buffs, and headshots disabled. Auto Build used the default-derived 28-core, GPU-off, five-second, three-sample configuration with refinement size 200, Luck Averaged and Elemental Candidates enabled, Cost Control enabled, and a three-Forma limit. It returned Rending Crane, Voltaic Strike R3, Galvanized Steel R10, Primed Smite Grineer R10, Primed Pressure Point R10, Primed Fury R10, Condition Overload R5, Galvanized Elementalist R10, and Quickening R3, but reported −19/60 capacity and zero Forma. The returned list is therefore illegal. Underframe displayed 56,627 DPS / 1.77 s standard TTK and 69,961 DPS / 1.50 s Luck Averaged TTK; those native results do not establish a comparable optimizer outcome.

Validation on the isolated source snapshot passes: optimizer test file 147/147; full serial suite 809/809 across 53 files; TypeScript and production build; source validation; prerequisite audit (162 entries, no unresolved references or cycles); mod-effect audit (694 weapons / 600 eligible records / 491 parsed / 109 without parsed effects / 71 review candidates / 18 partially parsed / 53 fully unparsed / zero weapon pools without parsed damage); focused ESLint; and `git diff --check`. Vite retains its existing large-chunk warning.

This is one bounded model-local neighborhood, not global/joint optimality, Underframe parity, gameplay accuracy, or an evaluation of Underframe's illegal build. Tenno-Hub does not model the Underframe Lashing Tempest sequence for this comparison, and no fresh Tenno-Hub browser QA was performed. Reopen if a legal exact one-mod neighbor improves the returned build, the capacity/Forma limits fail, a targeted regression fails, or repeated timing evidence shows an unacceptable search cost. Implementation source commit `8999844e82fcf0bed322d0445520e5d7f195531f` was squash-merged by PR [#157](https://github.com/Appl3Tree/Tenno-Hub/pull/157) as `232123be1cecc80c86e8999c54b77fa3c46c3939`; Pages deployment [run #237](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/44257208533) succeeded.

## D3-ATTACK-MODEL-TORID-CLOUD-001 — bounded single-target impact and Poison Cloud sequence (2026-11-17; released)

The current [Torid Wiki page](https://wiki.warframe.com/w/Torid) describes the Grenade Impact's Poison Cloud as a 3 m, 10-second effect with 40 Toxin damage at one tick per second. The cloud attaches to enemies struck by the grenade, and multiple clouds stack. The current [Damage over Time Wiki page](https://wiki.warframe.com/w/Damage_over_Time#Weapons) lists Torid Poison Cloud as ten ticks over ten seconds with a one-second delay, establishing ticks at +1s through +10s. The Torid page also documents the attached-target exception for Galvanized Aptitude's cloud damage.

The user approved a bounded single-target sequence. The Grenade Impact attack now links to a Poison Cloud component profile built with the selected weapon/mod configuration. Finite encounter scoring schedules ten component hits for the directly struck target, permits cloud sequences from separate impacts to overlap, and carries their direct/status damage through the existing encounter scheduler. Fast Scaling/Burst scoring includes the steady-state attached-cloud contribution. The standalone Poison Cloud row is identified as a component and withheld from independent direct-hit/encounter scoring and Auto Optimize.

The finite model assumes each modeled grenade directly hits one stationary target and that the target receives its full attached cloud sequence. It does not estimate projectile travel, missed shots, moving targets, cloud attachment to other enemies, area coverage, or damage to nearby targets. This is a bounded supported-target sequence, not a general spatial AoE model.

The full-pool Torid / Grenade Impact Expected TTK regression uses Grineer, 100,000 Health / 3,000 Armor, Realistic state, eight main slots, Catalyst, and up to three Forma. With the linked cloud model, Auto Optimize returns a capacity-legal build containing Rime Rounds, Malignant Force, Wildfire, Radiated Reload, Serration, Galvanized Chamber, Vile Acceleration, and Galvanized Aptitude. Its independent finite Expected TTK is 4.7230576 s. The pre-existing 10.0000 s Torid pair-audit result used an impact-only scoring model; these results are not comparable, and the prior exhaustive pair search has not been rerun with the linked cloud sequence. No broader optimizer-quality gain is claimed.

Validation in the isolated snapshot: Torid-specific catalog, damage, target encounter, and optimizer regressions pass; app/node TypeScript checks pass; `npm run validate:sources` passes; focused ESLint passes; production `vite build` passes with the existing large-chunk warning; and the serial full suite passes 808 tests across 53 files. The default parallel Vitest fork pool hit sandbox `EPERM` starting one worker; the serial retry passed. After the final render-only control change, app TypeScript, focused ESLint, and production build pass. The 572px integrated-browser smoke check verifies the component warning, disabled Optimize Build control for Poison Cloud, re-enabled control on Grenade Impact, and linked-tick math trace; the layout has no observed overlap. The full test suite was not rerun after that one-line render change. A 13-file CRLF/trailing-whitespace audit found no mixed line endings or trailing whitespace; `git diff --check` is unavailable because this isolated snapshot has no `.git` metadata. PR [#153](https://github.com/Appl3Tree/Tenno-Hub/pull/153) was squash-merged as `7cc46805fcd5b675068d552dc4320d194379b186`; Pages deployment [run #233](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/44242613018) succeeded. Objective-matched Underframe comparison, full browser workflow, and live-game validation remain pending.

Reopen if an authoritative source contradicts the tick timing/attachment/stacking mechanics, a regression changes the directly struck-target sequence, or browser review reveals that the component boundary is unclear. This bounded mechanic is released. The previous impact-only pair audit is not comparable to the linked-cloud score; rerun the bounded neighborhood if stronger optimizer-quality evidence is needed.

## D3-OPT-TORID-POST-CLOUD-001 — post-release neighborhood and Underframe checks (2026-11-17; bounded audit complete)

After the linked Poison Cloud model shipped, the seeded 12-case Expected TTK corpus was rerun with `npx tsx scripts/auditExpectedTtkCorpus.ts --seed=20261144`. All cases use Grineer, 100,000 Health / 3,000 Armor, Realistic state, eight main slots, Catalyst, MR30, up to three Forma, no Arcane or Exilus optimization, and exact finite Expected TTK for every legal one-mod add/remove/replacement from the optimizer baseline.

| Weapon / attack | Exact legal neighbors | Optimizer / best neighbor TTK |
|---|---:|---:|
| Braton Prime / Normal Attack | 234 | 2.1194748 s |
| Cedo / Normal Attack | 412 | 2.6109661 s |
| Laetum / Normal Attack | 292 | 1.8867925 s |
| Soma Prime / Fully Spooled | 420 | 1.7191106 s |
| Broken War / Normal Attack | 365 | 8.0000000 s |
| Kuva Nukor / Normal Attack | 359 | 1.4400000 s |
| Nataruk / Perfect Shot | 396 | 1.3000000 s |
| Torid / Grenade Impact | 238 | 4.7230576 s |
| Kuva Ogris / Rocket Explosion | 450 | 2.0000000 s |
| Mausolon / Charged Shot Explosion | 163 | 1.0526316 s |
| Verglas Prime / Normal Attack | 250 | 2.8070175 s |
| Arca Titron / Heavy Slam Attack | 299 | 1.5591503 s |

The 3,878 legal neighbors tied or lost; no one-mod improvement was found. The earlier same-seed table records Torid under the impact-only model and must not be compared with this linked-cloud result.

The exact audit runner also accepts `--arcane=<name> --warframe-armor=<value>` to hold a selected weapon Arcane while scoring the neighborhood. For Torid / Grenade Impact with Primary Bulwark R5 (+500%, using 1,500 Warframe Armor), it selected a capacity-legal eight-mod build with three Forma at 2.4561404 s Expected TTK. Exact scoring found no improvement among 236 legal one-mod add/remove/replacement neighbors with that Arcane fixed. This is a one-build local check, not a joint mod/Arcane neighborhood or global optimum. Reproduce with:

```sh
npx tsx scripts/auditExpectedTtkFullPool.ts --weapon=Torid --attack="Grenade Impact" --state=realistic --arcane="Primary Bulwark" --warframe-armor=1500
```

A single captured Underframe fixture is documented in [docs/UNDERFRAME_COMPARISON.md](docs/UNDERFRAME_COMPARISON.md). Its native 5-second custom combined-mode readout and Tenno-Hub's linked-sequence finite evaluator differ, so the observed values are not a direct parity test. This is bounded model-local neighborhood evidence plus one controlled UI fixture, not global quality, gameplay accuracy, or broad Underframe comparison.

## D3-MOD-SET-NIRA-SLAM-001 — Nira melee Slam Damage integration (2026-11-17; merged)

The current [Nira’s Set Wiki page](https://wiki.warframe.com/w/Nira%27s_Set) documents +150% Slam Damage per set piece and a three-piece maximum. The planner counts canonical Nira identities at every rank, combines selected melee pieces with a saved 0–2 distinct external Warframe-piece count, and caps the total at three. The bonus is active only on catalogued melee attacks marked as slam attacks. It adds to the Slam Damage category, including Seismic Wave, and reaches the calculator, status seeds, finite Expected TTK, and Auto Optimize.

A catalog regression covers Nira’s Contempt on compatible Whips; math regressions cover the cap, additivity, status-seed scaling, and non-slam/non-melee boundaries. The optimizer regression exercises Nira’s Contempt through candidate selection and finite scoring. Progress Pack coverage checks that the external count survives save/restore. No standalone benchmark was run, and no quality or performance gain is claimed.

Before the final UI gate correction, validation passed: 803 tests / 53 files; app/node TypeScript checks; production build; source validation; prerequisite audit (162 entries with no unresolved references/cycles); and mod-effect coverage audit (694 weapons / 600 eligible mods / 491 parsed / 109 without parsed effects / 71 review candidates / 18 partial / 53 fully unparsed / zero weapon pools without parsed damage). After the correction, app TypeScript and focused ESLint pass. PR #152 was squash-merged as f50a4143c0a15ee217c4358b0ac19d2845b22a01; Pages deployment was not independently confirmed. Vite reports its existing large-chunk warning.

This remains bounded mechanic and integration coverage. A 572px integrated-browser smoke check verifies the control and the active/inactive trace boundary, but not full browser workflow usability or physical mobile behavior. This does not establish Underframe parity, broad optimizer quality, cold/mobile performance, or live-game accuracy. Slam geometry/falloff and uncatalogued attacks remain outside the modeled result.
## D3-MOD-ONKILL-EXPLOSION-BOUNDARY-001 — unsupported on-kill area effects (2026-11-17; released)

A local scan of the checked-in WFCD `external/warframe-items/raw/Mods.json` snapshot identified Entropy Detonation and Amalgam Furax Body Count as additional on-kill area-effect candidates. Runtime inspection showed their kill explosions/staggers are not parsed as damage effects, and the existing Auto Optimize unmodeled-effect gate excludes them. Amalgam Furax Body Count's supported secondary Fire Rate and combo-duration stats can still be shown to manual builds; Auto Optimize skips the whole mod rather than partially scoring its unsupported kill effect.

The change adds explicit all-rank limitation warnings and regressions for both mods. The Amalgam regression also verifies that its parsed non-damage stats do not cause partial optimizer selection. No explosion or area-effect damage was added to calculator, finite encounter, or optimizer scoring. Implementation commit `584b132b74b541c97f602f99efe602d83f24c181` shipped in PR [#146](https://github.com/Appl3Tree/Tenno-Hub/pull/146), squash-merged as `c947bdbb413a9b2da05244b6aee56e500c7c8e4d`; Pages deployment [run #227](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/44191032338) succeeded.

Validation in the isolated clean snapshot: `buildOptimizer.test.ts` 144/144; focused ESLint; `npm run build` (existing Vite large-chunk warning); and `npm run audit:mod-effect-coverage` (694 weapons / 599 eligible mod records / 490 parsed / 109 without parsed effects / 71 review candidates / 18 partial / 53 fully unparsed / zero weapon pools without parsed damage). The full test suite was not rerun. The dirty primary checkout was left untouched.

This pass did not open current Wiki pages. The trigger, attribution, radial damage, target selection, falloff, line of sight, and chain behavior are not established here. Keep both effects unscored and excluded until current authoritative sources support a complete model; do not treat the catalog text as mechanic validation. No browser, live-game, or Underframe validation is claimed.

## D3-MOD-ONKILL-SOURCE-CLARITY-001 — source-backed warnings and Wiki links (2026-11-17; released)

The current [Entropy Detonation Wiki page](https://wiki.warframe.com/w/Entropy_Detonation) says the explosion triggers only on a Ground Finisher kill, combines rank-scaled flat Blast damage with a percentage of enemy Max Health, uses the selected rank's radius, and requires line of sight. Ordinary attacks against prone enemies do not trigger it. The current planner has no Ground Finisher attack mode, and its single-target damage path cannot resolve this explosion or Entropy side effect.

The current [Amalgam Furax Body Count Wiki page](https://wiki.warframe.com/w/Amalgam_Furax_Body_Count) says melee kills (including melee DoT kills) trigger Blast and stagger through line of sight, except Exalted and pseudo-exalted kills. Its blast/stagger radius scales with rank. The Wiki reports roughly six Blast/Impact proc stacks, varying up to ten, with only 1 damage per Blast stack; it also notes those procs can trigger Shattering Impact. The planner lacks neighboring-target proc histories, the associated Shattering Impact armor strip, and stagger utility.

PR [#148](https://github.com/Appl3Tree/Tenno-Hub/pull/148) adds direct Wiki links and clearer source-backed warnings while keeping both effects excluded from Auto Optimize. PR [#149](https://github.com/Appl3Tree/Tenno-Hub/pull/149) sharpens the max-Health and Shattering Impact wording. No damage or area-effect scoring changed. PR #148 merged as `6987e0c178f7caccd27f6d2fafebda5744992d62` (Pages [run #229](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/44196302594), success); PR #149 merged as `91dfab61256dc37b2c43d7e3fe6cea07b506fdee` (Pages [run #230](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/44196950087), success).

Validation: the optimizer test file passed 144/144 after the source-link implementation; the two focused regressions passed after wording refinement (2 passed, 142 skipped), focused ESLint passed, and the production build passed with the existing Vite large-chunk warning. The full suite was not rerun. The in-app browser could not reach the local preview on ports 80 or 5173, so no rendered QA is claimed. This source boundary does not establish live-game accuracy or optimizer quality.

## D3-OPT-EXILUS-FORMA-001 — Exilus Forma accounting and 45-case Arcane verification (2026-11-17; released)

Implementation/test/harness commit: `441f01f6` (based on main `4fa153b1e9b3dcca1f0232d0db00395f2c4db797`). PR [#144](https://github.com/Appl3Tree/Tenno-Hub/pull/144) was squash-merged as `b073bfd54551692a4235390bd47a6cacd95ec868`; Pages deployment [run #225](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/44183852758) succeeded.

Command: `npx tsx scripts/benchmarkBuildOptimizer.ts --runs=1 --verify-arcane-selection`

The 45-case corpus covers Burst, Scaling, melee DPS proxy, and finite Expected TTK objectives. The benchmark now passes per-case Warframe Armor and Energy inputs into both optimization and final-build Arcane re-scoring; the added Braton Prime Expected TTK fixture uses 1,500 Warframe Armor and 1,000 maximum Energy at 100%. For each returned fixed mod/Exilus list, the verifier compares the selected Arcane and rank against every eligible catalog Arcane rank under that case's supplied context.

Before the correction, this audit found two genuinely over-capacity Expected TTK builds: Kuva Ogris / Rocket Explosion at 81/80 and Nataruk / Perfect Shot at 62/60, with `capacityValid: false`. Exilus scoring had forwarded the mod's matching polarity even when the capacity planner had not assigned that Forma. Later finite refinement treated the Exilus polarity as fixed and could spend the configured Forma limit again on main slots; a final polarity minimization then reset Exilus to its original polarity while retaining the refined mod list.

The optimizer now uses the Exilus polarity actually assigned by capacity planning, reserves a Forma used by Exilus from the remaining main-slot refinement budget, and refreshes the fixed extra-slot context whenever polarity assignment changes. A regression covers both affected catalog builds and independently checks the returned capacity summary and three-Forma limit. The benchmark's Arcane verifier now carries Warframe Armor as well as Energy context, so armor-scaled Arcane ranks are included when the fixture supplies that input.

After the fix, all 45 outputs were legal, every fixed-build Arcane audit selected a score tied with the best eligible rank (zero measured gap), and the added Braton case selected Primary Overcharge R5 at 0.5330 s modeled Expected TTK. This is conditional-on-returned-build evidence. The exhaustive joint Expected TTK oracle remains restricted to small curated candidate pools, and neither result proves full-catalog joint or global Arcane/mod optimality.

One optimizer run per case measured 1.425–6.794 s on Windows x64 / Node 22.16.0. The independent all-rank re-scoring occurs after the optimizer timer stops. These are single observations, not repeatability, population-tail, packaged Worker, cold-start, or mobile results. Release validation passes: 798 tests / 53 files; production TypeScript/Vite build; source validation; prerequisite audit (162 entries, no unresolved references or dependency cycles); mod-effect audit (694 weapons / 599 eligible mods / 490 parsed / 109 without parsed effects / 71 review candidates / 18 partial / 53 fully unparsed / zero weapon pools without parsed damage); focused ESLint; and `git diff --check`. Vite retains its existing large-chunk warning. Browser QA and live-game validation were not performed.

Reopen if a supported fixture returns an over-capacity build, the Forma count exceeds its configured limit, or the all-rank final-build Arcane audit finds a nonzero gap under matched context. This does not resolve full-catalog joint Arcane/mod quality.

## Set-mod coverage audit (2026-11-17)

The checked-in WFCD `external/warframe-items/raw/Mods.json` snapshot has 73 records with `modSet` across 19 distinct set-bonus paths. Static source tracing finds the paths imported into the general catalog but no shared-set effect consumer in weapon-stat math, finite Expected TTK, or optimizer scoring. The selected mod entries retain their individual stats, so set bonuses are currently omitted from the modeled build score.

The source audit surfaced a loadout-scope requirement: the current planner selects one weapon's mods and has no count for distinct set mods equipped elsewhere. The [Set Mods Wiki page](https://wiki.warframe.com/w/Set_Mod) documents set-count scaling and cross-equipment behavior; the [Critical Multiplier page](https://wiki.warframe.com/w/Critical_Multiplier) documents Vigilante's Primary critical-tier effect. PR [#134](https://github.com/Appl3Tree/Tenno-Hub/pull/134) preserves source set paths and shows a persistent active-build disclosure, but does not apply a set bonus. The full suite passes (796 tests / 53 files), as do focused ESLint, production build, and CRLF-aware diff check. Integrated-browser inspection was not run. This is a catalog/data coverage finding, not optimizer-quality or gameplay evidence. Pages deployment [run #213](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/44137015860) succeeded.

## Gladiator melee Critical Chance integration (2026-11-17)

The current [Set Mods Wiki page](https://wiki.warframe.com/w/Set_Mod) documents six Gladiator pieces across Warframe and melee equipment, with 10% Critical Chance per piece for each combo tier above 1x. At 12x, that is 110% per piece. The [Critical Chance page](https://wiki.warframe.com/w/Critical_Chance) documents additive handling with other combo-scaled Critical Chance bonuses.

The implementation reads the canonical Gladiator modSet identity at every mod rank, combines selected melee pieces with a saved user-entered count of 0–3 external distinct pieces, and caps the set at six. The resulting bonus is 10% × set pieces × (combo multiplier − 1) of base melee Critical Chance, added through the existing combo-critical-chance calculation before conditional-hit handling.

A controlled optimizer-selection regression uses one candidate (Gladiator Rush) and a synthetic melee profile with three external Warframe pieces. Auto Optimize leaves Gladiator Rush out at 1x and selects it at 12x, exercising the set bonus through candidate scoring and selection. This verifies one expected-value decision boundary; it is not a broad quality benchmark, a performance measurement, an Underframe comparison, or gameplay validation. Combo generation/decay, random roll history, and external piece identity are not modeled.

PR [#138](https://github.com/Appl3Tree/Tenno-Hub/pull/138) was squash-merged as 378397266efc96f3fcccd407f97140cacabc9d09; Pages deployment [run #219](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/44157903930) succeeded. Validation passed at 793 tests / 53 files plus the build, source/prerequisite/mod-effect audits, focused ESLint, and CRLF-aware diff check.

## Sacrificial two-piece set integration — D3-MOD-SET-SACRIFICIAL-001 (2026-11-17; released)

The current [Set Mods Wiki page](https://wiki.warframe.com/w/Set_Mods), [Sacrificial Pressure](https://wiki.warframe.com/w/Sacrificial_Pressure), and [Sacrificial Steel](https://wiki.warframe.com/w/Sacrificial_Steel) describe +25% effectiveness for each listed member stat when both set mods are equipped. At max rank, Sacrificial Pressure lists +110% Melee Damage, Sacrificial Steel lists +220% Critical Chance, and both have ×1.33 Damage to Sentients; Steel doubles its Critical Chance on Heavy Attacks. Applying +25% to each +33% faction bonus gives +41.25% per member, for +82.5% combined faction-damage bonus and a ×1.825 target multiplier. The [Faction Damage Bonus Wiki page](https://wiki.warframe.com/w/Faction_Damage_Bonus) describes faction damage as a bonus fraction on the weapon multiplier. Local WFCD `Mods.json` contains both canonical members and ranks 0–10 under `/Lotus/Upgrades/Mods/Sets/Sacrifice/SacrificeSetMod`.

The local code parses the set-member identity at every rank, normalizes the raw `Sentients` label to the planner's `Sentient` target key, and applies +25% to each selected member's parsed Melee Damage, normal and Heavy Attack Critical Chance, and faction-damage bonus only when both distinct identities are selected on a Melee weapon. `calculateBuild` returns the target-matched faction bonus so fast optimizer and finite Expected TTK scoring, plus Mod Builder target-encounter calculations, use the same scaled value. Tests cover canonical membership across ranks, max-rank ordinary/heavy critical behavior, all-rank damage/faction scaling, unmatched factions, duplicate identity, ranged ineligibility, exact finite scoring, and optimizer selection.

Validation passes: full suite 797/797 across 53 files; focused Sacrificial slice 4/4; TypeScript/production build; source validation; prerequisite audit (162 entries, no unresolved references/cycles); mod-effect audit (694 weapons / 599 eligible mods / 490 parsed / 109 without effects / 71 review candidates / 18 partial / 53 fully unparsed / zero pools without parsed damage); focused ESLint; and CRLF-aware diff check. The existing Vite large-chunk warning remains. PR [#140](https://github.com/Appl3Tree/Tenno-Hub/pull/140) was squash-merged as `693929198a911890968870cae4438e25d231d078`; Pages deployment [run #221](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/44168533966) succeeded. This is calculator/optimizer coverage, not a broad build-quality benchmark, Underframe comparison, browser verification, or live-game validation; no optimizer quality or performance gain is claimed.

## Second seeded 12-weapon full-catalog Expected TTK corpus — D3-OPT-SEED-CORPUS-002 (2026-11-17; completed)

Command: `npx tsx scripts/auditExpectedTtkCorpus.ts --seed=20261144`. The runner combines eight fixed anchors with one Mulberry32-selected candidate from each predeclared explosive-primary, Archgun, companion-weapon, and heavy-melee stratum: Kuva Ogris / Rocket Explosion, Mausolon / Charged Shot Explosion, Verglas Prime / Normal Attack, and Arca Titron / Heavy Slam Attack. All twelve cases use Grineer, 100,000 Health / 3,000 Armor, Realistic state, eight main slots, Catalyst, MR30, up to three Forma, no Arcane or Exilus optimization, and exact finite Expected TTK for every legal one-mod add/remove/replacement from Auto Optimize's baseline.

| Weapon / attack | Exact legal neighbors | Optimizer = best neighbor TTK |
|---|---:|---:|
| Braton Prime / Normal Attack | 234 | 2.1194748 s |
| Cedo / Normal Attack | 412 | 2.6109661 s |
| Laetum / Normal Attack | 292 | 1.8867925 s |
| Soma Prime / Fully Spooled | 420 | 1.7191106 s |
| Broken War / Normal Attack | 365 | 8.0000000 s |
| Kuva Nukor / Normal Attack | 359 | 1.4400000 s |
| Nataruk / Perfect Shot | 396 | 1.3000000 s |
| Torid / Grenade Impact | 326 | 10.0000000 s |
| Kuva Ogris / Rocket Explosion | 450 | 2.0000000 s |
| Mausolon / Charged Shot Explosion | 163 | 1.0526316 s |
| Verglas Prime / Normal Attack | 250 | 2.8070175 s |
| Arca Titron / Heavy Slam Attack | 299 | 1.5591503 s |

All 3,966 neighbors tied or lost; every reported optimizer TTK equals the best legal neighbor TTK. The pair of seeded corpora now covers sixteen distinct weapon/attack fixtures across the original eight anchors and eight randomized representatives, but the one-mod checks remain specific to this single target/faction/state/objective and use the planner's own damage model. This is not global optimality, Underframe comparison, live-game validation, or browser/mobile latency evidence. No application code changed. PR [#142](https://github.com/Appl3Tree/Tenno-Hub/pull/142) was squash-merged as `ec6b083061c1241a2976bb8ca62bd30b6c8f6203`; Pages deployment [run #223](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/44174273199) succeeded.

## Second seeded 12-fixture two-mod Expected TTK sample — D3-OPT-RANDOM-PAIR-AUDIT-002 (2026-11-17; completed)

Command: `npx tsx scripts/auditExpectedTtkPairSample.ts --seed=20261144 --samples=1024`. Each fixture uses a derived Mulberry32 seed and 1,024 sampled legal max-rank two-out/two-in replacements from the full damage-effect catalog. The sampler draws without replacement from outgoing-slot-pair × incoming-mod-pair tuples, rejecting duplicate, incompatible, unsupported, capacity/Forma-illegal, and duplicate-build outcomes. Exact finite Expected TTK scores use the same Grineer / 100,000 Health / 3,000 Armor / Realistic / eight-slot / Catalyst / three-Forma settings as the seeded one-mod corpus.

| Weapon / attack | Baseline TTK | Best sampled TTK | Raw tuples examined | Legal moves | Improvements |
|---|---:|---:|---:|---:|---:|
| Braton Prime / Normal Attack | 2.1194748 s | 2.4476280 s | 3,057 | 1,024 | 0 |
| Cedo / Normal Attack | 2.6109661 s | 2.7202623 s | 1,568 | 1,024 | 0 |
| Laetum / Normal Attack | 1.8867925 s | 2.0000000 s | 2,383 | 1,024 | 0 |
| Soma Prime / Fully Spooled | 1.7191106 s | 2.1050755 s | 1,594 | 1,024 | 0 |
| Broken War / Normal Attack | 8.0000000 s | 9.0000000 s | 1,789 | 1,024 | 0 |
| Kuva Nukor / Normal Attack | 1.4400000 s | 1.7500000 s | 1,796 | 1,024 | 0 |
| Nataruk / Perfect Shot | 1.3000000 s | 1.4750000 s | 1,548 | 1,024 | 0 |
| Torid / Grenade Impact | 10.0000000 s | 11.0000000 s | 2,425 | 1,024 | 0 |
| Kuva Ogris / Rocket Explosion | 2.0000000 s | 2.0000000 s | 1,418 | 1,024 | 0 |
| Mausolon / Charged Shot Explosion | 1.0526316 s | 1.0526316 s | 2,601 | 1,024 | 0 |
| Verglas Prime / Normal Attack | 2.8070175 s | 3.0263158 s | 2,406 | 1,024 | 0 |
| Arca Titron / Heavy Slam Attack | 1.5591503 s | 1.8190086 s | 2,090 | 1,024 | 0 |

Total: 12,288 legal sampled builds from 24,675 distinct raw tuples, with no improvements. Kuva Ogris and Mausolon had a sampled tie; the remaining best sampled candidates were slower. This reduces the chance that an obvious coordinated two-mod replacement exists in these sampled neighborhoods but does not prove pair-local or global optimality, and does not compare to Underframe or live gameplay. The full-pool sample's 12-fixture latency is not a product interaction measurement. PR [#142](https://github.com/Appl3Tree/Tenno-Hub/pull/142) was squash-merged as `ec6b083061c1241a2976bb8ca62bd30b6c8f6203`; Pages deployment [run #223](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/44174273199) succeeded.

## Seeded 12-weapon full-catalog Expected TTK corpus and tempo-tradeoff correction (2026-11-17)

Command: `npx tsx scripts/auditExpectedTtkCorpus.ts --seed=20261117`. The repeatable corpus combines eight previously audited anchors with one Mulberry32-uniform candidate from each predeclared underrepresented stratum. The selected seeded cases were Tenet Envoy / Rocket Explosion, Corvas Prime / Charged Shot, Helstrum / Explosion, and Gram Prime / Heavy Slam Attack. The fixed anchors are Braton Prime / Normal Attack, Cedo / Normal Attack, Laetum / Normal Attack, Soma Prime / Fully Spooled, Broken War / Normal Attack, Kuva Nukor / Normal Attack, Nataruk / Perfect Shot, and Torid / Grenade Impact. Candidate strata are: explosive primary (Kuva Ogris, Acceltra Prime, Tenet Envoy); Archgun (Corvas Prime, Mausolon); companion weapon (Verglas Prime, Helstrum); and heavy melee (Gram Prime, Arca Titron). The seed and selected case list are emitted by `--dry-run`.

All cases use Grineer, 100,000 Health / 3,000 Armor, no Shields or Overguard, Realistic conditional state, eight main slots, Catalyst, MR30, up to three Forma, no Arcane or Exilus optimization, and exact finite Expected TTK. Starting from Auto Optimize's legal build, the audit scored every legal one-mod add, remove, or replacement from the eligible full catalog. The pre-fix run on clean main `1a21a0b58bec0fdc08fba12d431f2ad5cee9bca4` found one miss: Helstrum / Explosion's 387 legal neighbors included Continuous Misery → Vile Acceleration, lowering modeled TTK from 62s to 52s. The Vile Acceleration candidate entered refinement, but its proxy-favored replacement slots displaced the exact-best outgoing slot.

The generic fix classifies positive fire-rate/attack-speed effects paired with negative direct damage as `tempo-damage-tradeoff`. It reserves up to three outgoing-slot alternatives for shortlisted candidates in that family, within the existing per-pass limits of 40 exact single replacements and eight slot alternatives. The regression independently scores the returned Helstrum build and checks the legal Vile Acceleration replacement at 52s.

After the fix, the same seeded corpus returns no improving legal one-mod neighbor in any case:

| Weapon / attack | Selection | Eligible mods | Exact legal neighbors | Expected TTK | Forma |
| --- | --- | ---: | ---: | ---: | ---: |
| Braton Prime / Normal Attack | Fixed | 61 | 229 | 2.1194748 s | 3 |
| Cedo / Normal Attack | Fixed | 61 | 404 | 2.6109661 s | 2 |
| Laetum / Normal Attack | Fixed | 65 | 292 | 1.8867925 s | 3 |
| Soma Prime / Fully Spooled | Fixed | 62 | 412 | 1.7191106 s | 2 |
| Broken War / Normal Attack | Fixed | 62 | 365 | 8.0000000 s | 3 |
| Kuva Nukor / Normal Attack | Fixed | 65 | 359 | 1.4400000 s | 3 |
| Nataruk / Perfect Shot | Fixed | 59 | 388 | 1.3000000 s | 1 |
| Torid / Grenade Impact | Fixed | 62 | 318 | 10.0000000 s | 3 |
| Tenet Envoy / Rocket Explosion | Seeded | 62 | 411 | 2.5364616 s | 2 |
| Corvas Prime / Charged Shot | Seeded | 34 | 175 | 1.5384615 s | 3 |
| Helstrum / Explosion | Seeded | 61 | 311 | 52.0000000 s | 3 |
| Gram Prime / Heavy Slam Attack | Seeded | 62 | 315 | 1.2500000 s | 3 |

The corpus scored 3,979 exact legal neighbors and took about 95.4s total on Windows x64 / Node v22.16.0; this is exhaustive-audit wall time, not planner interaction latency. Three direct-core Helstrum optimization runs returned the same legal build and 52s score in 3,626.6 / 2,747.8 / 2,906.4ms (median 2,906.4ms, maximum 3,626.6ms). Validation passes at 795 tests / 53 files, production TypeScript/Vite build (existing large-chunk warning), source validation, prerequisite audit (227 entries; no unresolved references/cycles), mod-effect coverage (694 weapons / 599 eligible mods / 489 parsed / 110 with no effects / 71 review candidates / 18 partial / 53 fully unparsed / zero pools without parsed damage), focused ESLint, and CRLF-aware diff check. This is bounded one-mod local-optimum evidence under one target/model, not global optimality, gameplay validation, or an Underframe comparison. PR [#130](https://github.com/Appl3Tree/Tenno-Hub/pull/130) was squash-merged as db3fa3634966c44c11c9ee6474c1d029513f02c1; Pages deployment [run #209](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/44123588584) succeeded. Production integrated-browser smoke verification remains unverified because the open request queued and Computer Use was interrupted before a rendered check.

## Seeded full-pool two-mod replacement sample (2026-11-17)

The reproducible runner is npx tsx scripts/auditExpectedTtkPairSample.ts --seed=20261117 --samples=1024. It reuses the 12 fixtures selected by auditExpectedTtkCorpus.ts --seed=20261117. Per-fixture seeds are derived from the base seed using Mulberry32 and the documented uint32 offset formula in the runner. Each fixture sampled 1,024 distinct legal two-mod replacements, chosen uniformly from the legal tuple space by randomizing raw tuples and rejecting illegal builds, then exact-scored with finite Expected TTK. Incoming mods were full-catalog eligible max-rank candidates with fully modeled damage effects and were not in the baseline build. The same Grineer 100,000 Health / 3,000 Armor Realistic scenario, eight slots, Catalyst, MR30, up to three Forma, and no Arcane/Exilus optimization were used.

| Weapon / attack | Baseline TTK | Best sampled pair TTK | Improving samples |
| --- | ---: | ---: | ---: |
| Braton Prime / Normal Attack | 2.1194748 s | 2.3074387 s | 0 / 1,024 |
| Cedo / Normal Attack | 2.6109661 s | 2.9515268 s | 0 / 1,024 |
| Laetum / Normal Attack | 1.8867925 s | 2.0000000 s | 0 / 1,024 |
| Soma Prime / Fully Spooled | 1.7191106 s | 2.0531907 s | 0 / 1,024 |
| Broken War / Normal Attack | 8.0000000 s | 9.0322581 s | 0 / 1,024 |
| Kuva Nukor / Normal Attack | 1.4400000 s | 1.7831325 s | 0 / 1,024 |
| Nataruk / Perfect Shot | 1.3000000 s | 1.4750000 s | 0 / 1,024 |
| Torid / Grenade Impact | 10.0000000 s | 11.0000000 s | 0 / 1,024 |
| Tenet Envoy / Rocket Explosion | 2.5364616 s | 2.7995801 s | 0 / 1,024 |
| Corvas Prime / Charged Shot | 1.5384615 s | 1.5384615 s | 0 / 1,024 |
| Helstrum / Explosion | 52.0000000 s | 63.0000000 s | 0 / 1,024 |
| Gram Prime / Heavy Slam Attack | 1.2500000 s | 2.4193548 s | 0 / 1,024 |

Across the corpus, the sampler examined 24,170 raw tuples to collect 12,288 legal moves. The proportion of each raw tuple universe examined ranged from 2.876% to 14.967%. This finds no improvement in the sampled pairs; it does not establish a pair-local optimum or global optimality. The sample is one faction, target, objective, and conditional state; it excludes effects without fully modeled damage lines and is not an Underframe or live-game comparison. No optimizer code changed in this audit. PR [#132](https://github.com/Appl3Tree/Tenno-Hub/pull/132) was squash-merged as 85502ca12558bd6f4391c4333cb4b6754762d3cd; Pages deployment [run #211](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/44131941071) succeeded.

## Coda Bassocyst Alt-Fire model boundary (2026-11-17)

The current [Coda Bassocyst Wiki page](https://wiki.warframe.com/w/Coda_Bassocyst) describes an Alt-Fire mite that can attach to up to six enemies, applies Impact/Magnetic damage and status once per second for ten seconds, and has an eligible-target Mercy-finisher branch. The planner's ordinary attack row does not represent delayed multi-target tick history or the Mercy branch. Its displayed row damage and DPS/TTK values are not valid estimates for this mode, so Auto Optimize refuses it and shows the limitation and Wiki link. Normal Attack remains in the supported score pool.

No optimizer-quality or latency number is recorded for this mode: the displayed source-row scores cannot support a comparison. Reopen the boundary only when the missing event structure is modeled and independently validated, or current authoritative game evidence changes the behavior.

Release: implementation/test commit 16d3414f; tracking commit 95cb06b8; PR [#127](https://github.com/Appl3Tree/Tenno-Hub/pull/127) merged as 2efa2f335c69d9b500e5fe228bd74d573cfd064d; Pages deployment [run 44105846349](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/44105846349) succeeded.

## Torid coordinated two-mod Expected TTK swap (2026-11-17)

Scenario: Torid / Grenade Impact, Grineer, 100,000 Health / 3,000 Armor, no Shields or Overguard, Realistic conditional state, eight main slots, Catalyst, and up to three Forma. The full eligible pool had 62 max-rank candidates. The selected legal three-Forma baseline scored 10.8961905 s Expected TTK / 9,177.52 encounter DPS; a full exact one-mod neighborhood of 217 legal add/remove/replacement options had no improvement.

A separate exhaustive audit evaluated 17,665 unique legal max-rank two-in/two-out combinations: it replaced exactly two selected mods with two distinct eligible mods, allowed slot reassignment and up to three Forma, and independently finite-scored the resulting builds. The strongest pair replaces Hellfire and Spring-Loaded Chamber with Thermite Rounds and Vile Acceleration, lowering modeled TTK to 10.0000 s / 10,000 encounter DPS. The optimizer's 12-entry pair-candidate pool omitted Vile Acceleration. Increasing the bounded family-diverse pool to 13 returns the improved legal build; a regression verifies the pair and independent finite-encounter result. A 14-entry pool also finds the build but was slower on this fixture.

Three repeated Windows x64 / Node 22.16.0 runs measured 12-entry times of 3,572.1 / 2,479.5 / 2,839.5 ms (median 2,839.5, max 3,572.1), 13-entry times of 4,690.1 / 3,435.7 / 3,599.4 ms (median 3,599.4, max 4,690.1), and 14-entry times of 4,713.5 / 3,857.8 / 3,277.1 ms (median 3,857.8, max 4,713.5). Three runs are a rough single-fixture latency observation only. Fresh Windows x64 / Node v22.16.0 three-run probes on the exact same fixture measured pool-12 batches at 4,913.2 / 4,027.6 / 4,590.7 ms (median 4,590.7, max 4,913.2) and 4,719.3 / 3,812.5 / 4,392.6 ms (median 4,392.6, max 4,719.3). Pool-13 batches measured 5,540.4 / 5,219.0 / 5,165.5 ms (median 5,219.0, max 5,540.4) and 6,052.8 / 5,314.7 / 5,395.3 ms (median 5,395.3, max 6,052.8). Pool 12 retained the 10.8961905 s build; pool 13 returned the intended pair at 10.0000 s, matching the independent score. These measurements ran slower in absolute terms than the earlier comparison above; across the fresh samples, pool 13 added about 0.6–1.0 s of median search time. The timings are noisy and apply only to this desktop Node fixture. On the clean current-main reconciliation, the optimizer test file passes 136/136 and the full suite passes 794 tests across 53 files. Production TypeScript/Vite build, source validation, prerequisite audit (227 entries; no unresolved references/cycles), mod-effect audit (694 weapons, 599 eligible mods, 489 parsed, 110 without effects, 71 review candidates, 18 partial / 53 fully unparsed, zero pools without parsed damage), focused ESLint, and CRLF-aware diff check pass. Source/test commit f5132299dfb561b631b0b83fe07c1905632c4505; PR [#128](https://github.com/Appl3Tree/Tenno-Hub/pull/128) squash-merged as aba79d8216d264a920b2015b6539529544199b21; Pages run [44113194052](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/44113194052) succeeded. This demonstrates a bounded model-local quality/runtime tradeoff, not global quality, live gameplay accuracy, browser Worker latency, or mobile performance. The preserved source audit output is under .tmp/current-main-20261117/.tmp/ in the stale primary checkout; do not modify that data.

## Expanded full-catalog Expected TTK one-mod neighborhoods (2026-11-17)

Each case starts from Auto Optimize's eight-mod result for a 100,000 Health / 3,000 Armor Grineer target with no Shields or Overguard, Realistic conditional state, Catalyst, and up to three Forma. The audit evaluated every legal one-mod add, remove, or replacement from the eligible catalog pool using the finite expected encounter score. Arcane and Exilus optimization were disabled so the neighborhood comparison stays on the eight main slots.

| Weapon / attack | Eligible mods | Legal one-mod neighbors | Optimizer TTK | Best-neighbor result |
| --- | ---: | ---: | ---: | --- |
| Braton Prime / Normal Attack | 61 | 229 | 2.1194748 s | No improvement |
| Cedo / default attack | 61 | 404 | 2.6109661 s | No improvement |
| Laetum / Normal Attack | 65 | 292 | 1.8867925 s | No improvement after the follow-up |
| Soma Prime / Fully Spooled | 62 | 412 | 1.7191106 s | No improvement |
| Broken War / Normal Attack | 62 | 365 | 8.0000000 s | No improvement |
| Kuva Nukor / Normal Attack | 65 | 359 | 1.4400000 s | No improvement |
| Nataruk / Perfect Shot | 59 | 388 | 1.3000000 s | No improvement |

The Laetum audit exposed a real search gap after PR #119: replacing Expel Grineer with Creeping Bullseye improved modeled TTK from 1.8965517 s to 1.8867925 s. A locked-slot optimizer replay confirmed the exact one-mod build and score. The gap remained because the four-pass refinement reached a better Gunslinger replacement on its last pass, leaving no pass to test the next critical replacement from that new incumbent. Critical replacement-slot alternatives now receive priority within the existing per-pass candidate cap, and the bounded pass count is five. The full-pool optimizer now returns the 1.8867925 s result; all 292 legal one-mod neighbors tie or lose.

The Kuva Nukor and Nataruk cases were rerun from a clean checkout of current GitHub `main` at `4ae7ea26331a45bbb69bea57fce9742d69589f74`. Both use the same 100,000 Health / 3,000 Armor Grineer target, Realistic state, Catalyst, eight main slots, and up to three Forma; Arcane and Exilus optimization are disabled. Kuva Nukor had 107 catalog candidates / 65 eligible mods and 359 legal one-mod neighbors. Nataruk had 101 / 59 and 388 neighbors. Neither result had a better one-mod neighbor. Across the seven listed cases, this remains a model-local one-mod check, not global optimality, coordinated-change quality, or gameplay validation.

The seven neighborhoods are a limited local-optimality check under the planner's own model and custom target. They do not establish global optimality, quality for coordinated multi-mod changes, or agreement with live gameplay. The extra refinement pass may add work to Expected TTK search; broad latency plus cold/mobile browser measurements remain open.

After the fifth-pass change, `npx tsx scripts/benchmarkBuildOptimizer.ts --runs=1 --verify-arcane-selection` completed all 44 configured cases with legal builds and passed the returned-build Arcane checks. The single-call observations ranged from 1,607.7 ms to 6,763.7 ms on Windows x64 / Node 22.16.0. Since every case ran once, these are not p95 or repeatability results, and the Node harness does not measure the browser Worker, cold startup, or mobile hardware.

## Five-run Kuva Kohm Expected TTK benchmark on current main (2026-11-17)

Command: `npx tsx scripts/benchmarkBuildOptimizer.ts --weapon="Kuva Kohm" --attack="Fully Spooled" --goal=timeToKill --runs=5 --realistic --no-exilus --no-arcane`. This was run from the clean current-main checkout above on Windows x64 / Node 22.16.0 with 104 mod candidates and 15 Arcane candidates (Arcane optimization disabled). All five runs evaluated 157 finite candidates and returned the same legal two-Forma, 74/80 build: Galvanized Savvy R10, Primed Charged Shell R10, Contagious Spread R5, Blaze R3, Frail Momentum R5, Primed Ravage R10, Galvanized Hell R10, and Shotgun Barrage R5. Modeled TTK was 0.6352061 s and encounter DPS 39,357.30 on every run. Median optimizer time was 3,839.96 ms; the reported p95 / maximum-of-five was 5,659.42 ms. This is desktop Node-core latency, not browser Worker, cold-start, or mobile performance.

## Full-catalog exact one-mod Expected TTK neighborhood (2026-11-16)

Command: `npx tsx scripts/auditExpectedTtkFullPool.ts --weapon="Braton Prime" --faction=Grineer --state=realistic --health=100000 --armor=3000`. The audit started from the optimizer's legal eight-mod, three-Forma build against a 100,000 Health / 3,000 Armor custom Grineer target. It scored every legal add, remove, and single-mod replacement from the full eligible catalog pool: 229 neighbors, with 229 exact finite-encounter scores. The eligible pool contained 61 mods (106 catalog candidates before target/effect filtering).

The audit exposed a real search miss. Replacing Radiated Reload with Spring-Loaded Chamber lowered modeled Expected TTK from 2.1426217s to 2.1194748s (1.08%). The sustained-DPS proxy ranked a different replacement slot for Spring-Loaded Chamber, and the finite-TTK shortlist previously retained only one proposal per incoming mod. Refinement now reserves up to eight additional slot-specific replacement proposals for selected on-reload fire-rate candidates within the existing 40 exact single-replacement evaluation limit. A full-catalog regression covers this same case.

After the change, the optimizer returns the 2.1194748s build, and the best exact one-mod neighbor among all 229 legal options does not improve it. This is a local one-mod neighborhood check for one custom target under the planner's own finite-encounter model. It does not prove a global optimum, cover coordinated multi-mod changes, or validate the model against gameplay telemetry.

Run date: 2026-11-16; current full-width refresh: 2026-11-15
Command: `npm run benchmark:build-planner` (the harness defaults to five runs)
Environment: Windows x64, Node.js v22.16.0, 28 logical CPUs. This invokes the optimizer core directly in Node. It does not measure a production browser Worker.

## Nightwatch Napalm Kuva Ogris finite-encounter case (2026-11-16)

Command: `npx tsx scripts/benchmarkBuildOptimizer.ts --runs=3 --weapon="Kuva Ogris" --attack="Rocket Explosion" --goal=timeToKill --no-arcane --no-exilus`. The Grineer preset, Initial state, Catalyst, eight mod slots, and 106 filtered mod candidates were used. Each run evaluated 117 finite encounter candidates and returned the same legal zero-Forma build at 79/80 capacity: Malignant Force R3, Rime Rounds R3, Hellfire R5, Thermite Rounds R3, Primed Bane of Grineer R10, Semi-Rifle Cannonade R5, Split Chamber R5, and Rifle Elementalist R5. It selected no Arcane and modeled 1.0s TTK.

The three desktop Node runs measured 2,583.9ms median, 3,032.1ms maximum / three-run p95 observation, and 2,276.9ms minimum. Nightwatch Napalm was not selected for this fast-kill Grineer preset. The 100,000-health custom-target regression selects it from the full filtered catalog pool, and a candidate-only regression confirms finite Expected TTK includes its six ticks. These are optimizer-model checks, not gameplay telemetry, broad quality or optimality evidence, or browser Worker/mobile latency measurements. See `BUILD_PLANNER_WORK_STATUS.md` for the modeled exposure and status assumptions.

## Realistic Galvanized per-status kill cadence (2026-11-16)

The benchmark harness accepts `--realistic` to exercise repeated-target on-kill estimates. Command: `npx tsx scripts/benchmarkBuildOptimizer.ts --runs=3 --weapon=Cedo --goal=timeToKill --realistic`. The direct Normal Attack case selected max-rank Galvanized Savvy in the same legal 3-Forma build for all three runs, at 0.727795s modeled TTK and 4,226.5ms median optimizer time (4,272.9ms maximum / three-run p95 observation). The companion Glaive Radial Attack case is AoE and does not use the per-status kill-stack estimate; it returned a legal 3-Forma result at 3.68421s TTK, with 3,498.5ms median and 4,300.5ms maximum.

The Realistic finite encounter estimates cadence from repeated identical target kills, while the optimizer search uses a sustained damage/pool proxy with up to two cadence refinements to control hot-path cost. Neither simulates each target's random proc and timeout history. This three-run desktop Node sample is too small for a stable p95 and does not measure browser Worker startup, mobile performance, or global optimality.

## Wiki Auto-Spool finite-encounter case (2026-11-16)

Command: `npx tsx scripts/benchmarkBuildOptimizer.ts --runs=20 --weapon="Soma Prime" --goal=timeToKill`. This targeted case was added to the benchmark harness so source-backed Auto-Spool timing participates in exact encounter scoring and repeatable latency measurements. It used the Grineer faction preset, Initial conditional state, MR 30, Catalyst, Exilus/Arcane optimization, 107 filtered mod candidates, 14 Arcane candidates, and a three-Forma limit. Every run evaluated 158 exact encounter candidates and returned the same legal two-Forma build: Heavy Caliber R10, Vital Sense R5, Primed Cryo Rounds R10, Malignant Force R3, Thermite Rounds R3, Hata-Satya R5, Split Chamber R5, and Vile Acceleration R5. The build used 59/60 capacity, selected no Arcane, and modeled 1.333146 s TTK / 18,752.64 damage per second.

Across 20 desktop Node runs, optimizer latency was 3.429 s median, 3.703 s p95, 3.135 s minimum, and 4.019 s maximum. The repeated output was stable and legal. This is one weapon/target/goal scenario and a small latency sample; it does not establish global optimality, compare against the prior optimizer or Underframe, or measure browser Worker startup, UI responsiveness, or mobile performance. The evaluator assumes the first hit at 0s and resets spool after an empty magazine; spool-down retention and hit probability remain unsupported. At this checkpoint variable multishot/ammo spool modes were also outside the evaluator; current Kohmak, Twin Kohmak, and Kuva Kohm sequence coverage is documented separately below.

## Kuva Kohm Auto-Spool pellet/status/ammo sequence (2026-11-16)

The current [Kuva Kohm Wiki page](https://wiki.warframe.com/w/Kuva_Kohm) gives a five-round fire-rate spool (20% start, +20 percentage points per shot), one additional pellet per consecutive shot up to 12, first-shot Status Chance divided across the pellet ramp, and ammo cost from 1 to 4 per attack. It lists 52 attacks per magazine at constant full-spool cost (209 / 4). The planner separates that steady count from the finite from-rest sequence: the current Wiki tables report steady counts of 23 Kohmak, 47 Twin Kohmak, and 52 Kuva Kohm attacks per magazine; the from-rest estimates are 25/49/57. The Kohmak 25/49 counts match their Wiki examples. For Kuva Kohm, 57 is model-derived: intermediate ammo cost is inferred as `max(1, 4 × current pellets / 12)` and fractional ammo carries forward; the Wiki does not publish the from-rest count or a full intermediate cost table.

Command: `npx tsx scripts/benchmarkBuildOptimizer.ts --runs=5 --weapon="Kuva Kohm" --goal=timeToKill`. The Grineer / Initial-state / MR 30 scenario used Catalyst, Exilus and Arcane optimization, 104 filtered mod candidates, 15 Arcane candidates, and a three-Forma limit. Every run evaluated 185 exact encounter candidates and returned the same capacity-legal two-Forma build (80/80 capacity): Primed Charged Shell R10, Contagious Spread R5, Magnetic Strafe R3, Frail Momentum R5, Primed Point Blank R10, Primed Cleanse Grineer R10, Hell's Chamber R5, and Shotgun Barrage R5. No Arcane was selected. Modeled Expected TTK was 0.7806255 s at 32,025.6 encounter DPS.

The five-run median was 2.320 s; minimum 2.269 s and maximum / max-of-five p95 observation 2.638 s. All runs had the same score, build, Arcane selection, and legality result. This is one desktop Node case and a five-run latency sample, not a global-optimality result, independent gameplay validation, production Worker measurement, or mobile/cold-start benchmark. Accuracy/recoil, misses, and spool retention between magazines remain outside the model.

## Wiki Neutral-combo DPS objective (2026-11-15)

Command: `npx tsx scripts/benchmarkBuildOptimizer.ts --runs=5 --weapon="Broken War" --goal=meleeDps`. This case used Crimson Dervish's Neutral-combo row from the current [Wiki Stance Comparison table](https://wiki.warframe.com/w/Stance#Comparison), 110 filtered candidate mods, 12 Arcane candidates, Initial state, Catalyst, Exilus and Arcane optimization enabled, and a three-Forma limit. All five runs returned the same legal two-Forma build: Primed Fury R10, Primed Fever Strike R10, Magnetic Rush R3, Primed Pressure Point R10, True Steel R5, Organ Shatter R5, Condition Overload R5, and Carnis Mandible R5. The result scored 135,358.1469 stance DPS; median time was 4.630s and the maximum of five was 4.965s. Capacity validation includes the selected stance.

This verifies repeatability, capacity legality, and a single full-width Wiki stance objective case on desktop Node. The five-run maximum is not a stable p95; this does not measure browser Worker startup, mobile performance, competing stance choices, or global optimality. The raw objective uses Initial state and is not a target-specific TTK comparison.

## Buzlok Wiki Rifle-compatibility case (2026-11-15)

The current [Buzlok Wiki page](https://wiki.warframe.com/w/Buzlok) classifies Buzlok as a Rifle; its item ancestry also resolves through `LotusAssaultRifle`. The upstream weapon type string and internal path had caused the catalog to label it a Sniper, exposing sniper-only choices. The corrected pool uses 107 Rifle/Primary candidates and excludes Sniper-only mods such as Charged Chamber and Target Acquired.

Command: `npx tsx scripts/benchmarkBuildOptimizer.ts --runs=5 --weapon=Buzlok --goal=burst`. The scenario used the Grineer preset, MR 30, max-rank catalog mods, Catalyst, Exilus and Arcane optimization, Initial conditional state, and up to three Forma. All five runs returned the same legal 60/60 build with three Forma and no Arcane: Primed Cryo Rounds R10, Malignant Force R3, Hellfire R5, Heavy Caliber R10, Vile Acceleration R5, Vital Sense R5, and Split Chamber R5. Median time was 1.923s; the five-run p95/max observation was 2.208s. This desktop Node sample checks a corrected class pool and legality; it is not a global-optimality, production Worker, or mobile-performance result.

## Current-source 37-case refresh with a Broadhead range scenario (2026-11-15)

The benchmark corpus now includes Daikyu Prime / Quick Shot / Burst at a 16m target distance, so Spring-Loaded Broadhead's max-rank condition is active and comes from the same saved conditional state passed into the optimizer and score evaluator. The full five-run refresh covered 37 cases / 185 optimizations. Every returned build was legal under capacity and the three-Forma limit. Per-case medians ranged from 0.654s to 2.947s; maximum-of-five observations ranged from 0.665s to 3.012s. These five-run maxima are coarse samples, not population p95 estimates, and this Node harness does not measure browser Worker startup or mobile performance.

The Daikyu case took a median 2.474s / maximum 2.585s in the corpus. Its selected 8-mod build was stable and legal at 57/60 capacity with three Forma, but did not use Spring-Loaded Broadhead. A separate one-case five-run repeat measured 2.415s median / 2.661s maximum. Under the same 16m Burst score, replacing each selected mod one at a time with max-rank Broadhead scored below the original list; the best such substitution replaced Vital Sense and was about 30.7% lower. This bounded check shows the mod was scored but does not establish the global optimum or prove a better combination is absent.

The harness accepts the scenario range on a case-specific basis, and the JSON record includes `targetDistanceMeters` for reproducibility. All 37 cases returned capacity-valid, duplicate-free, incompatibility-group-valid builds within the Forma limit. Lex Prime Burst was the slowest median at 2.947s in this refresh; five-run results are desktop Node observations only.

## Akjagara Prime Range Advantage scenario (2026-11-15)

Command: `npx tsx scripts/benchmarkBuildOptimizer.ts --runs=5 --weapon="Akjagara Prime" --goal=burst`

The benchmark corpus now contains a 38th case: Akjagara Prime / Burst against the Grineer preset at 15m, where Range Advantage is active. Five runs selected the same eight-mod build including max-rank Range Advantage, with 59/60 capacity and two Forma. Median optimization time was 1.859s; the maximum of five was 2.150s. All runs were legal and stable, and no Arcane was selected. This measures one distance-conditional case only; the 37-case full-width corpus above has not yet been rerun with the new case, and the five-run maximum is not a population p95.

## Fresh Braton Prime Underframe Auto Build replay (2026-11-17)

The in-app browser replayed Auto Build on the saved copy `/Braton-Prime-benchmark-Copy`, leaving the original saved pages untouched. The displayed target was a level-145 Grineer Heavy Gunner at 83,818 Health / 2,700 Armor with no Shields or Overguard; Primary Bulwark was 500/500, and the build showed three Forma and 3/60 capacity remaining. The level label differed from the earlier level-100 capture, but the raw target pools matched.

Auto Build used `Copy of Default`, 28 CPU cores, GPU acceleration off, a five-second simulation, Sample Size Multiplier 3, Final Refinement on (sample size 200), Luck Averaged on, Elemental Candidates on, Cost Control on, a three-Forma maximum, raw-damage and status-damage build goals off, and blacklist options off. It reached `Step 4: Refining Top 3 Candidates (18 samples)` / `Refining 1 builds...` and then returned to idle. The visible eight-mod list stayed unchanged, and no final score/result panel appeared. Therefore no Underframe Auto Build winner or convergence claim is available from this replay.

The post-replay Tenno-Hub run used `npx tsx scripts/comparePlannerBuilds.ts --saved-underframe --primary-bulwark --reoptimize --goal=timeToKill --analyze-underframe-swaps`. Its common finite evaluator scored the captured list at 4.070981 s Expected TTK / 20,589.14 DPS and returned a legal three-Forma 59/60 build at 1.428414 s / 58,679.05 DPS. The captured list was legal at 57/60. The cross-list one-to-four-mod audit checked 69 substitutions (50 legal); none beat the Tenno-Hub baseline. These Tenno-Hub measurements do not evaluate Underframe's luck-averaged Auto Build objective and do not establish cross-tool parity. This bounded replay is tracked as D3-OPT-UNDERFRAME-BRATON-REPLAY-001 in PR [#156](https://github.com/Appl3Tree/Tenno-Hub/pull/156).

## Saved Underframe Braton comparison (2026-11-15)

The in-app browser's saved `Braton Prime benchmark (Copy)` displayed the captured eight-mod Underframe Auto Build list: Amalgam Serration R10, Bane of Corpus R5, Bane of Grineer R5, Bane of Infested R5, Malignant Force R3, Rime Rounds R3, Thermite Rounds R3, and Vital Sense R5. Its explicit target pools were Grineer Heavy Gunner, 83,818 Health, 2,700 Armor, zero Shields and Overguard. Primary Bulwark was set to 500/500. A five-second Luck Averaged run returned 1,529 raw + 465 DoT damage per shot and 19,461 DPS. No build configuration was saved or changed during this read-only check.

The matched common-model replay uses the same target pools and max-rank Primary Bulwark (+500% weapon damage at 1,500 Warframe Armor), with a three-Forma cap. The current Expected TTK optimizer returns Malignant Force R3, Stormbringer R5, Thermite Rounds R3, Galvanized Aptitude R10, Vile Acceleration R5, Galvanized Chamber R10, Bladed Rounds R5, and Spring-Loaded Chamber R5 at 59/60 capacity and three Forma. It models 0.788 s TTK / 106,394 DPS. The fixed Underframe list models 4.071 s / 20,589 DPS in the same Tenno-Hub expected encounter; this is 80.6% lower TTK for Tenno-Hub on this one common-model fixture. Replaying the fixed list's expected DPS within 5.8% of Underframe's native Luck Average is a useful cross-check, but the metrics come from different simulators.

The bounded 1–4-mod substitution audit evaluated 886 combinations (704 legal); none beat the optimizer's result. This only covers swaps between the two captured lists and does not establish Auto Build's hidden winning list, global optimality, or general superiority. Reproduce the model with `npx tsx scripts/comparePlannerBuilds.ts --saved-underframe --reoptimize --goal=timeToKill --fully-stacked --primary-bulwark --analyze-underframe-swaps`. `--primary-bulwark` maps the saved 500/500 condition to the Wiki-sourced rank-5 +500% effect at 1,500 Warframe Armor.

### Same optimizer build in Underframe's native calculator (2026-11-15)

The current Tenno-Hub Expected TTK optimizer's eight-mod Braton Prime result was entered into the same Underframe copy at the same ranks: Malignant Force R3, Rime Rounds R3, Thermite Rounds R3, Vigilante Armaments R5, Vital Sense R5, Primed Bane of Grineer R10, Split Chamber R5, and Vile Acceleration R5. The target remained Grineer Heavy Gunner with 83,818 Health, 2,700 Armor, no Shields/Overguard, and Primary Bulwark at 500/500. Underframe's five-second Luck Average returned 2,708 raw + 310 DoT damage per shot, 56,456 Average DPS, and 1.49 s TTK. The exact list fit in three Forma at 1/60 remaining capacity after assigning two Madurai and one Naramon slot polarity.

The common Tenno-Hub finite encounter scored this same list at 1.428414 s TTK / 58,679 DPS. Underframe's native TTK is about 4.3% longer and its Average DPS about 3.8% lower. This is one matched mod/rank/target fixture; Underframe's luck-averaged simulator and Tenno-Hub's finite expected encounter are not identical models, so the small difference does not establish which calculation is more accurate. The Underframe copy was restored to its original eight mods, ranks, and three-Forma layout afterward. Broader weapon and objective comparisons, optimizer optimality, and stochastic status histories remain open.

Reproduce the current common-model build and bounded Underframe-list neighborhood with `npx tsx scripts/comparePlannerBuilds.ts --saved-underframe --primary-bulwark --reoptimize --goal=timeToKill --analyze-underframe-swaps`. This replay uses Initial conditional state and the fixed 83,818 Health / 2,700 Armor target; the fully stacked 0.788-second comparison above is a separate fixture.

## Source-backed weapon augment parser and full-width refresh (2026-11-14)

The current source parser handles additive Final Status Chance percentage points for Entropy Burst and Napalm Grenades, plus compound conditional Gas / Viral-and-Magnetic damage with Status Chance for Leaded Gas and Biotic Rounds. This follow-up did not change optimizer search. The standard `npm run benchmark:build-planner` corpus ran 36 cases / 180 optimizations. Every output was legal under slot capacity and the three-Forma limit. Case medians ranged from 0.654s to 5.869s; maximum-of-five observations ranged from 0.668s to 5.898s. These five-run maxima are observations, not statistically robust population p95 estimates.

Lex Prime Burst is the clear latency exception: the full corpus recorded a 5.869s median / 5.898s maximum-of-five. An isolated five-run check measured 4.854s / 5.505s, and disabling Arcane plus Exilus search still measured 4.918s / 5.400s with the same legal mods, so those search dimensions do not explain the delay. Lex Prime Expected TTK measured 4.671s / 4.917s in the corpus and 3.826s / 3.976s isolated; its target dies at time zero under that fixture. The Lex Burst path needs profiling and further optimization without reducing candidate quality.

The current-source production Worker is 107,171 bytes. This Node-core corpus does not measure cold or packaged browser Workers, mobile devices, or production UI responsiveness. Full build-quality and objective-equivalent Underframe evidence remain open.

## Shattering Impact and Perigale picker follow-up (2026-11-14)

Shattering Impact now contributes its rank-scaled 1–6 flat base-Armor removal on each melee hit with nonzero quantized Impact damage, without requiring an Impact status proc. The target models permanent unscaled base-Armor removal before Heat and Corrosive percentage strips, using expected multishot as a mean-field number of hits. Charged/heavy Glaive throws are excluded; Melee Duplicate doubling and Archon/commandeered Prime immunity exceptions are not modeled. The rule follows the [WARFRAME Wiki Armor reference](https://wiki.warframe.com/w/Armor) and its Damage 3.0 quantization guidance.

Focused regressions cover ranks, low-Impact quantization, persistent armor reduction, percentage-strip order, and source attribution. The latest clean release checks pass at 602 tests / 49 files, production TypeScript/Vite build, source validation, and focused ESLint. The catalog-independent Worker is 105,901 bytes. A port-80 screenshot verified the weapon selector no longer collapses and is 360px wide. On the post-merge production build, in-app-browser QA selected Perigale Prime and verified that Owned Mods and the manual picker both show standard Serration beside Serration (Flawed). The reported only-Flawed state did not reproduce; the live page is left on Owned Mods filtered to Serration for manual review. This confirms current production behavior but does not identify why the earlier user profile differed. Desktop Node timings are not production-browser Worker measurements; cold/mobile timing, full-catalog optimality, and broad quality evidence remain open.

## Synth Charge optimizer corpus (2026-11-14)

The repeatable optimizer corpus now includes Lex Prime for Burst and Expected TTK. With the full 107-mod pool, five Burst runs returned the same legal 57/60 build using three Forma; median latency was 4.282 s and the maximum-of-five observation was 4.672 s. Synth Charge was screened but not selected over the stronger candidates in this fixture. Five Expected TTK runs returned the same legal 59/60 build using three Forma and evaluated 77 exact encounter candidates; median latency was 3.100 s and the maximum was 3.762 s. The default Corpus target dies on the first attack at time zero, so this is an optimizer latency sample, not a multi-shot final-shot kill-time comparison.

Separate regressions cover all Synth Charge ranks, one-hit distribution across multishot, the magazine requirement and excluded attack types, finite direct damage, and selection when Synth Charge is the only candidate. The coverage audit reports 468 parsed effects and 88 review candidates (17 partial, 71 fully unparsed) among 598 eligible mod records; no weapon pool lacks a parsed effect. Local release checks pass at 599 tests / 49 files, production TypeScript/Vite build, source validation, focused ESLint, and CRLF-aware diff checking. The catalog-independent Worker is 104,883 bytes. These are Windows x64 Node-core results, not browser Worker latency; production/cold/mobile measurements and full-catalog optimality remain open.

## Critical Focus aiming-condition parser (2026-11-14)

The parser now splits Critical Focus's combined critical-chance-and-damage line into equal rank-scaled critical chance and critical multiplier bonuses; its “when aiming” suffix maps to whileAiming. Tests cover all ranks for Corvas Prime, state assumptions, zero unmodeled damage lines, and the optimizer's ability to select it.

The five-run desktop Node benchmark used Initial conditional state for Burst and Expected TTK. Burst median was 1.723 s and the maximum observation was 2.036 s. Expected TTK median was 1.100 s and maximum 1.178 s; the returned build modeled 0.263 s across 78 exact encounter candidates. These measurements do not represent production-browser Worker latency or a statistically robust p95.

The source coverage audit reports 467 parsed records, 89 review candidates, 17 partial records and 72 fully unparsed flagged records from 598 eligible mods across 694 weapons. No eligible weapon pool lacks a parsed damage effect. The assignment remains open for broader mechanic and quality coverage, global optimality, and cold/mobile/cross-device Worker timing.

## Expected TTK refinement coverage and production baseline (2026-11-14)

The single-replacement Expected TTK shortlist now reserves an exact finite-encounter evaluation for each available effect family before taking a second candidate from any family. The cap increased from 24 to 40 to preserve elemental, tempo, critical, multishot, faction, status, and base-damage alternatives in the same pass. This remains a bounded heuristic; family labels choose which candidates receive the exact evaluator and do not guarantee a global optimum.

This change corrected a reproducible Braton Prime quality miss. Under the same fully stacked state, level-100 Grineer pools (83,818 Health / 2,700 Armor), rank-5 Primary Overcharge cap (350% multishot), and three-Forma limit, the prior optimizer list modeled 0.65613 s Expected TTK. A legal one-mod replacement, Bladed Rounds → Vile Acceleration, modeled 0.59085 s and was previously missed by the exact-evaluation shortlist. After balanced family coverage, the optimizer returns the 0.59085 s list directly. The captured Underframe Auto Build list models 0.76915 s under Tenno-Hub's same finite model; both displayed lists can be assigned legally at 59/60 capacity and three Forma. Tenno-Hub is 23.2% faster on this common expected model, not a claim about Underframe's native stochastic simulator. A bounded 1–4-mod substitution audit over the Underframe-only mods found no legal candidate faster than 0.59085 s. This remains one target/build fixture and a small competitor-neighborhood comparison.

Follow-up against the deployed 396107c code found that the family loop could spend a second candidate on early families before reaching tempo candidates. The shortlist now makes a first pass across all families before any second pass. On the fixture above this preserves Vile Acceleration in the exact-refinement set and returns the 0.59085 s build. The regression requires that mod and a result under 0.60 s. This changes ordering within a bounded shortlist; it does not prove the full candidate space optimal.

After the shortlist change, the 14-case Expected TTK corpus ran five times per case (70 optimizations). All results were deterministic and legal within three Forma. Medians ranged from 1.445 to 4.173 s; maximum-of-five observations ranged from 1.465 to 4.199 s. These maxima are coarse observations from five runs, not statistically robust population p95 estimates.

| Weapon / selected attack | Median | Max-of-five | Expected TTK | Forma | Legal |
|---|---:|---:|---:|---:|---|
| Perigale Prime / Normal Attack | 3.813 s | 3.942 s | 0.144 s | 3 | Yes |
| Braton Prime / Normal Attack | 3.595 s | 3.686 s | 1.593 s | 3 | Yes |
| Cedo / Glaive Radial Attack | 3.726 s | 3.855 s | 5.105 s | 3 | Yes |
| Phantasma Prime / Plasma Bomb Explosion | 3.265 s | 3.555 s | 2.490 s | 3 | Yes |
| Laetum / Normal Attack | 4.173 s | 4.199 s | 0.138 s | 3 | Yes |
| Cinta / Normal Attack | 3.536 s | 3.677 s | 1.059 s | 3 | Yes |
| Kuva Hek / Normal Attack | 2.950 s | 3.369 s | 0.200 s | 1 | Yes |
| Torid / Normal Attack | 3.323 s | 3.491 s | 1.333 s | 3 | Yes |
| Broken War / Normal Attack | 2.358 s | 2.555 s | 4.000 s | 2 | Yes |
| Corvas Prime / Normal Attack | 1.445 s | 1.465 s | 0.000 s | 3 | Yes |
| Verglas Prime / Normal Attack | 3.384 s | 3.506 s | 1.316 s | 3 | Yes |
| Epitaph / Charged Shot | 3.252 s | 3.303 s | 0.000 s | 3 | Yes |
| Nataruk / Perfect Shot | 2.511 s | 2.857 s | 0.000 s | 2 | Yes |
| Gram Prime / Heavy Slam Attack | 2.702 s | 2.731 s | 1.613 s | 3 | Yes |

As a separate production baseline at merge `396107c`, four warmed, blank-start Epitaph / Charged Shot runs at MR 0 with no Catalyst completed at 767, 789, 801, and 830 ms (795 ms median). Each returned the same legal four-mod 28/30 build. This is a narrow UI-to-result sample from the earlier shortlist version; it is neither a production measurement of the new 40-candidate refinement nor comparable to the MR 30 Node corpus above.

## Production UI and Incarnon path-search audit (2026-11-14)

The production app at merge commit `07e75a6` was exercised in the Codex in-app browser after deployment. Braton Prime / Normal Attack / Expected TTK used the uncatalyzed MR 0 setup, blank starting mod slots, and the Balanced synthetic target. Fifteen warmed optimize/reset runs completed. The observed result was a legal four-mod 30/30 build. Measured click-to-"Optimize Build"-enabled observations were 1,110, 921, 1,109, 1,063, 1,109, 920, 1,064, 950, 1,109, 1,032, 1,025, 1,041, 1,079, 942, and 952 ms (1,041 ms median; 1,110 ms maximum observation). Timing includes browser action and accessibility-state polling, so it is a UI-to-result observation, not a pure Worker duration or population p95. The production tab used for this measurement was temporary; the separate live manual-testing tab remained blank.

The reproducible `npx tsx scripts/auditIncarnonPathSearch.ts --weapon=...` audit now compares the current-path baseline as well as every evolved path. For Laetum Normal Attack, it compared 81 evolution paths plus the baseline with four max-rank mod candidates, three slots, two compatible Arcane families, and the Grineer 83,818 Health / 2,700 Armor target. The two-path shortlist found the same 6.3333 s Expected TTK winner as the full sweep (zero measured gap); the candidate-pool winner used zero Forma. The full 81-path optimizer sweep took 7.440 s on this Node run. For Torid Incarnon Form, the 18 evolution paths plus baseline used four max-rank mod candidates, three slots, two Arcane families, and the same target. Both searches retained the unevolved baseline at 217.6 s, with zero gap; the full 18-path sweep took 7.803 s. These checks measure shortlist quality only within these fixed candidate pools and target assumptions; they do not establish full-catalog mod-rank, path, Arcane, or global optimality. The multi-path full sweeps also exceed the five-second target, supporting the current bounded-refinement tradeoff.

The latest release gates pass at 588 tests across 49 files; `npm run build`, `npm run validate:sources`, focused planner ESLint, and CRLF-aware diff checking pass. The production optimizer Worker is 97,784 bytes. Vite retains its existing large lazy-chunk warning. Production cold-start, physical mobile-device, cross-device, and population-tail latency remain unmeasured.

## HiGHS runtime prototype and deployed production UI sample (2026-11-14)

The `highs@1.15.4` WebAssembly package was installed in a disposable temporary folder, without changing project dependencies. A 12-binary-variable additive surrogate enforced a four-slot count, capacity, and exclusivity groups. HiGHS reported an optimal objective of 799, equal to exhaustive enumeration of all 4,096 subsets. Solver initialization took 18.0 ms; the first solve took 53.5 ms and four warm solves had a 5.36 ms median. The ESM loader plus WASM measured 3,699,489 bytes raw / 1,258,610 bytes gzip. This prototype tests the binding and linear constraints only: it does not score real weapon damage or compare build quality. No solver dependency was added to the app.

The deployed production page at commit `f62362f` was also exercised in a real browser. Five warmed Braton Prime / Expected TTK optimizations at MR 0, uncatalyzed, and the Balanced synthetic target returned one legal 30/30 four-mod build with 4.21 s modeled TTK. Click-to-result times were 519, 417, 422, 415, and 420 ms (420 ms median, 519 ms maximum). Reset and reload restored the blank planner. This is a single desktop/browser UI measurement, not cold app startup, mobile latency, or a statistically robust tail estimate.

Release checks for this follow-up: `npm test` passes 577 tests across 49 files; `npm run build`, `npm run validate:sources`, planner ESLint, and CRLF-aware diff checking pass. The production optimizer Worker is 90,717 bytes.

## Joint Expected TTK quality oracle (2026-11-14)

The bounded exhaustive Expected TTK oracle now jointly searches legal mod sets and every rank of two compatible Arcanes across five attack profiles: Perigale Prime burst, Cedo glaive radial, Phantasma Prime charged explosion, Acrid forced-Toxin secondary, and Gram Prime heavy slam. Each case searches up to three max-rank mods drawn from four candidates, with actual slot capacity and ordered evaluation. The optimizer matches both the finite TTK and DPS values of the exhaustive winner in all five pools. A separate Braton Prime test includes Primary Bulwark and energy-gated Primary Overcharge. These exact results apply only to the stated small candidate sets; they do not validate evaluator assumptions independently or establish full-catalog/global optimality.

## Joint Arcane refinement full-width refresh (2026-11-13)

Command: `npx tsx scripts/benchmarkBuildOptimizer.ts --runs=5`

Five repetitions were run for each of 34 cases (170 optimizations) after Arcane/mod refinement was made iterative. The corpus spans Burst and Scaling proxy objectives, 13 Expected TTK cases, and Primary Overcharge with energy inputs. All 170 results were capacity-, uniqueness-, incompatibility-, and three-Forma-legal. Per-case medians ranged from 0.551 to 3.633 seconds; max-of-five p95 observations ranged from 0.641 to 3.855 seconds. Each p95 is the maximum of five observations, not a statistically stable tail estimate.

| Weapon / selected attack | Goal | Median | Max-of-five p95 | Forma | Legal |
|---|---|---:|---:|---:|---|
| Braton Prime | Burst | 2.830 s | 2.929 s | 3 | Yes |
| Cedo | Burst | 2.312 s | 2.457 s | 3 | Yes |
| Cedo / Glaive Radial Attack | Burst | 2.710 s | 2.813 s | 3 | Yes |
| Phantasma Prime / Plasma Bomb Explosion | Burst | 2.311 s | 2.466 s | 2 | Yes |
| Laetum | Burst | 2.956 s | 3.089 s | 3 | Yes |
| Cinta | Burst | 2.533 s | 2.665 s | 3 | Yes |
| Kuva Hek | Scaling | 2.229 s | 2.300 s | 2 | Yes |
| Torid | Scaling | 3.223 s | 3.338 s | 3 | Yes |
| Broken War | Burst | 2.729 s | 2.920 s | 3 | Yes |
| Corvas Prime | Burst | 1.101 s | 1.129 s | 3 | Yes |
| Verglas Prime | Burst | 2.624 s | 2.653 s | 3 | Yes |
| Phantasma Prime / Beam | Scaling | 2.390 s | 2.528 s | 3 | Yes |
| Rubico Prime | Burst | 2.431 s | 2.578 s | 3 | Yes |
| Perigale Prime | Burst | 1.968 s | 1.993 s | 3 | Yes |
| Epitaph / Charged Shot | Burst | 3.633 s | 3.855 s | 3 | Yes |
| Acrid | Scaling | 2.604 s | 2.657 s | 3 | Yes |
| Hystrix Prime / Fire Quill | Scaling | 2.940 s | 3.030 s | 2 | Yes |
| Nukor | Burst | 3.180 s | 3.453 s | 3 | Yes |
| Nataruk / Perfect Shot | Burst | 2.624 s | 2.703 s | 1 | Yes |
| Gram Prime / Heavy Slam Attack | Burst | 2.281 s | 2.352 s | 3 | Yes |
| Braton Prime / Primary Overcharge at 1,000 Max Energy, 100% Energy | Burst | 2.915 s | 3.157 s | 3 | Yes |
| Braton Prime | Expected TTK | 1.993 s | 2.073 s | 3 | Yes |
| Cedo / Glaive Radial Attack | Expected TTK | 1.768 s | 1.820 s | 2 | Yes |
| Phantasma Prime / Plasma Bomb Explosion | Expected TTK | 1.861 s | 1.925 s | 3 | Yes |
| Laetum | Expected TTK | 2.061 s | 2.144 s | 2 | Yes |
| Cinta | Expected TTK | 2.027 s | 2.180 s | 3 | Yes |
| Kuva Hek | Expected TTK | 1.097 s | 1.200 s | 1 | Yes |
| Torid | Expected TTK | 1.883 s | 1.936 s | 3 | Yes |
| Broken War | Expected TTK | 1.304 s | 1.379 s | 2 | Yes |
| Corvas Prime | Expected TTK | 0.551 s | 0.641 s | 3 | Yes |
| Verglas Prime | Expected TTK | 2.088 s | 2.104 s | 3 | Yes |
| Epitaph / Charged Shot | Expected TTK | 2.230 s | 2.285 s | 3 | Yes |
| Nataruk / Perfect Shot | Expected TTK | 1.416 s | 1.514 s | 1 | Yes |
| Gram Prime / Heavy Slam Attack | Expected TTK | 1.653 s | 1.711 s | 3 | Yes |

A separate `--runs=1 --verify-arcane-selection` pass audited each returned fixed mod list against the supplied Arcane ranks. All 34 cases selected a best Arcane for the final returned list, with zero measured gap. This is conditional-on-build evidence, not proof of joint or global mod/Arcane optimality. The production build emits a 90,717-byte catalog-independent optimizer Worker; Vite continues to report existing large lazy chunks. Packaged Worker, cold-start, mobile, and cross-device latency remain unmeasured.

## Expected TTK objective, targeted Braton Prime run (2026-11-12)

Command: `npx tsx scripts/benchmarkBuildOptimizer.ts --weapon=Braton Prime --runs=5 --goal=timeToKill`

The Expected TTK objective screens builds with the fast sustained proxy, then applies up to two bounded passes of finite-encounter one-mod replacement ranking. The isolated five-run Braton refresh returned the same legal 60/60 build, three Forma, Primary Merciless R5, and 1.5932 s expected TTK at 15,691.38 expected encounter damage/s. It evaluated 61 encounter candidates on each run. The proxy score (39,301.33) remains separately reported and is not used as the final finite-kill ranking. Optimizer time was 3.006 s median and 3.219 s max-of-five p95; observations ranged from 2.883 to 3.219 s.

The target uses the Grineer faction preset, MR 30, max-rank mods, Catalyst, Exilus and Arcane optimization, Initial conditional state, and a three-Forma cap. Port-80 QA saved a named temporary Expected TTK build, reloaded the page, loaded the save, and verified that its objective and target explanation restored; the temporary save was then removed and the planner returned to its empty state. A separate uncatalyzed MR 0 Braton run on the Balanced synthetic target completed five port-80 dev-Worker clicks in 497–622 ms (504 ms median; 622 ms max-of-five p95), with the same legal 30/30 four-mod build and 4.21 s finite TTK. This is one desktop Node scenario plus a warmed dev-server browser scenario; neither establishes global optimality or broad objective parity with Underframe. It also does not measure production-packaged Worker, cold-start, or mobile latency. Use `--weapon=Braton Prime --goal=timeToKill` to isolate the Node case and `--runs=N` to change repetitions.

## Expected TTK 13-case weapon/attack refresh (2026-11-12)

Command: `npx tsx scripts/benchmarkBuildOptimizer.ts --runs=5 --goal=timeToKill`

All cases used MR 30, max-rank mods, Catalyst, Exilus and Arcane optimization, Initial conditional state, and up to three Forma. Targets used the script's Grineer or Corpus faction presets, without a custom target profile. Each row returned the same build in all five runs, and every build passed capacity, incompatibility, unique-mod, and Forma-limit checks. Timings are optimizer-core Node measurements; they do not represent a browser Worker or device-independent performance.

| Weapon / selected attack | Median | Max-of-five p95 | Expected TTK | Forma | Legal |
|---|---:|---:|---:|---:|---|
| Braton Prime | 3.254 s | 3.580 s | 1.593 s | 3 | Yes |
| Cedo / Glaive Radial Attack | 2.921 s | 3.104 s | 6.842 s | 2 | Yes |
| Phantasma Prime / Plasma Bomb Explosion | 2.772 s | 2.857 s | 2.490 s | 3 | Yes |
| Laetum | 3.357 s | 3.515 s | 0.160 s | 2 | Yes |
| Cinta | 2.766 s | 2.884 s | 1.059 s | 3 | Yes |
| Kuva Hek | 2.358 s | 2.489 s | 0.288 s | 1 | Yes |
| Torid | 3.664 s | 3.786 s | 1.000 s | 3 | Yes |
| Broken War | 2.767 s | 2.932 s | 4.000 s | 2 | Yes |
| Corvas Prime | 1.293 s | 1.298 s | 0.263 s | 3 | Yes |
| Verglas Prime | 3.184 s | 3.248 s | 1.316 s | 3 | Yes |
| Epitaph / Charged Shot | 3.220 s | 3.272 s | 0.000 s | 3 | Yes |
| Nataruk / Perfect Shot | 2.352 s | 2.361 s | 1.000 s | 1 | Yes |
| Gram Prime / Heavy Slam Attack | 2.202 s | 2.274 s | 0.806 s | 3 | Yes |

The per-case max-of-five p95 observations range from 1.298 to 3.786 s. A TTK of 0.000 s means the expected encounter kills on its first attack, whose start is the timeline origin. The melee rows use the existing attack-time proxies and are not stance-sequence validations. This is broader latency and legality evidence for the objective, not a quality ranking against exhaustive full-catalog optima or Underframe.

## Current full 20-case Node refresh with energy-scaled Arcane coverage (2026-11-12)

The full-width harness ran five repetitions per scenario (100 optimizer calls) after the Primary Overcharge implementation. It includes the 19-case weapon/attack corpus plus Braton Prime with Primary Overcharge optimization supplied 1,000 Max Energy and 100% current Energy. Every returned build passed capacity, unique-name, incompatibility-group, and three-Forma checks. Per-case medians ranged from 0.911 to 2.935 seconds; max-of-five p95 observations ranged from 0.924 to 2.967 seconds. The energy-gated Braton case measured 2.363 seconds median / 2.402 seconds max-of-five p95 and returned a legal three-Forma result.

The harness's shared assumptions remain MR 30, max-rank catalog mods, Catalyst, Exilus and Arcane optimization, Initial weapon-conditional state, and up to three Forma. Faction presets are used; custom target profiles and profile-owned Rivens are not supplied. The Primary Overcharge case explicitly supplies its energy inputs; other cases do not exercise that energy-scaled Arcane. Timings are Windows x64 / Node 22.16.0 desktop-core measurements, not packaged Worker, cold-start, mobile, or cross-device latency. Max-of-five p95 is a coarse observation, not a population-tail estimate.

| Weapon / selected attack | Median | Max-of-five p95 | Forma | Legal |
|---|---:|---:|---:|---|
| Braton Prime / Normal Attack | 2.441 s | 2.621 s | 3 | Yes |
| Cedo / Normal Attack | 1.945 s | 2.025 s | 3 | Yes |
| Cedo / Glaive Radial Attack | 2.271 s | 2.280 s | 3 | Yes |
| Phantasma Prime / Plasma Bomb Explosion | 1.878 s | 1.916 s | 2 | Yes |
| Laetum / Normal Attack | 2.412 s | 2.473 s | 3 | Yes |
| Cinta / Quick Shot | 2.065 s | 2.108 s | 3 | Yes |
| Kuva Hek / Normal Attack | 1.853 s | 1.890 s | 2 | Yes |
| Torid / Grenade Impact | 2.712 s | 2.757 s | 3 | Yes |
| Broken War / Normal Attack | 2.152 s | 2.246 s | 3 | Yes |
| Corvas Prime / Uncharged Shot | 0.911 s | 0.924 s | 3 | Yes |
| Verglas Prime / Normal Attack | 2.118 s | 2.273 s | 3 | Yes |
| Phantasma Prime / Beam | 1.966 s | 2.015 s | 3 | Yes |
| Rubico Prime / Normal Attack | 1.895 s | 1.937 s | 3 | Yes |
| Epitaph / Charged Shot | 2.935 s | 2.967 s | 3 | Yes |
| Acrid / Normal Attack | 2.048 s | 2.154 s | 3 | Yes |
| Hystrix Prime / Fire Quill | 2.415 s | 2.452 s | 2 | Yes |
| Nukor / Normal Attack | 2.576 s | 2.605 s | 3 | Yes |
| Nataruk / Perfect Shot | 2.138 s | 2.173 s | 1 | Yes |
| Gram Prime / Heavy Slam Attack | 1.789 s | 1.816 s | 3 | Yes |

| Braton Prime / Primary Overcharge at 1,000 / 100% Energy | 2.363 s | 2.402 s | 3 | Yes |

A one-run Braton-only `--verify-arcane-selection` replay selected no Arcane when energy inputs were missing and selected rank-5 Primary Overcharge with the explicit energy inputs. The verifier found no higher-scoring available Arcane rank for either returned fixed mod set. This is conditional-on-build rank validation, not joint/global optimality evidence.

This run refreshes the 19-case timing corpus below and adds energy-aware Arcane runtime coverage. It does not establish finite-encounter optimality, full-catalog build quality, Underframe winner parity, or production/mobile performance.

## Prior 19-case Node refresh before energy-scaled Arcane coverage (2026-11-12)

After adding the Nukor unique-status scoring path, the full-width harness ran five repetitions for each of 19 cases (95 optimizer calls). All returned builds were capacity-legal and within the three-Forma limit. Per-case medians ranged from 0.921 to 2.984 seconds; max-of-five p95 observations ranged from 0.956 to 3.039 seconds. Nukor Normal Attack returned a legal three-Forma build with a 2.664-second median and 2.684-second max-of-five p95 observation. This is a Windows x64 / Node 22.16.0 desktop-core measurement; it does not measure the packaged browser Worker, cold starts, mobile devices, or cross-device latency. Max-of-five p95 is a coarse observation, not a population-tail estimate.

The corpus assumptions remain MR 30, max-rank catalog mods, Catalyst, Exilus and arcane optimization, Initial weapon-conditional state, and a maximum of three Forma, with faction presets and no profile-owned custom Rivens. The Initial setting disables weapon-triggered bonuses; the objective still models expected target status progression. The bounded optimizer oracle separately checks the exact best proxy score for curated legal candidate sets.

| Weapon / selected attack | Median | Max-of-five p95 | Forma | Legal |
|---|---:|---:|---:|---|
| Braton Prime / Normal Attack | 2.508 s | 2.719 s | 3 | Yes |
| Cedo / Normal Attack | 1.940 s | 2.056 s | 3 | Yes |
| Cedo / Glaive Radial Attack | 2.290 s | 2.346 s | 3 | Yes |
| Phantasma Prime / Plasma Bomb Explosion | 1.849 s | 1.967 s | 2 | Yes |
| Laetum / Normal Attack | 2.425 s | 2.479 s | 3 | Yes |
| Cinta / Quick Shot | 2.065 s | 2.084 s | 3 | Yes |
| Kuva Hek / Normal Attack | 1.878 s | 1.897 s | 2 | Yes |
| Torid / Grenade Impact | 2.704 s | 2.918 s | 3 | Yes |
| Broken War / Normal Attack | 2.218 s | 2.262 s | 3 | Yes |
| Corvas Prime / Uncharged Shot | 0.921 s | 0.956 s | 3 | Yes |
| Verglas Prime / Normal Attack | 2.149 s | 2.179 s | 3 | Yes |
| Phantasma Prime / Beam | 1.969 s | 2.034 s | 3 | Yes |
| Rubico Prime / Normal Attack | 1.897 s | 1.987 s | 3 | Yes |
| Epitaph / Charged Shot | 2.984 s | 3.039 s | 3 | Yes |
| Acrid / Normal Attack | 2.085 s | 2.097 s | 3 | Yes |
| Hystrix Prime / Fire Quill | 2.445 s | 2.461 s | 2 | Yes |
| Nukor / Normal Attack | 2.664 s | 2.684 s | 3 | Yes |
| Nataruk / Perfect Shot | 2.113 s | 2.187 s | 1 | Yes |
| Gram Prime / Heavy Slam Attack | 1.831 s | 1.878 s | 3 | Yes |

All cases are below the five-second desktop Node-core target in this five-run batch. The prior 18-case result is preserved below for comparison. This does not establish a reliable population-tail estimate, global optimality, finite-encounter optimality, Underframe parity, or packaged/cold/mobile performance.

## Port-80 dev Worker cross-category refresh (2026-11-12)

Five click-to-result runs per case were measured in the ChatGPT in-app browser against the local Vite dev server on port 80. The timer starts immediately before the Optimize Build click and stops when that control becomes enabled again. Scenarios use Mastery Rank 0, an uncatalyzed weapon, the displayed base capacity, default Burst objective and balanced synthetic target, and no owned-only restriction. Nataruk uses Perfect Shot; Corvas Prime uses Uncharged Shot. All five runs in every case returned capacity-legal builds. These are warmed development-server UI/Worker observations on one desktop, not production-build, cold-start, mobile, or cross-device latency; max-of-five is only a coarse upper observation.

| Weapon / attack | Five click-to-result observations | Median | Max of five | Final capacity |
|---|---|---:|---:|---:|
| Braton Prime / Normal Attack | 384, 374, 367, 380, 359 ms | 374 ms | 384 ms | 30/30 |
| Cedo / Normal Attack | 508, 501, 490, 488, 492 ms | 492 ms | 508 ms | 27/30 |
| Laetum / Normal Attack | 451, 461, 458, 451, 450 ms | 451 ms | 461 ms | 30/30 |
| Broken War / Normal Attack | 667, 639, 646, 663, 660 ms | 660 ms | 667 ms | 39/40, including stance |
| Nataruk / Perfect Shot | 584, 587, 574, 571, 570 ms | 574 ms | 587 ms | 30/30 |
| Verglas Prime / Normal Attack | 399, 375, 386, 386, 384 ms | 386 ms | 399 ms | 29/30 |
| Corvas Prime / Uncharged Shot | 410, 402, 399, 408, 408 ms | 408 ms | 410 ms | 30/30 |

The measured medians range from 374 to 660 ms; max-of-five observations range from 384 to 667 ms. Each final displayed build fit its weapon capacity. Browser QA also found that changing the conditional-state selector updated calculated stats but left the previous optimizer score and leave-one-out explanation displayed as if they matched the new assumptions. The explanation and cached math view are now gated by the objective, attack, faction, conditional-state, and target-context snapshot used at optimization time. A mismatch displays a clear rerun notice; returning to the original context restores the matching explanation. Port-80 verification reproduced the Corvas Primed Deadly Efficiency choice in Realistic mode, switched to Initial (the trigger bonus disappeared from the live stats and the stale-explanation notice appeared), reset the temporary build, restored Realistic, and reloaded to the empty planner. This fixes explanation freshness; it does not measure production Worker or device-class latency.

## Fresh Underframe Braton Auto Build comparison (2026-11-12)

A new editable local Underframe build was created and run in the ChatGPT in-app browser. It used Braton Prime Normal Attack, Grineer, custom target pools of 83,818 Health / 2,700 Armor / 0 Shields / 0 Overguard, a five-second simulation, Luck Averaged DPS, final refinement, and a three-Forma search limit. The selected settings were the saved `Copy of Default`, elemental candidates on, Cost Control on, and Arcanes on. The visible conditional sliders were Galvanized Chamber 5/5, Galvanized Aptitude 2/2, and Primary Overcharge 350/350.

Underframe returned these eight mods: High Voltage R3, Infected Clip R5, Thermite Rounds R3, Galvanized Chamber R10, Vile Acceleration R5, Galvanized Aptitude R10, Vital Sense R5, and Radiated Reload R3. Its five-second Luck Average displayed 5,492 raw + 1 DoT damage per shot, 105,867 Average DPS, and 0.80-second TTK. The same page displayed `Capacity: -18 / 60` and `Forma Count: 0`, so the returned configuration itself was 18 capacity over. Reassigning those exact mods and ranks in Tenno-Hub's capacity solver fits at 59/60 with three Forma; that establishes a legal reconfigured candidate, not legality of Underframe's displayed output.

For a common-model replay, both mod lists were scored against the same target in Tenno-Hub's fully stacked Burst objective and expected finite encounter. Tenno-Hub was re-optimized with the same target, capacity, and three-Forma cap for that conditional state. The optimizer selected Malignant Force R3, Rime Rounds R3, Thermite Rounds R3, Primed Bane of Grineer R10, Spectral Serration R10, Galvanized Chamber R10, Vile Acceleration R5, and Continuous Misery R3; it fits 60/60 with three Forma. The common proxy scores were 200,122.55 for Tenno-Hub and 87,451.79 for the captured Underframe list, but their expected finite-encounter TTKs were 2.22 s and 1.54 s, respectively. This is a counterexample to treating the fast proxy score as a reliable ranking of encounter TTK for every build, and the search objective needs calibration against the finite encounter.

The first common-model replay omitted Primary Overcharge because Tenno-Hub lacked Max Energy/current-energy inputs. That gap is now implemented and the cap-equivalent comparison follows below. The initial no-Arcane scores are retained in the command history; they are not the current matched comparison.

### Primary Overcharge cap-equivalent replay (2026-11-12)

The Arcane now uses explicit Warframe Max Energy and current-Energy percentage inputs. The catalog reads its 90% activation threshold, 35%-of-Max-Energy formula, and rank caps. Unknown inputs leave the effect out of both calculation and Arcane optimization; known values are saved in planner builds and JSON exports. The calculation holds the entered energy state constant and does not simulate energy use or regeneration during an encounter.

The Underframe page showed Primary Overcharge at 350/350. To replay that cap in Tenno-Hub, both candidates received rank-5 Primary Overcharge at 1,000 Max Energy and 100% current Energy (350% additional multishot). With the same fully stacked mod conditional, target, and three-Forma limit, Tenno-Hub re-optimized to a legal 60/60 build. Reassigning the exact Underframe list fit 59/60 with three Forma. The Tenno-Hub fast proxy scored its build 487,299.11 and the captured Underframe list 180,414.79, while the finite expected encounter estimated 0.824 s and 0.769 s TTK. Underframe's native Luck Average was 105,867 DPS / 0.80 s TTK; the common model estimated 109,013 DPS / 0.769 s for that list under this cap-equivalent assumption. The close native/common result is a narrow Braton check; the proxy still ranks the lists differently from expected TTK, so this is not general optimizer-parity evidence.

Port 80 verified 1,000 Max Energy and 100% current Energy add 350.0% multishot, 89% current Energy removes the bonus, and Optimize Arcane selects rank-5 Primary Overcharge after the selected card is cleared. Reload restored the empty planner. `npx tsx scripts/comparePlannerBuilds.ts --fresh-underframe --fully-stacked --reoptimize --primary-overcharge` reproduces the cap-equivalent common replay. The comparison treats Underframe's 350/350 slider as the cap and maps it to 1,000 Max Energy / 100% current Energy; that input mapping is an explicit assumption, not a captured energy value.

### Expected TTK objective matchup refresh (2026-11-12)

Command: `npx tsx scripts/comparePlannerBuilds.ts --fresh-underframe --fully-stacked --reoptimize --primary-overcharge --goal=timeToKill`

The same Braton Prime Normal Attack, level-100 Heavy Gunner pools (83,818 Health / 2,700 Armor / no Shields or Overguard), fully stacked conditionals, and cap-equivalent rank-5 Primary Overcharge were re-evaluated under the finite Expected TTK objective. Tenno-Hub selected Malignant Force R3, Rime Rounds R3, Thermite Rounds R3, Primed Bane of Grineer R10, Spectral Serration R10, Galvanized Aptitude R10, Vile Acceleration R5, and Bladed Rounds R5. It fits 60/60 with three Forma. The captured Underframe list fits 59/60 after polarity reassignment and also uses three Forma.

| Fixed build scored by Tenno-Hub's common finite encounter | Fast screening proxy | Expected TTK | Attacks | Direct damage | Status damage | Capacity / Forma |
|---|---:|---:|---:|---:|---:|---|
| Tenno-Hub Expected TTK optimizer | 320,176.07 | 0.824 s | 16 | 83,818 | 0 | 60/60, 3 |
| Captured Underframe Auto Build | 131,417.46 | 0.769 s | 15 | 83,818 | 0 | 59/60, 3 |

The Underframe list kills about 7.1% sooner in this common model, even though the fast proxy ranks Tenno-Hub much higher. Both finite encounters happen to deal only direct damage in this scenario; the comparison does not validate stochastic proc histories or random TTK distributions. Underframe's own captured five-second stochastic sample showed 105,867 DPS and 0.80 s TTK, while the common expected model estimates that fixed list at 109,013 DPS and 0.769 s. This is one configuration and remains evidence against a completion claim: the Expected TTK objective has not yet demonstrated parity with the captured competitor winner on this fixture, and no broad winner corpus is available.

## Prior full 18-case Node refresh (2026-11-12)

The benchmark corpus now includes two forced-status secondaries: Acrid Normal Attack and Hystrix Prime Fire Quill. Five repetitions per case (90 optimizer calls) used MR 30, max-rank catalog mods, Catalyst, Exilus and arcane optimization, Initial conditional state, and a maximum of three Forma. All runs returned capacity-legal builds within the Forma cap. Each case returned a consistent build and score across its five repetitions. Per-case medians ranged from 0.899 to 2.991 seconds; max-of-five p95 observations ranged from 0.913 to 3.012 seconds. This is a desktop Node-core benchmark, not packaged-browser, cold-start, or mobile latency.

| Weapon / selected attack | Median | Max-of-five p95 | Forma | Legal |
|---|---:|---:|---:|---|
| Braton Prime / Normal Attack | 2.391 s | 2.663 s | 3 | Yes |
| Cedo / Normal Attack | 1.905 s | 1.943 s | 3 | Yes |
| Cedo / Glaive Radial Attack | 2.218 s | 2.313 s | 3 | Yes |
| Phantasma Prime / Plasma Bomb Explosion | 1.862 s | 1.875 s | 2 | Yes |
| Laetum / Normal Attack | 2.402 s | 2.432 s | 3 | Yes |
| Cinta / Quick Shot | 2.070 s | 2.109 s | 3 | Yes |
| Kuva Hek / Normal Attack | 1.858 s | 1.896 s | 2 | Yes |
| Torid / Grenade Impact | 2.690 s | 2.726 s | 3 | Yes |
| Broken War / Normal Attack | 2.195 s | 2.231 s | 3 | Yes |
| Corvas Prime / Uncharged Shot | 0.899 s | 0.913 s | 3 | Yes |
| Verglas Prime / Normal Attack | 2.136 s | 2.178 s | 3 | Yes |
| Phantasma Prime / Beam | 1.950 s | 2.013 s | 3 | Yes |
| Rubico Prime / Normal Attack | 1.887 s | 1.977 s | 3 | Yes |
| Epitaph / Charged Shot | 2.991 s | 3.012 s | 3 | Yes |
| Acrid / Normal Attack | 2.066 s | 2.076 s | 3 | Yes |
| Hystrix Prime / Fire Quill | 2.341 s | 2.388 s | 2 | Yes |
| Nataruk / Perfect Shot | 2.110 s | 2.134 s | 1 | Yes |
| Gram Prime / Heavy Slam Attack | 1.772 s | 1.787 s | 3 | Yes |

The Acrid and Hystrix Prime attack selections were checked against the Wiki-backed forced-proc metadata and their returned builds were stable in separate five-run checks as well. The corpus measures legality, determinism, and runtime under the shared proxy; it does not establish full-catalog optimality, finite-encounter optimality, or Underframe optimizer-winner parity.

## Prior full 16-case Node refresh (2026-11-12)

The full-width harness ran five repetitions for each case (80 optimization calls) with MR 30, max-rank mods, Catalyst, Exilus and arcane optimization, initial conditional state, and at most three Forma. Every run returned a capacity-legal build within the Forma cap. The per-case medians ranged from 0.945 to 2.885 seconds; max-of-five p95 observations ranged from 0.955 to 2.940 seconds. This is a desktop Node measurement of the optimizer core, not production Worker, cold-start, or mobile latency. Default faction profiles were used, with no custom nearby-target assumptions.

| Weapon / selected attack | Median | Max-of-five p95 | All five runs legal |
|---|---:|---:|---|
| Braton Prime | 2.416 s | 2.628 s | Yes |
| Cedo | 1.868 s | 1.933 s | Yes |
| Cedo / Glaive Radial Attack | 2.244 s | 2.278 s | Yes |
| Phantasma Prime / Plasma Bomb Explosion | 1.875 s | 1.953 s | Yes |
| Laetum | 2.434 s | 2.462 s | Yes |
| Cinta | 2.185 s | 2.202 s | Yes |
| Kuva Hek | 1.853 s | 1.889 s | Yes |
| Torid | 2.757 s | 2.897 s | Yes |
| Broken War | 2.206 s | 2.283 s | Yes |
| Corvas Prime | 0.945 s | 0.955 s | Yes |
| Verglas Prime | 2.113 s | 2.248 s | Yes |
| Phantasma Prime / Beam | 1.943 s | 2.030 s | Yes |
| Rubico Prime | 1.904 s | 1.943 s | Yes |
| Epitaph / Charged Shot | 2.885 s | 2.940 s | Yes |
| Nataruk / Perfect Shot | 1.750 s | 1.887 s | Yes |
| Gram Prime / Heavy Slam Attack | 1.778 s | 1.840 s | Yes |

## HiGHS solver fit assessment

Research was refreshed 2026-11-12 against the [`highs` npm package](https://www.npmjs.com/package/highs), the maintained [`highs-js` documentation](https://github.com/lovasoa/highs-js), the [1.15.4 release notes](https://github.com/lovasoa/highs-js/releases/tag/v1.15.4), and the [upstream HiGHS model specification](https://ergo-code.github.io/HiGHS/stable/). HiGHS supports LP/MILP and convex QP, but the upstream specification says its MIP model is linear and that QP support is not mixed-integer. Its browser Wasm solve calls are synchronous after asynchronous initialization and the documented build is single-threaded; non-trivial browser solves therefore belong in a Worker. Persistent models require explicit disposal. An initial 2026-11-12 install attempt could not resolve `registry.npmjs.org` (`ENOTFOUND`). A later isolated 2026-11-16 install succeeded under `.tmp/` without changing project dependencies, enabling the matched-pool comparison below.

The Build Planner's decisions and hard limits (mod/rank/slot selection, incompatibility, capacity, Forma, Exilus, arcane, and evolution choices) are discrete and many can be expressed with binary or integer variables. Its score is nonlinear, however: Damage 3.0 quantization and multiplicative modifiers combine with critical expectation, multishot, ordered elemental composition, status proc weights, pool-specific damage, reload duty cycle, and conditional effects. A plain MILP that assigns one isolated coefficient per mod would be a surrogate and can miss the interactions that matter to the actual selected objective. Exact linearization would require bounded state/interaction variables and would still need the verified damage engine to re-score candidates.

The model-shape review rejects HiGHS as a drop-in build scorer: slot, rank, compatibility, and capacity decisions are linearizable, but the actual build objective is nonlinear and order/state dependent. The current solver remains a hybrid beam search with hard feasibility checks, a fast target-pool progress proxy (not the full finite encounter), single- and small multi-mod refinement, arcane/Exilus evaluation, and capacity-aware polarity/Forma assignment. It matches bounded nine-candidate/five-slot exhaustive legal-build oracles across eleven weapon/attack scenarios and beats the pre-overhaul outputs on the six-case common-score comparison. This supports the current hybrid over the legacy implementation, but it does not prove global optimality. The direct HiGHS shortlist comparison below found no quality or runtime reason to integrate it.

### Matched HiGHS shortlist experiment (2026-11-16)

The `highs@1.15.4` WebAssembly solver was evaluated on the same eleven fixed nine-mod pools used by the exhaustive Burst-oracle regression. Each case used five slots, max-rank mods, Rank 30 / Catalyst / MR 30 capacity, default weapon polarities, no Forma, no Exilus, and no Arcane. The MILP used binary mod/slot variables so its capacity and slot assignments were legal; it enforced the optimizer's unique-name and incompatibility groups. Its linear objective summed each mod's exact single-mod Burst score delta from the unmodded build. HiGHS returned the top K distinct mod sets through no-good cuts; every returned set was then enumerated across all orders and rescored with the exact Tenno-Hub engine. The oracle enumerated all legal ordered subsets of up to five mods (182,290 total order evaluations).

| Weapon / attack | Hybrid gap | HiGHS top 32 gap | HiGHS top 128 gap |
|---|---:|---:|---:|
| Braton Prime | 0% | 0% | 0% |
| Cedo / Glaive Radial Attack | 0% | 45.19% | 0% |
| Phantasma Prime / Plasma Bomb Explosion | 0% | 0% | 0% |
| Phantasma Prime / Beam | 0% | 0% | 0% |
| Laetum | 0% | 0% | 0% |
| Rubico Prime | 0% | 0% | 0% |
| Epitaph / Charged Shot | 0% | 0% | 0% |
| Acrid / Normal Attack | 0% | 0% | 0% |
| Hystrix Prime / Fire Quill | 0% | 0% | 0% |
| Broken War | 0% | 0% | 0% |
| Gram Prime / Heavy Slam Attack | 0% | 0% | 0% |

The existing hybrid matched the exhaustive oracle in all eleven cases. The exact-reranked top-32 HiGHS set matched ten of eleven (mean gap 4.11%, with the Cedo radial pool 45.19% below the oracle); top 128 matched all eleven. The 352 top-32 MILP solves took 6.63 s total; 1,408 top-128 solves took 72.58 s total. The existing hybrid averaged 104 ms per case on the same Node run. These HiGHS timings exclude exact re-ranking and are not browser Worker measurements. The ESM plus Wasm files measured 3,699,489 bytes raw and 1,260,003 bytes when their separately gzipped sizes are summed.

This bounded Burst-only result favors the existing hybrid on quality at practical shortlist size and on runtime. It does not prove full-catalog or global optimality, and it does not test finite Expected TTK, Forma search, full mod/Arcane/Exilus pools, conditional histories, browser cold start, or mobile cost. No HiGHS app dependency or runtime stage was added. The temporary harness and raw JSON outputs are under the ignored `.tmp/highs-audit-20261116/` folder.

## Prior full 16-case refresh after Primary Bulwark work (2026-11-12)

Five repetitions per scenario (80 optimizations) used MR 30, max-rank mods, Catalyst, Exilus and arcane optimization, Initial conditional state, and a maximum of three Forma. All runs returned legal builds within the Forma limit; each case also returned the same mod list and score across its five repetitions. These are desktop Node-core timings, not packaged-browser, cold-start, or mobile measurements.

| Weapon / selected attack | Median | Max-of-five p95 | Forma | Legal |
|---|---:|---:|---:|---|
| Braton Prime | 2.434 s | 2.710 s | 3 | Yes |
| Cedo | 1.903 s | 1.968 s | 3 | Yes |
| Cedo / Glaive Radial Attack | 2.301 s | 2.324 s | 3 | Yes |
| Phantasma Prime / Plasma Bomb Explosion | 1.845 s | 1.980 s | 2 | Yes |
| Laetum | 2.433 s | 2.479 s | 3 | Yes |
| Cinta | 2.085 s | 2.161 s | 3 | Yes |
| Kuva Hek | 1.856 s | 1.906 s | 2 | Yes |
| Torid | 2.782 s | 2.824 s | 3 | Yes |
| Broken War | 2.194 s | 2.244 s | 3 | Yes |
| Corvas Prime | 0.932 s | 0.940 s | 3 | Yes |
| Verglas Prime | 2.113 s | 2.214 s | 3 | Yes |
| Phantasma Prime / Beam | 1.959 s | 2.019 s | 3 | Yes |
| Rubico Prime | 1.898 s | 1.961 s | 3 | Yes |
| Epitaph / Charged Shot | 2.905 s | 2.947 s | 3 | Yes |
| Nataruk / Perfect Shot | 2.118 s | 2.137 s | 1 | Yes |
| Gram Prime / Heavy Slam Attack | 1.812 s | 1.891 s | 3 | Yes |

The median range is 0.932–2.905 s; the max-of-five p95 range is 0.940–2.947 s. A separate reproducible one-run pass using `node --import tsx/esm scripts/benchmarkBuildOptimizer.ts --runs=1 --verify-arcane-selection` rescored each available arcane rank against every returned final mod/Exilus set. All 16 selected arcanes were the best option conditional on that fixed returned build (zero score gap). A bounded optimizer test also enumerates every ordered legal subset of six Braton candidates in up to four slots, rescoring every compatible arcane rank at 1,500 Warframe Armor. The hybrid matches this small joint optimum and selects Primary Bulwark R5. Neither result proves joint/global arcane-and-mod optimality across the full catalog. The optional benchmark audit is post-search and its time is excluded from optimizer latency. The regression suite now passes 542 tests across 48 files; production build, source validation, focused ESLint, and CRLF-aware diff check pass, with the optimizer Worker at 59,693 bytes.

## Scenario and results

### Heavy-attack combo projection full-width refresh (2026-11-11)

After adding a one-heavy-attack combo-retention projection, reran the full-width 16-case benchmark with five runs per scenario, MR 30, max-rank mods, Catalyst, Exilus and arcane optimization, initial conditional state, and up to three Forma. All 16 returned legal builds. Median times ranged from 0.918 to 2.920 seconds; max-of-five p95 observations ranged from 0.941 to 3.029 seconds. The Gram Prime Heavy Slam case completed at a 1.774-second median / 1.843-second max-of-five p95 and returned a legal 57/60 build with three Forma. These are Node-core timings, not packaged-browser, cold-start, or mobile Worker measurements; the heavy-attack objective still holds its starting combo tier across scored hits.

### Condition Overload / conditional attack-speed refresh (2026-11-11)

After adding an explicit external-status input for Condition Overload and retaining conditional attack-speed effects in the scorer, the full sixteen-case five-run harness was rerun on Windows x64 / Node.js v22.16.0 (28 logical CPUs). It used MR 30, max-ranked mods, a Catalyst, Exilus and arcane optimization, initial conditional state, and up to three Forma. All 16 cases returned capacity-, uniqueness-, incompatibility-, and Forma-legal builds. Each p95 below is the maximum of five observations, not a statistically stable tail estimate.

| Weapon / attack | Goal / target | Median | p95 (max of 5) | Forma | Legal |
| --- | --- | ---: | ---: | ---: | --- |
| Braton Prime / Normal Attack | Burst / Grineer | 2.420 s | 2.663 s | 3 | Yes |
| Cedo / Normal Attack | Burst / Grineer | 1.950 s | 2.062 s | 3 | Yes |
| Cedo / Glaive Radial Attack | Burst / Grineer | 2.223 s | 2.263 s | 3 | Yes |
| Phantasma Prime / Plasma Bomb Explosion | Burst / Grineer | 1.869 s | 1.911 s | 2 | Yes |
| Laetum / Normal Attack | Burst / Corpus | 2.393 s | 2.438 s | 3 | Yes |
| Cinta / Quick Shot | Burst / Grineer | 2.155 s | 2.213 s | 2 | Yes |
| Kuva Hek / Normal Attack | Scaling / Grineer | 1.865 s | 1.904 s | 2 | Yes |
| Torid / Grenade Impact | Scaling / Corpus | 2.727 s | 2.772 s | 3 | Yes |
| Broken War / Normal Attack | Burst / Grineer | 2.227 s | 2.283 s | 3 | Yes |
| Corvas Prime / Uncharged Shot | Burst / Corpus | 0.907 s | 0.922 s | 3 | Yes |
| Verglas Prime / Normal Attack | Burst / Grineer | 2.156 s | 2.171 s | 3 | Yes |
| Phantasma Prime / Beam | Scaling / Grineer | 1.981 s | 2.016 s | 3 | Yes |
| Rubico Prime / Normal Attack | Burst / Grineer | 1.870 s | 1.985 s | 3 | Yes |
| Epitaph / Charged Shot | Burst / Corpus | 2.861 s | 2.964 s | 3 | Yes |
| Nataruk / Perfect Shot | Burst / Grineer | 1.719 s | 1.747 s | 2 | Yes |
| Gram Prime / Heavy Slam Attack | Burst / Grineer | 1.744 s | 1.759 s | 3 | Yes |

This run is under five seconds for every Node-core scenario and materially faster than the preceding full-width run, but it does not prove global optimality or explain the improvement in isolation. Broken War uses the attack-rate melee proxy; Gram Prime's heavy-slam row does not model stance timing or combo consumption. The Node harness does not measure a packaged Worker, cold start, browser responsiveness, or mobile hardware. Current browser behavior is separately recorded in the port-80 walkthrough below.

### Last full sixteen-case run before the Phantasma Beam ramp update

Run date: 2026-11-11. The five-run harness used full search widths (512/128/48), MR 30, max-ranked mods, Catalyst, Exilus and arcane optimization, initial conditional state, and up to three Forma. The expanded cases cover continuous beam, sniper, charged secondary, precision bow, and heavy-slam melee attacks alongside the existing rifle, shotgun, charged alternate fire, Incarnon-base, archgun, and companion cases. Phantasma Prime `Plasma Bomb Explosion` uses the default two-ammo charge; the port-80 browser separately verified the full-magazine 11-ammo charge. Every case reported `legal=true`; the p95 column is the maximum of five observations. These rows record feasibility and latency, not identical build/score repetition.

| Weapon / attack | Goal / target | Median | p95 (max of 5) | Forma | Legal |
| --- | --- | ---: | ---: | ---: | --- |
| Braton Prime / Normal Attack | Burst / Grineer | 5.991 s | 6.796 s | 3 | Yes |
| Cedo / Normal Attack | Burst / Grineer | 4.276 s | 4.816 s | 3 | Yes |
| Cedo / Glaive Radial Attack | Burst / Grineer | 5.138 s | 5.308 s | 3 | Yes |
| Phantasma Prime / Plasma Bomb Explosion | Burst / Grineer | 4.634 s | 4.715 s | 2 | Yes |
| Laetum / Normal Attack | Burst / Corpus | 5.875 s | 6.136 s | 3 | Yes |
| Cinta / Quick Shot | Burst / Grineer | 5.502 s | 5.578 s | 2 | Yes |
| Kuva Hek / Normal Attack | Scaling / Grineer | 4.376 s | 4.561 s | 2 | Yes |
| Torid / Grenade Impact | Scaling / Corpus | 6.299 s | 6.316 s | 3 | Yes |
| Broken War / Normal Attack | Burst / Grineer | 5.189 s | 5.607 s | 3 | Yes |
| Corvas Prime / Uncharged Shot | Burst / Corpus | 2.082 s | 2.176 s | 3 | Yes |
| Verglas Prime / Normal Attack | Burst / Grineer | 5.775 s | 5.935 s | 3 | Yes |
| Phantasma Prime / Beam | Sustained DPS / Grineer | 4.654 s | 4.778 s | 3 | Yes |
| Rubico Prime / Normal Attack | Burst / Grineer | 4.963 s | 5.130 s | 3 | Yes |
| Epitaph / Charged Shot | Burst / Corpus | 7.116 s | 7.377 s | 3 | Yes |
| Nataruk / Perfect Shot | Burst / Grineer | 4.533 s | 4.711 s | 2 | Yes |
| Gram Prime / Heavy Slam Attack | Burst / Grineer | 5.057 s | 5.290 s | 3 | Yes |

Ten of sixteen max-of-five p95 observations exceed five seconds. The slowest is the charged Epitaph case at 7.377 s; Corvas Prime is fastest at 2.176 s. This desktop Node-core sample measures neither the production Worker nor cold-start/mobile latency. The heavy-slam case remains a weapon-attack proxy without combo consumption or stance animation timing. The Phantasma Beam measurement predates its Wiki-sourced ramp implementation; see the targeted follow-up below.

### Phantasma Prime Beam ramp benchmark refresh

Run date: 2026-11-11. Command: `npx tsx scripts/benchmarkBuildOptimizer.ts --weapon="Phantasma Prime" --attack=Beam --runs=5`. The case uses the full-width search, MR 30, max-rank mods, Catalyst, Exilus and arcane optimization, and up to three Forma. After the Wiki-sourced ramp entered scoring, all five runs returned the same 60/60 legal build with three Forma and proxy score 165,644.12. Median latency was 3.805 seconds and max-of-five p95 was 4.490 seconds. This is one desktop Node-core scenario; it does not refresh the other fifteen cases or measure production Worker, cold-start, or mobile latency.

### Port-80 Phantasma Beam Worker refresh

Run date: 2026-11-11. Five click-to-result runs in the local port-80 dev app used Phantasma Prime / Beam at MR 0, uncatalyzed, with the default 30 capacity and no Forma. Times were 1.327, 1.184, 1.039, 1.100, and 1.223 seconds (median 1.184 seconds; max-of-five p95 1.327 seconds). Each run returned a legal 30/30 build with five of eight slots filled. The planner was reloaded afterward and verified empty with no weapon selected. This measures one warmed development-server Worker scenario; the five runs were not compared for identical mod lists and do not establish production, cold-start, or cross-device performance.

### Prior eleven-case full-width run after Phantasma charge modeling

Run date: 2026-11-11. The five-run harness used full search widths (512/128/48), MR 30, max-ranked mods, Catalyst, Exilus and arcane optimization, initial conditional state, and up to three Forma. Phantasma Prime selects `Plasma Bomb Explosion` with the default two-ammo charge scenario; the browser separately verified a full-magazine 11-ammo charge. Every case reported `legal=true`; the p95 column is the maximum of five observations.

| Weapon / attack | Goal / target | Median | p95 (max of 5) | Forma | Legal |
| --- | --- | ---: | ---: | ---: | --- |
| Braton Prime / Normal Attack | Burst / Grineer | 6.326 s | 6.912 s | 3 | Yes |
| Cedo / Normal Attack | Burst / Grineer | 4.573 s | 4.860 s | 3 | Yes |
| Cedo / Glaive Radial Attack | Burst / Grineer | 5.232 s | 5.449 s | 3 | Yes |
| Phantasma Prime / Plasma Bomb Explosion | Burst / Grineer | 4.646 s | 4.846 s | 2 | Yes |
| Laetum / Normal Attack | Burst / Corpus | 6.037 s | 6.501 s | 3 | Yes |
| Cinta / Quick Shot | Burst / Grineer | 5.584 s | 5.753 s | 2 | Yes |
| Kuva Hek / Normal Attack | Scaling / Grineer | 4.495 s | 4.643 s | 2 | Yes |
| Torid / Grenade Impact | Scaling / Corpus | 6.299 s | 6.667 s | 3 | Yes |
| Broken War / Normal Attack | Burst / Grineer | 4.798 s | 5.017 s | 3 | Yes |
| Corvas Prime / Uncharged Shot | Burst / Corpus | 1.994 s | 2.046 s | 3 | Yes |
| Verglas Prime / Normal Attack | Burst / Grineer | 5.647 s | 5.930 s | 3 | Yes |

Seven of eleven max-of-five p95 observations exceed five seconds. This desktop Node-core sample measures neither the production Worker nor cold-start/mobile latency. The run reports feasibility and timing; it does not establish global optimality or build-quality parity.

### Prior eleven-case full-width run before Phantasma charge modeling

Run date: 2026-11-11. The 11-case harness ran five times per scenario at full search widths (512/128/48), MR 30, max-ranked mods, Catalyst, Exilus and arcane optimization, initial conditional state, and up to three Forma. The new case explicitly selects Phantasma Prime `Plasma Bomb Explosion`. Every run returned the same build and proxy score within its five repetitions; all 11 results passed capacity, unique-mod, incompatibility, and Forma checks. The p95 column is the maximum of five observations.

| Weapon / attack | Goal / target | Median | p95 (max of 5) | Forma | Stable and legal |
| --- | --- | ---: | ---: | ---: | --- |
| Braton Prime / Normal Attack | Burst / Grineer | 3.678 s | 4.042 s | 3 | Yes |
| Cedo / Normal Attack | Burst / Grineer | 2.735 s | 2.790 s | 3 | Yes |
| Cedo / Glaive Radial Attack | Burst / Grineer | 3.027 s | 3.123 s | 3 | Yes |
| Phantasma Prime / Plasma Bomb Explosion | Burst / Grineer | 2.572 s | 2.692 s | 2 | Yes |
| Laetum / Normal Attack | Burst / Corpus | 3.161 s | 3.359 s | 3 | Yes |
| Cinta / Quick Shot | Burst / Grineer | 2.900 s | 3.009 s | 2 | Yes |
| Kuva Hek / Normal Attack | Scaling / Grineer | 2.449 s | 2.561 s | 2 | Yes |
| Torid / Grenade Impact | Scaling / Corpus | 3.798 s | 4.019 s | 3 | Yes |
| Broken War / Normal Attack | Burst / Grineer | 2.893 s | 3.098 s | 3 | Yes |
| Corvas Prime / Uncharged Shot | Burst / Corpus | 1.120 s | 1.290 s | 3 | Yes |
| Verglas Prime / Normal Attack | Burst / Grineer | 3.189 s | 3.436 s | 3 | Yes |

All eleven max-of-five Node observations were below five seconds (1.290–4.042 s). The Phantasma result scored 34,258.65 on the optimizer's proxy, used eight mods at 57/60 capacity with two Forma, and was stable across all five runs. This is desktop Node-core latency and feasibility/repeatability evidence; it does not establish packaged Worker, cold-start, mobile, global-optimality, or Underframe parity.

### Fresh ten-case full-width run after the Cedo final-placement fix

Run date: 2026-11-11. Command: `npx tsx scripts/benchmarkBuildOptimizer.ts` (five runs per case). This refresh includes the Cedo `Glaive Radial Attack` case and the budget-aware final polarity assignment added after that scenario exposed an over-capacity result. Settings use full search widths, initial conditional state, MR 30, max-ranked mods, Catalyst, Exilus and arcane optimization, and up to three Forma. Each case returned the same build and score in all five repetitions; all builds passed capacity, unique-mod, incompatibility, and Forma checks. The p95 is the slowest of five observations.

| Weapon / attack | Goal / target | Median | p95 (max of 5) | Forma | Stable and legal |
| --- | --- | ---: | ---: | ---: | --- |
| Braton Prime / Normal Attack | Burst / Grineer | 3.506 s | 3.553 s | 3 | Yes |
| Cedo / Normal Attack | Burst / Grineer | 2.286 s | 2.572 s | 3 | Yes |
| Cedo / Glaive Radial Attack | Burst / Grineer | 2.675 s | 2.788 s | 3 | Yes |
| Laetum / Normal Attack | Burst / Corpus | 3.283 s | 3.351 s | 3 | Yes |
| Cinta / Quick Shot | Burst / Grineer | 2.916 s | 3.164 s | 2 | Yes |
| Kuva Hek / Normal Attack | Scaling / Grineer | 2.442 s | 2.686 s | 2 | Yes |
| Torid (base mode) / Grenade Impact | Scaling / Corpus | 3.573 s | 3.694 s | 3 | Yes |
| Broken War / Normal Attack | Burst / Grineer | 2.689 s | 2.902 s | 3 | Yes |
| Corvas Prime / Uncharged Shot | Burst / Corpus | 1.045 s | 1.235 s | 3 | Yes |
| Verglas Prime / Normal Attack | Burst / Grineer | 2.812 s | 3.086 s | 3 | Yes |

All ten max-of-five Node observations are below five seconds. This is a desktop Node-core measurement; it does not establish production browser Worker, cold-start, mobile, or cross-device latency. Stable legal outputs are repeatability and feasibility evidence, not proof of global optimality or quality parity. The melee result remains an attack-rate proxy without stance timing or combo generation.

### Port-80 browser Worker timing for Cedo radial

Run date: 2026-11-11. In the ChatGPT in-app browser, the port-80 local app ran five click-to-result optimizations for Cedo `Glaive Radial Attack` with Catalyst installed, Forma enabled, weapon rank 30, and MR 30. The observed times were 1.652, 1.691, 1.659, 1.726, and 1.611 seconds (median 1.659 s; max-of-five p95 1.726 s). Every result displayed 60/60 capacity. The final inspected placement changed three main-slot polarities from Cedo's defaults; the Node legality harness independently verifies the matching three-Forma scenario. This measures the current port-80 app Worker on this desktop session, not mobile, cold startup, or a range of machines. Reload returned the app to the original no-weapon, empty-planner state.

### Earlier nine-case cross-category run after PvE eligibility filtering

Run date: 2026-11-11. Command: `npx tsx scripts/benchmarkBuildOptimizer.ts` (five runs per case). The candidate pool now omits Conclave-path records unless the external item data lists a non-Conclave acquisition source. The run uses full search widths, initial conditional state, MR 30, max-ranked mods, Catalyst, Exilus and arcane optimization, and up to three Forma. All nine cases returned the same build and proxy score across repetitions; each build passed capacity and Forma legality checks. The five-sample p95 is the maximum observation.

| Weapon | Category / attack | Goal / target | Candidate mods | Median | p95 (max of 5) | Forma | Legal / stable |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| Braton Prime | Rifle / Normal Attack | Burst / Grineer | 106 | 3.268 s | 3.503 s | 3 | Yes |
| Cedo | Shotgun / Normal Attack | Burst / Grineer | 104 | 2.306 s | 2.412 s | 3 | Yes |
| Laetum | Secondary / Normal Attack | Burst / Corpus | 106 | 2.977 s | 3.070 s | 3 | Yes |
| Cinta | Bow / Quick Shot | Burst / Grineer | 102 | 2.760 s | 2.884 s | 3 | Yes |
| Kuva Hek | Progenitor shotgun / Normal Attack | Scaling / Grineer | 106 | 2.165 s | 2.252 s | 2 | Yes |
| Torid (base mode) | Incarnon / Grenade Impact | Scaling / Corpus | 104 | 3.242 s | 3.296 s | 3 | Yes |
| Broken War | Melee / Normal Attack | Burst / Grineer | 109 | 2.781 s | 2.874 s | 3 | Yes |
| Corvas Prime | Archgun / Uncharged Shot | Burst / Corpus | 38 | 1.043 s | 1.109 s | 3 | Yes |
| Verglas Prime | Companion weapon / Normal Attack | Burst / Grineer | 107 | 3.028 s | 3.089 s | 3 | Yes |

All nine max-of-five observations are below the five-second Node-core target. The melee result is an attack-rate proxy: stance hit sequence, forced procs, combo timing, and contact behavior are not modeled. This benchmark does not measure browser Worker latency, cold starts, mobile devices, or compare objective-equivalent builds with Underframe. It expands latency and legality coverage to melee, archgun, and companion weapons; it does not establish quality parity across those categories.

### Port-80 category UI smoke run after the strict PvE filter

The in-app browser on the local port-80 dev server optimized Corvas Prime (Arch-Gun, Uncharged Shot) and Verglas Prime (Companion, Normal Attack) at MR 0 with no Catalyst or Forma. The single click-to-result observations were 497 ms and 572 ms, respectively; these are not p95 estimates. Corvas Prime returned five mods at 30/30 capacity, and Verglas Prime returned three mods at 29/30. Both results fit the displayed capacity. This verifies the actual UI/Worker path for two newly benchmarked categories but does not validate build quality, production bundle latency, or a stable timing distribution. Reset and reload restored the no-weapon, empty-slot planner.

Each case was optimized five times with the same inputs: eight main slots, max-ranked mods, initial conditional state, Catalyst allowed, up to three additional Forma, MR 30, weapon rank 30 (40 for over-level weapons), Exilus and arcane optimization enabled, and the listed faction preset. The harness now matches the Mod Builder's candidate pool by filtering duplicate expert-path variants and scores against the same default selected attack that the UI passes to the Worker. This matters for multi-attack weapons: the previous Torid Node score used the catalog's aggregate stats, while the UI optimizes the selected Grenade Impact attack. All cases use attack index 0. No profile-specific custom Rivens are included. This run uses beam widths 512/128/48; capacity drain and Forma savings are carried incrementally through beam states. All repetitions returned the same selected mods, ranks, score, and Forma count, and all returned builds passed the harness legality checks. The p95 is the nearest-rank estimate from only five samples, so it is the slowest observation and a coarse tail indicator.

| Weapon | Default attack | Goal | Target | Candidate mods / arcanes | Median | p95 (max of 5) | Forma | Legal / stable |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| Braton Prime | Normal Attack | Burst | Grineer | 116 / 14 | 3.068 s | 3.299 s | 3 | Yes |
| Cedo | Normal Attack | Burst | Grineer | 114 / 15 | 2.210 s | 2.242 s | 3 | Yes |
| Laetum | Normal Attack | Burst | Corpus | 117 / 18 | 3.386 s | 3.491 s | 3 | Yes |
| Cinta | Quick Shot | Burst | Grineer | 110 / 15 | 2.689 s | 2.702 s | 3 | Yes |
| Kuva Hek | Normal Attack | Scaling | Grineer | 113 / 15 | 2.157 s | 2.209 s | 2 | Yes |
| Torid (base mode) | Grenade Impact | Scaling | Corpus | 110 / 14 | 3.206 s | 3.227 s | 3 | Yes |

At that earlier checkpoint, the latest full-width five-run rerun was performed on 2026-11-11 after the Incarnon parser fail-closed and target-output corrections. All six cases returned stable, legal builds with the same mod choices and proxy scores recorded above. Each max-of-five p95 observation was below the five-second Node-core target, ranging from 2.209 to 3.491 seconds; this timing result is superseded by the newer ten-case run at the end of this report. Search widths remain 512/128/48; narrower search settings previously degraded a Cinta score and were reverted. This is a direct Node-core measurement, not browser latency or a production browser bundle measurement.

### Fresh full-width Node rerun after Blast payout correction

This five-run rerun followed the separation of Blast's natural stack-expiry payout from its stack-cap payout. The full-width search remained 512/128/48. All six scenarios returned stable, legal builds and the same proxy scores and mod choices as the prior full-width report; Blast was not present in these selected builds. Five of six coarse p95 observations exceed the five-second Node-core target.

| Weapon | Median | p95 (max of 5) | Forma | Legal / stable |
| --- | ---: | ---: | ---: | ---: |
| Braton Prime | 6.015 s | 6.625 s | 3 | Yes |
| Cedo | 4.551 s | 4.794 s | 3 | Yes |
| Laetum | 7.221 s | 7.933 s | 3 | Yes |
| Cinta | 5.816 s | 6.046 s | 3 | Yes |
| Kuva Hek | 4.749 s | 5.111 s | 2 | Yes |
| Torid (base mode) | 6.633 s | 7.122 s | 3 | Yes |

These measurements do not meet the five-second Node-core target. The production Worker in the corresponding build is 48.96 kB; this Node benchmark does not measure Worker latency. The same-run port-80 in-app-browser check completed a legal Braton Prime build at 30/30 capacity and was reset to zero filled slots; it was a single functional check, not a latency sample.

### Fresh full-width Node rerun after skipping unused per-attack DoT details

The optimizer's score uses steady-state DoT DPS, not the full-life per-attack DoT totals or per-proc tick decomposition. The hot path now skips those unused detail calculations while retaining steady-state values. This five-run check uses the same full widths (512/128/48), candidate pools, capacity rules, and six scenarios. All returned mod sets, scores, Forma counts, and legality results match the previous run. Timing remains variable: five cases improved versus the preceding five-run sample, while Braton Prime regressed.

| Weapon | Median | p95 (max of 5) | Forma | Legal / stable |
| --- | ---: | ---: | ---: | ---: |
| Braton Prime | 6.592 s | 7.936 s | 3 | Yes |
| Cedo | 4.605 s | 4.700 s | 3 | Yes |
| Laetum | 6.751 s | 7.054 s | 3 | Yes |
| Cinta | 5.387 s | 5.562 s | 3 | Yes |
| Kuva Hek | 4.251 s | 4.416 s | 2 | Yes |
| Torid (base mode) | 6.131 s | 6.340 s | 3 | Yes |

### Six-case port-80 dev-server benchmark after the DoT fast path

On 2026-11-11, the ChatGPT in-app browser ran Optimize five times for each weapon on the local port-80 development server. The planner used its default objective, target, attack selection, MR 0, no Catalyst, and no Forma. Every run for each weapon returned the same build, and all builds fit the displayed capacity. p95 is the maximum of five observations.

| Weapon | Median click-to-result | p95 (max of 5) | Stable build | Capacity / slots |
| --- | ---: | ---: | --- | --- |
| Braton Prime | 1.787 s | 1.928 s | Malignant Force R3, Rime Rounds R3, Thermite Rounds R3, Vile Acceleration R5 | 30/30, 4/8 |
| Cedo | 1.848 s | 1.897 s | Galvanized Hell, Primed Point Blank, Toxic Barrage, Frigid Blast | 29/30, 4/8 |
| Laetum | 1.834 s | 1.889 s | Galvanized Diffusion, Pistol Pestilence, Frostbite, Semi-Pistol Cannonade | 30/30, 4/8 |
| Cinta | 1.853 s | 1.871 s | Galvanized Chamber, Malignant Force, Rime Rounds, Thermite Rounds | 29/30, 4/8 |
| Kuva Hek | 1.813 s | 1.848 s | Toxic Barrage, Frigid Blast, Semi-Shotgun Cannonade, Scattered Justice | 30/30, 4/8 |
| Torid | 1.851 s | 1.893 s | Rime Rounds, Serration, Vile Acceleration | 30/30, 3/8 |

This is a desktop development-server measurement, not a packaged production Worker or cross-device result. The planner was reset to zero filled slots after every weapon.

Four of six p95 observations remain above five seconds. The measurements do not establish that the code change caused the per-case timing differences; the same scores and build choices are the stronger correctness signal. Search widths remain 512/128/48, and further search-width reductions remain gated on build-quality comparisons.

### Fresh full-width Node rerun after Magnetic encounter update

This five-run rerun followed the Magnetic defense-break and conditional Status Damage changes. The optional Magnetic source multiplier is skipped on the optimizer path because candidate scoring does not consume it. All six scenarios still returned the same stable, legal builds and proxy scores from the returned-build table; the search widths stayed at 512/128/48. Timing remained variable and four of six coarse p95 observations were above the five-second target.

| Weapon | Median | p95 (max of 5) | Forma | Legal / stable |
| --- | ---: | ---: | ---: | --- |
| Braton Prime | 5.904 s | 6.256 s | 3 | Yes |
| Cedo | 4.219 s | 4.399 s | 3 | Yes |
| Laetum | 6.327 s | 6.581 s | 3 | Yes |
| Cinta | 5.025 s | 5.184 s | 3 | Yes |
| Kuva Hek | 4.086 s | 4.119 s | 2 | Yes |
| Torid (base mode) | 5.714 s | 5.950 s | 3 | Yes |

These slower observations do not show a score or build regression, but they do not satisfy the Node-core p95 goal. Earlier 2.209–3.491 second p95 measurements remain useful historical evidence; repeat under controlled CPU load before making another search-width change. This run still does not measure packaged-browser Worker latency.

### Fresh full-width Node rerun after forced-proc catalog update

Run date: 2026-11-11. This five-run benchmark covers the current source-backed forced-proc annotations and production Worker implementation. It used the same six Node-core scenarios and full search widths (512/128/48). Every repetition returned the same selected build, score, and Forma count, and all builds passed legality checks. The p95 estimate is the maximum of five observations.

| Weapon | Median | p95 (max of 5) | Forma | Legal / stable |
| --- | ---: | ---: | ---: | --- |
| Braton Prime | 6.076 s | 6.446 s | 3 | Yes |
| Cedo | 4.407 s | 4.558 s | 3 | Yes |
| Laetum | 6.821 s | 6.867 s | 3 | Yes |
| Cinta | 5.386 s | 5.540 s | 3 | Yes |
| Kuva Hek | 4.213 s | 4.531 s | 2 | Yes |
| Torid (base mode) | 6.172 s | 6.428 s | 3 | Yes |

Four of six p95 observations exceed the five-second Node-core target. Returned builds and scores match the preceding full-width run; this is timing variability, not a quality regression. The production Worker asset in the corresponding build is 48.23 kB. Node timing does not measure browser Worker latency.

### Local port-80 in-app browser click-to-result benchmark

On 2026-11-11, the local port-80 development server was measured in the in-app browser with five Optimize clicks per scenario. Timing started immediately before the click and ended after the UI again exposed the idle Optimize Build button with a result. Accessibility-state polling at 100 ms makes this a coarse end-to-end measure; it includes browser scheduling, Worker response, UI updates, and CUA interaction/polling overhead. These scenarios used the planner's default setup without a profile-specific target or capacity override; Kuva Hek and Torid used Sustained DPS, and the other four used Burst DPS. The max of five is a nearest-rank p95 estimate, not a stable tail distribution.

| Weapon | Objective | Target | Median | p95 (max of 5) |
| --- | --- | --- | ---: | ---: |
| Braton Prime | Burst DPS | Default | 0.986 s | 1.013 s |
| Cedo | Burst DPS | Default | 1.160 s | 1.189 s |
| Laetum | Burst DPS | Default | 1.156 s | 1.168 s |
| Cinta | Burst DPS | Default | 0.984 s | 1.119 s |
| Kuva Hek | Sustained DPS | Default | 1.188 s | 1.198 s |
| Torid | Sustained DPS | Default | 0.869 s | 0.884 s |

All six p95 observations were under 1.2 seconds on this local desktop. Afterward the planner was reloaded and verified empty; no saved build was created. This measures the current development server on this machine, not the production browser bundle, mobile/cross-device performance, or stable p95 behavior under other system loads. Earlier port-80 measurements were 1.782–2.862 seconds under a different setup; retain those as historical observations, not as replacements for this current default-setup run.

A prior Torid-only sensitivity run and the preselected-attack benchmark numbers above are superseded; the former used aggregate Torid catalog stats and an unfiltered candidate pool, so they are not comparable to the live planner's Grenade Impact optimization.

### Production bundle in-app browser benchmark

On 2026-11-11, a temporary Vite production preview of the current build was opened in the ChatGPT in-app browser at `http://127.0.0.1:4173/Tenno-Hub/`. This measured the packaged Worker rather than the port-80 development server. Each timing starts immediately before clicking Optimize Build, waits until Cancel Optimization is visible, and ends when Optimize Build returns. It includes app/browser scheduling and automation overhead as well as Worker time. Each p95 is the maximum of five warm runs; it is a coarse tail sample. The UI scenarios used the default target, an uncatalyzed 30-capacity weapon, MR 0, and default attack selection. This differs from the Node benchmark's MR 30, Catalyst, Forma, and faction presets.

| Weapon | Objective | Attack | Median | p95 (max of 5) | Final result capacity |
| --- | --- | --- | ---: | ---: | ---: |
| Braton Prime | Burst DPS | Normal Attack | 1.646 s | 1.735 s | 30/30 |
| Cedo | Burst DPS | Normal Attack | 1.910 s | 1.926 s | 29/30 |
| Laetum | Burst DPS | Normal Attack | 1.895 s | 1.909 s | 30/30 |
| Cinta | Burst DPS | Quick Shot | 1.626 s | 1.832 s | 29/30 |
| Kuva Hek | Sustained DPS | Normal Attack | 1.899 s | 2.008 s | 28/30 |
| Torid | Sustained DPS | Grenade Impact | 1.630 s | 1.683 s | 30/30 |

All six final builds were within capacity. A cold first Braton click took 7.381 s before the warmed samples, and an initial Cinta batch contained a 10.512 s outlier; an additional five-run Cinta check returned 1.510–1.801 s, and a strict start/finish-handshake rerun returned the table above. The production browser warm samples meet the five-second target, but the cold start and observed transient outlier show that stable tail performance is not established. The planner was reset to zero filled slots after the checks. The production preview server was stopped. These runs do not establish mobile/cross-device performance or same-configuration performance parity with the Node harness.

### Returned builds

- **Braton Prime, Burst, Grineer:** Malignant Force R3, Rime Rounds R3, Thermite Rounds R3, Heavy Caliber R10, Vile Acceleration R5, Primed Bane of Grineer R10, Split Chamber R5, Continuous Misery R3. Score: 69,447.12.
- **Cedo, Burst, Grineer:** Primed Point Blank R10, Hell's Chamber R5, Primed Chilling Grasp R10, Toxic Barrage R3, Blaze R3, Shotgun Barrage R5, Lingering Torment R5, Frail Momentum R5. Score: 80,485.04.
- **Laetum, Burst, Corpus:** Lethal Torrent R5, Pathogen Rounds R5, Pistol Pestilence R3, Primed Expel Corpus R10, Semi-Pistol Cannonade R5, Pistol Elementalist R5, Barrel Diffusion R5, Augur Seeker R5. Score: 392,190.75.
- **Cinta, Burst, Grineer:** Malignant Force R3, Rime Rounds R3, Thermite Rounds R3, Heavy Caliber R10, Vile Acceleration R5, Primed Bane of Grineer R10, Split Chamber R5, Continuous Misery R3. Score: 54,848.51.
- **Kuva Hek, Scaling, Grineer:** Primed Chilling Grasp R10, Contagious Spread R5, Blaze R3, Primed Ravage R10, Semi-Shotgun Cannonade R5, Primed Blunderbuss R10, Scattered Justice R3, Primed Cleanse Grineer R10. Score: 365,716.32.
- **Torid base mode, Scaling, Corpus:** Malignant Force R3, Hammer Shot R3, Primed Bane of Corpus R10, Rifle Elementalist R5, Serration R10, Continuous Misery R3, Vigilante Armaments R5, Vile Acceleration R5. Score: 58,004.93.

The optimizer's hot-path score is a fast, steady-state target-pool progress proxy. It applies direct damage by type, target faction affinity and armor, Viral and Magnetic status multipliers, Heat/Corrosive armor strips, Slash/Toxin bypass behavior, Blast single-target value, and sustained reload duty cycle. Scores are internal proxy units, not in-game DPS or TTK. These heuristic-search outputs are not globally optimal.

## Controlled legacy-search comparison

On 2026-11-11, the repository's pre-overhaul `buildOptimizer.ts` from `HEAD` was run once on the same six current catalog scenarios and candidate pools. Both returned builds were re-scored with the current `debugScoreBuild` objective and current data, so the score column is a same-model comparison rather than either optimizer's native score. Both searches received the same eight slots, Catalyst, rank limits, three-Forma setting, Exilus/Arcane settings, attack index, faction, and expert-variant-filtered candidate list.

| Weapon | Goal | Current score | Legacy build score | Change vs legacy | Current Forma | Legacy Forma | Legacy within 3 Forma? |
|---|---|---:|---:|---:|---:|---:|---|
| Braton Prime | Burst | 69,447.12 | 10,183.53 | +582.0% | 3 | 2 | Yes |
| Cedo | Burst | 80,485.04 | 38,763.88 | +107.6% | 3 | 4 | No |
| Laetum | Burst | 392,190.75 | 156,311.02 | +150.9% | 3 | 5 | No |
| Cinta | Burst | 54,848.51 | 12,221.99 | +348.8% | 3 | 3 | Yes |
| Kuva Hek | Scaling | 365,716.32 | 105,782.96 | +245.7% | 2 | 3 | Yes |
| Torid | Scaling | 58,004.93 | 3,288.83 | +1,663.7% | 3 | 3 | Yes |

Every build fit the current capacity formula; the current optimizer respected the Forma limit in all six cases. The legacy optimizer exceeded the supplied limit on Cedo and Laetum, so those two are invalid under the shared configuration. The other four legacy outputs met the limit. This small, single-run, proxy-scored comparison is evidence of improvement on this corpus, not a quality guarantee, exhaustive optimum, in-game DPS comparison, or Underframe parity. Its very large score changes reflect the revised objective and changed search choices as well as candidate selection; they should not be interpreted as live damage multipliers.

The initial corrected Torid result exposed that the source incompatibility group did not connect the standard Rifle Aptitude path to its Flawed training variant; the UI and benchmark both chose the two incompatible cards. After normalizing training-variant groups, the benchmark no longer stacks them. The production browser Worker has now been run across all six default UI cases and returned capacity-legal builds. Those browser settings differ from the Node benchmark, so this check does not compare identical build choices. This confirms why the legality check must model source incompatibilities, not only unique catalog paths.

## Matched Braton Prime comparison with Underframe

Run date: 2026-11-11. The in-app browser captured a Tenno-Hub Burst result and Underframe Auto Build result for Braton Prime against a level-100 Grineer Heavy Gunner with 83,818 Health, 2,700 Armor, no Shields, and no Overguard. Both builds had a Catalyst and at most three Forma. Both browser outputs were checked against their visible mod list; each build is legal under the same 60-capacity/three-Forma constraint.

The Underframe page did not permit a fresh re-run in this continuation: the saved build loaded in a read-only view and its visible controls did not change state. The native Underframe result below is the previously captured five-second stochastic run from the same target settings; it is retained as a separate competitor-native measurement, not treated as numerically equivalent to Tenno-Hub's expected model.

| Build | Returned mods | Common score (Tenno-Hub model) | Mean finite encounter | Legality |
|---|---|---:|---:|---|
| Tenno-Hub optimizer | Malignant Force R3, Primed Cryo Rounds R10, Hellfire R5, Heavy Caliber R10, Vile Acceleration R5, Vital Sense R5, Split Chamber R5 | 49,925.32 | 60 attacks, 3.24 s, 25,867.56 damage/s (direct 79,133.60 + status 4,684.40) | 30/30 main slots, 60/60 capacity, 3 Forma |
| Underframe Auto Build | Amalgam Serration R10, Bane of Corpus R5, Bane of Grineer R5, Bane of Infested R5, Malignant Force R3, Rime Rounds R3, Thermite Rounds R3, Vital Sense R5 | 16,102.48 | 75 attacks, 7.72 s, 10,854.81 damage/s (direct 61,394.42 + status 22,423.58) | 30/30 main slots, 57/60 capacity, 3 Forma |

Both fixed builds were re-scored with `debugScoreBuild` and the same Damage 3.0 target profile override, then run through `simulateExpectedWeaponEncounter`. The objective state was Burst with no non-initial conditional stacks, no arcane, no Exilus, no external buffs, no headshots, and no explicit status immunities. The model treats Magnetic as ineligible for the shieldless target. The Underframe build scored 67.8% below the Tenno-Hub build and had a 2.38× longer modeled kill time. This refresh includes same-source Heat stack accumulation and duration refresh in the finite encounter. The Underframe build reserves two slots for Corpus/Infested Bane mods that have no value against the configured Grineer target in the shared evaluator; only Bane of Grineer applies.

Underframe's captured simulator output for its returned build was 1,660 raw plus 385 DoT average damage/shot, 19,878 average DPS, and 4.22 s TTK. This is a stochastic, competitor-native result; it is not comparable to Tenno-Hub's score units or expected encounter damage/s. The shared evaluator is the matched build-quality check. It shows this captured Underframe output does not beat Tenno-Hub's selected Braton build, so this sample does not expose a Tenno-Hub scoring defect. One weapon/configuration is not a broad quality claim, and the Underframe native simulation must be re-run in an interactive build view before using its DPS/TTK as comparative evidence.

The repeatable shared evaluator is `scripts/comparePlannerBuilds.ts` (`npm run benchmark:planner-comparison`). It records mod ranks, target pools, the common score, mean encounter outcome, and Forma/capacity legality. Its result is based on the captured configs and the current Tenno-Hub model; it is not an exhaustive optimum proof.

## Torid finite-encounter check against Underframe

Run date: 2026-11-11. In the ChatGPT in-app browser, the saved `Torid parity QA` page was set to Grenade Impact against a Corpus Crewman with Health 7,200, Shields 10,800, Armor 0, and Overguard 0. The weapon used the eight visible mods and ranks below; the page showed 58/60 capacity and three Forma. This saved page is explicitly a QA fixture, not an Underframe Auto Build result.

| Build | Mods | Common Scaling score | Tenno-Hub expected encounter | Legality |
|---|---|---:|---|---|
| Saved Underframe QA build | Malignant Force R3, Vile Acceleration R5, Hammer Shot R3, Primed Bane of Corpus R10, Rifle Aptitude R5, Rifle Elementalist R5, Continuous Misery R3, Speed Trigger R5 | 16,735.69 | 9 attacks, 4.00 s, 1,800 damage/s (direct 2,513.64 + status 4,686.36) | Underframe page: 58/60 capacity, 3 Forma |
| Tenno-Hub Scaling optimizer | Malignant Force R3, Hammer Shot R3, Primed Bane of Corpus R10, Rifle Elementalist R5, Serration R10, Continuous Misery R3, Vigilante Armaments R5, Hunter Track R5 | 52,675.12 | 4 attacks, 2.00 s, 3,600 damage/s (direct 4,922.15 + status 2,277.85) | Tenno-Hub: 60/60 capacity, 3 Forma |

Both fixed builds were evaluated with `debugScoreBuild` and `simulateExpectedWeaponEncounter` using the same initial-state Scaling objective, first Torid attack, target profile, and three-Forma/Catalyst constraints. The target has no Armor or Overguard, and Toxin bypass is enabled. The common score is Tenno-Hub's proxy; it does not represent Underframe's native score or establish quality parity because the captured Underframe build is labeled QA, not Auto Build.

The Underframe five-second simulator was run five times without changing that saved build or target. Its Average DPS samples were 1,674, 2,038, 1,756, 2,038, and 2,019 (mean 1,905; median 2,019). TTK samples were 4.30, 3.53, 4.10, 3.53, and 3.57 seconds (mean 3.81; median 3.57). Raw/DoT Average Damage per Shot also varied substantially across those runs, showing random-run variance. Tenno-Hub's fixed-build expected model produced 1,800 DPS and 4.00 seconds, within 5.5% of the native sample mean DPS and 0.20 seconds of the mean TTK. A mean-field TTK is not mathematically the mean of stochastic TTK outcomes; five runs are a small calibration sample, not a simulator-equivalence claim.

The result is consistent with the current [Torid](https://wiki.warframe.com/w/Torid) base profile and [Toxin status](https://wiki.warframe.com/w/Damage/Toxin_Damage) rule that Toxin ignores Shields but not Overguard. It supports this one low-level, single-target encounter path; it does not validate all weapons, higher enemy levels, armor, Overguard, or stochastic status histories. The reusable comparison is `scripts/compareToridUnderframe.ts` (`npm run benchmark:torid-comparison`); it re-optimizes and re-scores the Tenno-Hub candidate and replays both fixed mod lists through the current shared model.

## Cedo alternate-fire legality and latency

Run date: 2026-11-11. The Cedo `Glaive Radial Attack` scenario was added to `scripts/benchmarkBuildOptimizer.ts` so the optimizer measures the source-backed alternate-fire proc rules rather than only the shotgun's default attack. The five runs used Burst, initial conditional state, a level-30 Grineer faction preset, Catalyst, MR 30, three Forma maximum, Exilus/arcane optimization, and the catalog candidate pool. Each run returned the same eight mods, fit 59/60 capacity, used three Forma, and passed capacity, unique-mod, and incompatibility checks.

| Weapon / attack | Objective | Common score proxy | Median | Max-of-five p95 | Capacity / Forma | Stable and legal |
|---|---|---:|---:|---:|---:|---|
| Cedo / Glaive Radial Attack | Burst | 9,910.51 | 2.675 s | 2.788 s | 59/60, 3 | Yes |

Selected build: Primed Point Blank R10, Primed Cleanse Grineer R10, Toxic Barrage R3, Frigid Blast R3, Primed Charged Shell R10, Hell's Chamber R5, Shotgun Barrage R5, Lingering Torment R5. A prior run before the final-placement correction reported a stable but illegal 65/60 result. The follow-up changed the slot assignment under the same three-Forma budget; the regression test now checks the returned build's full capacity summary and Forma count.

This is a Node-core measurement, not a packaged browser Worker latency result. It uses the current expected-count model for the two forced explosion rolls, not a stochastic proc-history or projectile-trajectory simulation. In the port-80 UI, optimizing the same attack returned 29/30 capacity with Catalyst off and 60/60 with Catalyst on; the Node case's third Forma choice is checked separately by the harness. To isolate this case, run `npx tsx scripts/benchmarkBuildOptimizer.ts --weapon=Cedo "--attack=Glaive Radial Attack" --runs=5`.

## Earlier search-breadth experiments (historical)

A five-run experiment reduced the main beam width from 512 to 448 while keeping the 128/48 per-filled-count/theme limits. A second five-run experiment at width 480 returned different Cinta and Torid builds. Both narrower settings were reverted. These experiments preceded the selected-attack and candidate-pool correction, so their timing and score comparisons are historical only and do not establish a current quality/performance tradeoff.

A prior one-run experiment reduced all beam widths from 512/128/48 to 256/64/24 and was reverted after one Cinta result lost 26.2% of its then-current internal score. This also predates the corrected benchmark inputs. All experiments show that reducing breadth can change build selection; none establishes a current acceptable quality/performance tradeoff.

## Slot assignment and capacity-check optimization

Beam states carry current unpolarized drain and sorted Forma savings, so capacity feasibility can be checked by adding the newly considered mod instead of rescanning every selected mod. A Node CPU profile then showed repeated polarity-aware assignment and combo refinement as the largest optimizer costs. `assignModsToSlots` now uses typed-array dynamic programming with predecessor choices instead of allocating string-keyed memo entries and full assignment arrays for every branch; branch order preserves the previous exact-tie choice.

After the assignment change, historical runs appeared to preserve builds and reduce Torid time. The benchmark-input correction means those before/after figures are not a matched comparison and are no longer used as performance evidence. Current full-width observations are reported in the main table above; the browser Worker and mobile targets still require direct measurement.

## Limits and follow-up

- The browser measurement covers six local desktop scenarios but does not measure cancellation latency, memory, or mobile/cross-device performance. Its five-run p95 estimate is coarse and should be expanded under multiple loads and hardware targets.
- A fresh packaged-browser rerun was attempted after the DoT fast-path change. Vite preview served the production bundle on port 4173, but the ChatGPT in-app browser timed out connecting to that forwarded port. The current five-run port-80 dev-server Worker sample is recorded at the end of this report; no matched post-change production-bundle Worker latency or cross-device result is claimed.
- Faction presets remain synthetic estimates. The UI shows an ordered direct-hit and scheduled status estimate through Overguard, Shields, and Health using mean damage and static defenses; Blast stacks pay `max(1, 0.3 × H)` individually to the afflicted target at expiry or cap using binary32 arithmetic. The finite encounter applies the separate `3 × sum(H)` cap/death radial to configured same-profile neighbors through their Blast defenses and reports collateral separately from primary TTK. The optimizer includes a Poisson estimate for cap-radial value but not death-triggered radial value. H and proc arrivals are expected-value estimates. The finite encounter and direct-hit sequence apply the generic enemy Shield Gate to direct Health hits under a user-selected body/weakspot/blocked-area mode; status ticks bypass it. The one-hit estimate and optimizer do not model the gate. Shield recharge remains unsupported because the current Wiki does not publish the numeric recharge-delay/rate curves. Complete evolving status histories, boss attenuation, neighbor status/position histories, chained deaths, and full Electricity/Gas area behavior remain open. The current Blast Wiki page is actively edited.
- Finite Slash/Toxin contribution uses an evenly spaced proc schedule and a direct-damage kill-time estimate. It is not a stochastic encounter simulation.
- Deterministic repeatability and legality do not prove build quality, global optimality, or parity with Underframe. The single matched Braton comparison above is narrow evidence only; broad objective-equivalent Underframe comparisons remain open.
- Current optimizer quality tests include exhaustive legal five-slot searches over nine-candidate subsets in nine scenarios: rifle, shotgun radial/beam/charged, secondary, sniper, bow, and melee normal/heavy-slam attacks. Custom target pools cover armor, Shields, Overguard, Toxin bypass, status caps, and immunities. The oracle enforces mod uniqueness and incompatibility groups, including preventing normal and Amalgam Organ Shatter from appearing together. The optimizer matches the exact best proxy score for these finite candidate sets; this is stronger subset evidence, not a full-catalog or finite-encounter optimality guarantee. A Braton Prime candidate/Forma monotonicity check also remains.

The repeatable latency harness is `scripts/benchmarkBuildOptimizer.ts`. The matched-build evaluator is `scripts/comparePlannerBuilds.ts`. Extend them with versioned reference scenarios, broader independent build-quality baselines, representative weapon/mechanic cases, and packaged-browser Worker measurements.

## First optimizer call after page reload

In the ChatGPT in-app browser on port 80, after reloading and configuring Cedo Glaive Radial Attack with Catalyst installed, Forma enabled, weapon rank 30, and MR 30, the first optimization call took 1.502 seconds. It returned a capacity-legal 60/60 build using three Forma. This is one desktop post-reload observation, not a cold browser/runtime measurement, and is not mixed into the five-run sample above.

## Incarnon extra-projectile damage verification

On 2026-11-11, Braton Prime's Munitions Grit was checked against the generated evolution description and notes. The model keeps expected projectile count (1.20 after its +20% Multishot) separate from the damage-weighted multiplier (1.308 with its +54% unique bonus on the 0.20 extra projectiles). The same distinct values feed Arsenal/DPS, optimizer scoring, target damage, and direct hits in the finite expected encounter; DoT seeds use the weighted extra-projectile damage while expected status rolls still use 1.20 projectiles.

In the port-80 in-app browser, Normal Attack showed 1.20 Multishot and 48.4 Arsenal Total Damage after its +2 base damage adjustment. “Why This Build” showed 54 mean damage against the selected synthetic target's initial pools, reflecting expected critical damage. Incarnon Form showed its scoped stats with no extra-projectile increment while its Multishot remained 1.00; the +2 base-damage adjustment still applied. The selected evolution was removed, and a reload confirmed the planner was empty. These checks cover this one supported evolution, not complete Incarnon coverage.

## Fresh ten-case Node run after status-probability and Blast target-payout corrections

Run date: 2026-11-11. `npm run benchmark:build-planner` ran five times for each scenario with full search widths 512/128/48. Each scenario returned an identical build and proxy score across its five runs; every result passed capacity, uniqueness, incompatibility, and Forma-limit checks. The p95 column is the maximum of five observations, not a stable tail estimate. This refresh supersedes the earlier six-case run labelled “after Blast payout correction”: that run predates the correction which separates the neighbor-only Blast radial from the afflicted target's single-target payout.

| Weapon / attack | Goal / target | Median | p95 (max of 5) | Forma | Stable and legal |
| --- | --- | ---: | ---: | ---: | --- |
| Braton Prime / Normal Attack | Burst / Grineer | 5.836 s | 6.424 s | 3 | Yes |
| Cedo / Normal Attack | Burst / Grineer | 4.555 s | 4.563 s | 3 | Yes |
| Cedo / Glaive Radial Attack | Burst / Grineer | 4.967 s | 5.910 s | 3 | Yes |
| Laetum / Normal Attack | Burst / Corpus | 5.477 s | 5.783 s | 3 | Yes |
| Cinta / Quick Shot | Burst / Grineer | 4.848 s | 5.130 s | 2 | Yes |
| Kuva Hek / Normal Attack | Scaling / Grineer | 3.903 s | 3.986 s | 2 | Yes |
| Torid (base mode) / Grenade Impact | Scaling / Corpus | 5.537 s | 6.115 s | 3 | Yes |
| Broken War / Normal Attack | Burst / Grineer | 4.734 s | 5.149 s | 3 | Yes |
| Corvas Prime / Uncharged Shot | Burst / Corpus | 1.913 s | 2.027 s | 3 | Yes |
| Verglas Prime / Normal Attack | Burst / Grineer | 5.266 s | 6.236 s | 3 | Yes |

Seven of ten cases exceed the five-second Node-core target. These are desktop optimizer-core measurements; they do not measure browser Worker or mobile latency. The search width was left unchanged because prior narrower experiments changed selected builds and reduced scores. This run is the current timing baseline for the status-probability and Blast single-target corrections; repeatability and legality do not prove global optimality or Underframe parity.

## Fresh ten-case run after target-context caching and search-loop cleanup

Run date: 2026-11-11. `npm run benchmark:build-planner` ran five times per case after the target scoring context cache and per-state ordering scan cleanup. Settings and legality checks match the prior full-width ten-case harness: initial conditional state, MR 30, max-ranked mods, Catalyst, Exilus and arcane optimization, up to three Forma, and full search widths 512/128/48. Every repetition selected the same build and score; all ten returned builds passed capacity, uniqueness, incompatibility, and Forma-limit checks. p95 is the maximum of five observations. The run did not show a consistent timing reduction against the prior refresh, so these changes are retained as allocation/recomputation cleanup without claiming they meet the speed target.

| Weapon / attack | Goal / target | Median | p95 (max of 5) | Forma | Stable and legal |
| --- | --- | ---: | ---: | ---: | --- |
| Braton Prime / Normal Attack | Burst / Grineer | 5.610 s | 6.362 s | 3 | Yes |
| Cedo / Normal Attack | Burst / Grineer | 3.907 s | 4.523 s | 3 | Yes |
| Cedo / Glaive Radial Attack | Burst / Grineer | 4.890 s | 5.166 s | 3 | Yes |
| Laetum / Normal Attack | Burst / Corpus | 5.681 s | 5.965 s | 3 | Yes |
| Cinta / Quick Shot | Burst / Grineer | 4.897 s | 5.168 s | 2 | Yes |
| Kuva Hek / Normal Attack | Scaling / Grineer | 4.219 s | 4.482 s | 2 | Yes |
| Torid (base mode) / Grenade Impact | Scaling / Corpus | 6.052 s | 6.172 s | 3 | Yes |
| Broken War / Normal Attack | Burst / Grineer | 4.827 s | 4.912 s | 3 | Yes |
| Corvas Prime / Uncharged Shot | Burst / Corpus | 2.074 s | 2.179 s | 3 | Yes |
| Verglas Prime / Normal Attack | Burst / Grineer | 5.577 s | 5.645 s | 3 | Yes |

Six cases exceed the five-second Node-core target. This desktop run does not measure browser Worker, production-package startup, cold start, mobile, or cross-device latency. Full search widths were retained because prior reduced-width experiments changed builds and lowered scores. The production Worker asset is 52.9 kB in the corresponding build. These measurements establish determinism and legality on this corpus, not global optimality, quality parity, or completion of the overall assignment.

## Five-run port-80 dev-server Worker measurement

The ChatGPT in-app browser measured five Braton Prime `Optimize Build` clicks against the port-80 development server with the default MR 0, uncatalyzed 30-capacity configuration. Browser-observed click-to-result times were 0.873, 1.033, 1.007, 0.996, and 0.853 s (median 0.996 s; max-of-five p95 1.033 s). Every result fit 30/30 capacity and used four of eight slots. The measurement polls the visible accessibility state at 50 ms intervals and includes browser/UI observation overhead. It is not full-rank or full-candidate production Worker timing, and does not cover cold start, mobile, or cross-device performance. The test build was reset and reload restored the planner with no weapon selected and zero slots filled.

## Port 80 dev-server Worker after Blast payout correction

The ChatGPT in-app browser ran five Cedo `Glaive Radial Attack` optimizations on the local port-80 dev server at MR 0 without a Catalyst. Click-to-result observations were 1.204, 1.202, 1.286, 1.231, and 1.125 seconds (median 1.204 s; max-of-five p95 1.286 s). The final four-mod result fit 29/30 capacity, and “Why This Build” showed the single-target encounter estimate. Reset/Reload restored the no-weapon, empty planner. This is a warm desktop dev-server Worker sample, not production-bundle, cold-start, or cross-device latency.

## Fresh ten-case Node run after status-probability and Blast target-payout corrections

Run date: 2026-11-11. `npm run benchmark:build-planner` ran five times for each scenario with full search widths 512/128/48. Each scenario returned an identical build and proxy score across its five runs; every result passed capacity, uniqueness, incompatibility, and Forma-limit checks. The p95 column is the maximum of five observations, not a stable tail estimate.

| Weapon / attack | Goal / target | Median | p95 (max of 5) | Forma | Stable and legal |
| --- | --- | ---: | ---: | ---: | --- |
| Braton Prime / Normal Attack | Burst / Grineer | 5.836 s | 6.424 s | 3 | Yes |
| Cedo / Normal Attack | Burst / Grineer | 4.555 s | 4.563 s | 3 | Yes |
| Cedo / Glaive Radial Attack | Burst / Grineer | 4.967 s | 5.910 s | 3 | Yes |
| Laetum / Normal Attack | Burst / Corpus | 5.477 s | 5.783 s | 3 | Yes |
| Cinta / Quick Shot | Burst / Grineer | 4.848 s | 5.130 s | 2 | Yes |
| Kuva Hek / Normal Attack | Scaling / Grineer | 3.903 s | 3.986 s | 2 | Yes |
| Torid (base mode) / Grenade Impact | Scaling / Corpus | 5.537 s | 6.115 s | 3 | Yes |
| Broken War / Normal Attack | Burst / Grineer | 4.734 s | 5.149 s | 3 | Yes |
| Corvas Prime / Uncharged Shot | Burst / Corpus | 1.913 s | 2.027 s | 3 | Yes |
| Verglas Prime / Normal Attack | Burst / Grineer | 5.266 s | 6.236 s | 3 | Yes |

Seven of ten cases exceed the five-second Node-core target. These are desktop optimizer-core measurements; they do not measure browser Worker or mobile latency. The search width was left unchanged because prior narrower experiments changed selected builds and reduced scores. This is a historical timing run superseded by the incompatibility-group bitmask refresh below; repeatability and legality do not prove global optimality or Underframe parity.

## Fresh ten-case run after incompatibility-group bitmask

Run date: 2026-11-11. `npm run benchmark:build-planner` ran five times for each case with the full search widths 512/128/48, MR 30, max-ranked mods, Catalyst, Exilus and arcane optimization, initial conditional state, and up to three Forma. Beam states now use a BigInt mask for selected incompatibility groups instead of cloning a `Set` for every accepted candidate. All ten cases produced the same build and score within their five repetitions, and every result passed capacity, unique-mod, incompatibility, and Forma checks. The p95 column is the maximum of five observations.

| Weapon / attack | Goal / target | Median | p95 (max of 5) | Forma | Stable and legal |
| --- | --- | ---: | ---: | ---: | --- |
| Braton Prime / Normal Attack | Burst / Grineer | 5.650 s | 6.297 s | 3 | Yes |
| Cedo / Normal Attack | Burst / Grineer | 4.005 s | 4.476 s | 3 | Yes |
| Cedo / Glaive Radial Attack | Burst / Grineer | 4.894 s | 5.405 s | 3 | Yes |
| Laetum / Normal Attack | Burst / Corpus | 5.583 s | 5.642 s | 3 | Yes |
| Cinta / Quick Shot | Burst / Grineer | 4.801 s | 5.069 s | 2 | Yes |
| Kuva Hek / Normal Attack | Scaling / Grineer | 3.808 s | 4.230 s | 2 | Yes |
| Torid (base mode) / Grenade Impact | Scaling / Corpus | 5.700 s | 6.068 s | 3 | Yes |
| Broken War / Normal Attack | Burst / Grineer | 4.847 s | 5.053 s | 3 | Yes |
| Corvas Prime / Uncharged Shot | Burst / Corpus | 1.842 s | 2.054 s | 3 | Yes |
| Verglas Prime / Normal Attack | Burst / Grineer | 4.999 s | 5.356 s | 3 | Yes |

Eight p95 observations were lower than the preceding ten-case run and two were higher, but the differences were small and timing is variable; this does not isolate a bitmask speedup. Six cases still exceed the five-second Node-core target. Production build emitted a 53,039-byte (53.04 kB) Worker. `npm test -- --maxWorkers=1` passes 499 tests across 47 files, focused ESLint and `validate:sources` pass, and the production build passes with the existing large-chunk warning. This Node measurement does not establish browser Worker, cold-start, mobile, or cross-device latency.

## Five-run full-rank port-80 Worker timing after bitmask

In the ChatGPT in-app browser, Braton Prime was optimized five times against the port-80 development server with weapon rank 30, MR 30, Catalyst installed and allowed, initial conditional state, and Forma optimization capped at three. Each run returned eight max-rank mods, used three Forma, and displayed a legal 60/60 capacity. Click-to-result measurements were 3.902, 3.695, 3.473, 3.461, and 3.835 seconds (median 3.695 s; max-of-five p95 3.902 s). The test build and settings were cleared, MR was restored to 0, and reload returned to no weapon and zero filled slots. This is one warmed desktop development-server Worker scenario; it does not establish the packaged production Worker distribution, cold-start latency, or cross-device performance.

## Braton optimizer hot-path profile and allocation experiment (2026-11-11)

A one-run CPU profile of the full-rank Braton Prime Node scenario sampled `calculateBuild` 349 times, `scoreEffects` 153 times, `beamSearch` 140 times, and garbage collection 200 times. These are profiler samples, not function invocation counts. The trace suggests repeated exact-build evaluation is a significant hot path, but it did not isolate a narrower scoring component.

Tested reusing the existing read-only status-immunity `Set` instead of copying it in every `calculateBuild` call. Five-run A/B results were effectively indistinguishable: the cloning baseline measured 3.442 s median / 3.641 s max-of-five p95; the reuse variant measured 3.435 s / 3.789 s. Both runs produced the same 69,447.12 score, eight-mod build, 60/60 capacity, three Forma, and legal result. The small median difference was outweighed by the higher maximum observation, so the change was reverted and no speedup is claimed. This experiment did not address the broader ten-case performance misses or establish a browser-production distribution.

## Pre-cleanup 16-case Node baseline after Phantasma Beam ramp (2026-11-11)

Five runs per case used the full 512/128/48 search widths, max-rank mods, initial conditional state, MR 30, weapon rank 30 (40 for over-level weapons), Catalyst, up to three Forma, and Exilus/arcane optimization. The benchmark selected the named attack where listed and otherwise the default attack. All sixteen cases returned capacity-legal builds within the Forma limit. The p95 is the maximum of five samples, not a stable tail estimate.

| Weapon / attack | Goal / target | Median | p95 (max of 5) | Forma | Legal |
| --- | --- | ---: | ---: | ---: | --- |
| Braton Prime / Normal Attack | Burst / Grineer | 4.313 s | 5.079 s | 3 | Yes |
| Cedo / Normal Attack | Burst / Grineer | 3.069 s | 3.219 s | 3 | Yes |
| Cedo / Glaive Radial Attack | Burst / Grineer | 3.605 s | 3.991 s | 3 | Yes |
| Phantasma Prime / Plasma Bomb Explosion | Burst / Grineer | 3.094 s | 3.524 s | 2 | Yes |
| Laetum / Normal Attack | Burst / Corpus | 4.029 s | 4.320 s | 3 | Yes |
| Cinta / Quick Shot | Burst / Grineer | 3.641 s | 3.858 s | 2 | Yes |
| Kuva Hek / Normal Attack | Scaling / Grineer | 3.079 s | 3.382 s | 2 | Yes |
| Torid / Grenade Impact | Scaling / Corpus | 4.648 s | 4.732 s | 3 | Yes |
| Broken War / Normal Attack | Burst / Grineer | 3.411 s | 3.801 s | 3 | Yes |
| Corvas Prime / Uncharged Shot | Burst / Corpus | 1.314 s | 1.523 s | 3 | Yes |
| Verglas Prime / Normal Attack | Burst / Grineer | 3.875 s | 4.361 s | 3 | Yes |
| Phantasma Prime / Beam | Scaling / Grineer | 3.414 s | 3.552 s | 3 | Yes |
| Rubico Prime / Normal Attack | Burst / Grineer | 3.453 s | 3.470 s | 3 | Yes |
| Epitaph / Charged Shot | Burst / Corpus | 5.147 s | 5.289 s | 3 | Yes |
| Nataruk / Perfect Shot | Burst / Grineer | 3.011 s | 3.468 s | 2 | Yes |
| Gram Prime / Heavy Slam Attack | Burst / Grineer | 3.178 s | 3.227 s | 3 | Yes |

Only Braton Prime and charged Epitaph exceed the five-second target in this pre-hot-path-cleanup full-corpus run. Measurements were taken on Windows x64 with Node v22.16.0 and 28 reported logical CPUs. This refresh includes the Phantasma Beam ramp; it predates the `calculateBuild` allocation and Initial-state conditional-scan cleanup below.

## `calculateBuild` allocation and Initial-state scan cleanup (2026-11-11)

A one-run full-rank Braton CPU profile recorded 4,788 samples (including module-loading and idle time). Among optimizer frames, 569 samples were in `calculateBuild`, 151 in `beamSearch`, 150 in `scoreEffects`, 96 across `assignModsToSlots`, and 186 in garbage collection. These are sampler observations, not invocation counts. The hot path previously allocated small primary-element arrays and ran callback helpers for every candidate mod/conditional. It now uses direct loops while preserving element source-slot ordering and accumulation order. In Initial mode, `scoreEffects` no longer scans conditional entries for status gates, because Initial disables all such triggered effects; non-Initial scoring retains the reachability check.

The full 510-test/48-file suite passes, as do `tsc -b`, focused ESLint, source validation, the production build, and CRLF-aware diff checking. The production optimizer Worker is 55,581 bytes. Preliminary five-run targeted Node reruns measured Braton Prime at 3.793 s median / 4.728 s max-of-five p95 and charged Epitaph at 4.672 s / 4.991 s; each returned a legal three-Forma build. The full 16-case post-change run below supersedes those two focused latency observations. Port 80 confirmed a legal Braton result at 30/30 capacity in four of eight slots; reload restored no selected weapon and zero filled slots. This does not establish packaged production, cold-start, mobile, or cross-device p95, nor full-catalog build quality.

## Fresh 16-case Node run after hot-path cleanup (2026-11-11)

This five-run full-width refresh follows the `calculateBuild` allocation cleanup and the Initial-state status-gate scan elimination. Inputs and legality checks match the pre-cleanup 16-case baseline: Windows x64, Node v22.16.0, max-rank mods, initial conditional state, MR 30, weapon rank 30 (40 for over-level weapons), Catalyst, up to three Forma, Exilus/arcane optimization, and beam widths 512/128/48. Every scenario selected the same mod set and score in all five repetitions; all builds passed capacity, uniqueness, incompatibility, and Forma-limit checks. p95 is the maximum of five observations.

| Weapon / attack | Goal / target | Median | p95 (max of 5) | Forma | Stable and legal |
| --- | --- | ---: | ---: | ---: | --- |
| Braton Prime / Normal Attack | Burst / Grineer | 4.027 s | 4.203 s | 3 | Yes |
| Cedo / Normal Attack | Burst / Grineer | 2.961 s | 3.190 s | 3 | Yes |
| Cedo / Glaive Radial Attack | Burst / Grineer | 3.471 s | 3.618 s | 3 | Yes |
| Phantasma Prime / Plasma Bomb Explosion | Burst / Grineer | 2.682 s | 2.997 s | 2 | Yes |
| Laetum / Normal Attack | Burst / Corpus | 3.984 s | 4.336 s | 3 | Yes |
| Cinta / Quick Shot | Burst / Grineer | 3.273 s | 3.848 s | 2 | Yes |
| Kuva Hek / Normal Attack | Scaling / Grineer | 3.035 s | 3.262 s | 2 | Yes |
| Torid / Grenade Impact | Scaling / Corpus | 3.278 s | 5.038 s | 3 | Yes |
| Broken War / Normal Attack | Burst / Grineer | 2.403 s | 2.479 s | 3 | Yes |
| Corvas Prime / Uncharged Shot | Burst / Corpus | 0.977 s | 0.981 s | 3 | Yes |
| Verglas Prime / Normal Attack | Burst / Grineer | 2.656 s | 2.766 s | 3 | Yes |
| Phantasma Prime / Beam | Scaling / Grineer | 2.190 s | 2.271 s | 3 | Yes |
| Rubico Prime / Normal Attack | Burst / Grineer | 2.334 s | 2.462 s | 3 | Yes |
| Epitaph / Charged Shot | Burst / Corpus | 3.456 s | 3.491 s | 3 | Yes |
| Nataruk / Perfect Shot | Burst / Grineer | 2.087 s | 2.100 s | 2 | Yes |
| Gram Prime / Heavy Slam Attack | Burst / Grineer | 2.340 s | 2.390 s | 3 | Yes |

Fifteen of sixteen max-of-five p95 observations are below the five-second Node-core target; Torid exceeds it by 38 ms in this coarse five-run batch. A dedicated 20-run Torid follow-up returned the same build and score each time, with a 3.204 s median, 3.359 s p95, and 3.382 s maximum, so the isolated 5.038 s observation did not recur. These measurements are stable on the listed desktop run but do not isolate the speedup from CPU/warm-cache variation. They do not measure the production Worker bundle, cold starts, mobile, or cross-device performance, and do not establish build quality outside the chosen scenario corpus.

## Fresh 16-case Node benchmark after heavy-sequence update (2026-11-12)

Five runs per case were measured on Windows x64 with Node v22.16.0 and 28 logical CPUs. Inputs use the script's Initial conditional state, MR 30, max-rank mods, Catalyst, Exilus and arcane optimization, and up to three Forma; no profile-owned Rivens or custom target profiles are supplied. All 16 returned capacity-legal builds within the Forma cap. Each p95 below is the maximum of five observations, not a reliable population-tail estimate.

| Weapon / attack | Goal / target | Median | p95 (max of 5) | Forma | Legal |
| --- | --- | ---: | ---: | ---: | --- |
| Braton Prime / Normal Attack | Burst / Grineer | 2.450 s | 2.643 s | 3 | Yes |
| Cedo / Normal Attack | Burst / Grineer | 1.885 s | 1.998 s | 3 | Yes |
| Cedo / Glaive Radial Attack | Burst / Grineer | 2.285 s | 2.894 s | 3 | Yes |
| Phantasma Prime / Plasma Bomb Explosion | Burst / Grineer | 1.860 s | 1.898 s | 2 | Yes |
| Laetum / Normal Attack | Burst / Corpus | 2.387 s | 2.468 s | 3 | Yes |
| Cinta / Quick Shot | Burst / Grineer | 2.153 s | 2.190 s | 2 | Yes |
| Kuva Hek / Normal Attack | Scaling / Grineer | 1.825 s | 1.850 s | 2 | Yes |
| Torid / Grenade Impact | Scaling / Corpus | 2.709 s | 2.782 s | 3 | Yes |
| Broken War / Normal Attack | Burst / Grineer | 2.211 s | 2.250 s | 3 | Yes |
| Corvas Prime / Uncharged Shot | Burst / Corpus | 0.936 s | 0.974 s | 3 | Yes |
| Verglas Prime / Normal Attack | Burst / Grineer | 2.080 s | 2.183 s | 3 | Yes |
| Phantasma Prime / Beam | Scaling / Grineer | 1.941 s | 1.990 s | 3 | Yes |
| Rubico Prime / Normal Attack | Burst / Grineer | 1.910 s | 1.941 s | 3 | Yes |
| Epitaph / Charged Shot | Burst / Corpus | 2.872 s | 2.882 s | 3 | Yes |
| Nataruk / Perfect Shot | Burst / Grineer | 1.716 s | 1.719 s | 2 | Yes |
| Gram Prime / Heavy Slam Attack | Burst / Grineer | 1.779 s | 1.819 s | 3 | Yes |

This refresh shows no case over five seconds on this desktop Node-core corpus. It is not an A/B proof of a speedup, does not establish global build quality, and does not measure the production browser Worker, cold-start behavior, mobile hardware, or cross-device p95. The optimizer still scores melee using its selected starting combo scenario; the new repeated heavy-attack combo state applies only to the separate direct-hit TTK explanation.

## Matched Torid QA build comparison in the port-80 in-app browser (2026-11-12)

The saved Underframe `Torid parity QA` share page and Tenno-Hub were inspected in the in-app browser. Both used the Torid Grenade Impact against a level-1 Corpus Crewman with 7,200 Health, 10,800 Shields, zero Armor, and zero Overguard. Toxin bypass was enabled. The same eight mod names and ranks were entered in Tenno-Hub with the Arcane disabled:

| Mod | Rank |
| --- | ---: |
| Malignant Force | 3 |
| Vile Acceleration | 5 |
| Hammer Shot | 3 |
| Primed Bane of Corpus | 10 |
| Rifle Aptitude | 5 |
| Rifle Elementalist | 5 |
| Continuous Misery | 3 |
| Speed Trigger | 5 |

| Measurement | Underframe | Tenno-Hub |
| --- | ---: | ---: |
| Luck-average DPS / expected encounter DPS | 1,830 | 1,800 |
| Luck-average damage per shot | 286 raw + 586 DoT | Not a matching reported metric |
| Luck-average TTK | Not reported (`?`) | 4.00 s expected TTK, 9 attacks |
| Five-run sampled DPS | 1,377 / 1,577 / 2,374 / 2,374 / 1,577 | Deterministic expected-value result: 1,800 |
| Sampled TTK | `>5s` / 4.57 / 3.03 / 3.03 / 4.57 s | Deterministic expected-value result: 4.00 s |
| Sample summary | Mean 1,855.8 / median 1,577 DPS; median TTK 4.57 s; one TTK right-censored at 5 s | Direct 2,514 + status 4,686 damage across the expected encounter |

The Underframe native sample is a five-second stochastic simulation and visibly varies between runs. Tenno-Hub reports an expected finite encounter with mean-field status applications. These metrics use the same weapon, mod ranks, target pools, and Toxin routing but are not identical simulation methods; the close luck-average values are a narrow consistency check, not proof of simulator equivalence or superiority. The saved share page's Luck Average TTK is `?`.

With the Arcane disabled, Underframe Auto Build displayed a `Best DPS: 1,788` toast. Its read-only share page did not reveal or apply the winning mod list, so the toast cannot be rescored or compared to Tenno-Hub's optimizer output under common assumptions.

An in-app-browser recheck on 2026-11-12 ran Auto Build on the same Torid QA Copy. The visible settings were a five-second luck-averaged run, three-Forma limit, and enabled final refinement. It again finished with `Best DPS: 1,788`, while the winning mod list remained hidden and the visible slots stayed on the saved QA list. The page was not edited or saved. This confirms that the current share-page flow still cannot provide a common-model Auto Build winner comparison.

The repeatable common-model script also compares the saved Underframe list with Tenno-Hub's optimized list after evaluating both in the same Initial conditional state, as Torid Grenade Impact against the same target:

| Fixed build replayed through Tenno-Hub's common model | Scaling proxy score | Expected encounter DPS | TTK | Attacks | Capacity / Forma |
| --- | ---: | ---: | ---: | ---: | --- |
| Underframe saved QA list | 16,735.69 | 1,800 | 4.00 s | 9 | 58/60, 3 Forma |
| Tenno-Hub optimizer list | 51,622.67 | 4,320 | 1.67 s | 3 | 60/60, 3 Forma |

On this one saved candidate, Tenno-Hub's selected list scores 3.08× higher under the shared proxy and reaches the modeled target 2.4× faster. This is evidence that the optimizer improves on this fixed QA list, not evidence that it beats Underframe Auto Build: Underframe's `Best DPS: 1,788` winner remains hidden and its native simulator is not available for the Tenno-Hub list. Both score and encounter figures are the same Tenno-Hub model; they are not Underframe-native scores.

Tenno-Hub separately optimized Sustained DPS for the same target in its Realistic conditional state, with Catalyst enabled, no Arcane, and a three-Forma cap. The selected build was Malignant Force R3, Heavy Caliber R10, Hammer Shot R3, Primed Bane of Corpus R10, Rifle Elementalist R5, Galvanized Chamber R10, Continuous Misery R3, and Rifle Aptitude (Flawed) R3. It used 60/60 capacity and three Forma. The optimizer's internal finite-encounter proxy score was 69,690.6; its expected encounter was 1.33 s / three attacks / 5,400 damage/s, with 5,038 direct and 2,162 status damage. The comparison script reproduces this Realistic-state candidate and separately replays both fixed mod lists in the Initial state. The internal score is not a displayed in-game DPS value. Because Underframe's Auto Build result is hidden, this is a legal target-specific candidate but not an optimizer winner comparison.

The script `npm run benchmark:torid-comparison` reproduces Tenno-Hub's common-model replay and carries the captured Underframe native sample values as source observations. This comparison covers one low-level, unarmored, Toxin-shield-bypass target. It does not cover armor, Overguard, Steel Path, alternate Torid attacks, broader weapon quality, or common-model scoring of Underframe Auto Build's hidden winner. The overhaul remains open.

#### Current-source replay of the captured Torid fixture (2026-11-24)

`npm run benchmark:torid-comparison` was rerun against current main at `e127c622`; it reuses the five native Underframe samples captured in the in-app browser on 2026-11-12 and does not recapture or edit the Underframe page. The saved list still replays at 1,800 expected encounter DPS / 4.00s / nine attacks, close to the captured 1,830 Luck Average read and the five-run native mean of 1,855.8 DPS. The current Tenno-Hub optimizer selects Rime Rounds R3, Vigilante Armaments R5, Primed Bane of Corpus R10, Vile Acceleration R5, Magnetic Capacity R3, Galvanized Chamber R10, Galvanized Aptitude R10, and Radiated Reload R3; it is legal at 60/60 capacity with three Forma.

| Current Tenno-Hub evaluation | State | Common scaling score | Expected encounter DPS | TTK | Attacks |
| --- | --- | ---: | ---: | ---: | ---: |
| Saved Underframe QA list | Initial | 21,339.43 | 1,800.00 | 4.00s | 9 |
| Optimizer list replay | Initial | 33,522.41 | 4,476.16 | 4.02s | 9 |
| Optimizer-selected result | Realistic | 173,190.48 | 12,825.00 | 1.40s | 5 |

The optimizer's Realistic result and fixed Initial replays use different conditional assumptions, so the table is not a direct score comparison between the saved and selected builds. More importantly, Underframe's `Best DPS: 1,788` winner remains hidden; the native samples still come from a saved QA list, not an Auto Build result. This refresh demonstrates current Tenno-Hub scorer consistency and current candidate output for one fixture, not Underframe optimizer parity or gameplay performance. See `scripts/compareToridUnderframe.ts` for the reproducible calculation.

## Electric/Gas pack-score follow-up (2026-11-12)

The planner's optional custom-target input accepts 0–20 additional same-profile enemies assumed to remain inside the relevant Electricity or Gas status cloud. The optimizer's fast score scales only those two DoT rates by the configured count plus the primary target. It does not change direct damage, and it does not simulate each neighbor's position, defenses, pool depletion, or status history. Gas radius growth by stack is not dynamically calculated. The default is zero, and the math trace labels this as an assumption. Port-80 QA set two nearby enemies, inspected the trace, disabled the target setup, and reloaded the empty planner.

The research references are the current Wiki [Electricity Damage](https://wiki.warframe.com/w/Damage/Electricity_Damage) and [Gas Damage](https://wiki.warframe.com/w/Damage/Gas_Damage) pages: Electric chains tick once per second for six seconds within 3m; Gas ticks once per second for six seconds and its cloud grows from 3m to 6m with stacks. This bounded score feature is not a finite multi-target encounter model and does not establish performance or build-quality improvement. Release checks pass at 525 tests / 48 files, production build, source validation, focused ESLint, and CRLF-aware diff check; the production Worker asset is 58,120 bytes. No new latency claim is made from this change.

## Blast radial neighbor follow-up (2026-11-12)

The current Wiki [Blast Damage](https://wiki.warframe.com/w/Damage/Blast_Damage) page was reviewed in the ChatGPT in-app browser on 2026-11-12 (the page shows a 2026-11-03 last-edit date and an active-edit notice). The reviewed rules distinguish the afflicted target's natural/cap payout from the cap/death radial: active stacks contribute `3 × H` each to one radial damage instance against nearby enemies, excluding the original host. The page specifies a 5 m radial and the general ten-stack cap; the planner's custom-target boss override retains the four-stack cap.

Custom target inputs now accept 0–20 additional same-profile Blast neighbors. The finite mean-value encounter applies the combined cap/death radial through each neighbor's Blast type and defense rules, updates those neighbors' pools, and reports aggregate collateral separately from the primary target's DPS/TTK. It does not simulate neighbor statuses, positions, or chained deaths. The optimizer adds only a fast Poisson estimate of cap-radial value during the scaled fuse; it does not model death-triggered radial value or evolving neighbor pools. Port-80 QA saved and reloaded the named Lancer target plus both Electric/Gas and Blast neighbor counts, verified the math trace, then turned Faction Focus off and left the planner with zero filled slots. The QA saved-build record remains in local storage because the product's delete control is permanent.

Release checks pass at 528 tests / 48 files, production build, source validation, focused ESLint, TypeScript, and CRLF-aware diff check; the production Worker asset is 58,733 bytes. The refreshed 16-case Node benchmark is recorded below. It measures the current scorer with default faction profiles, so it does not exercise the configured Blast-neighbor branch or establish build-quality improvement.

### Refreshed full-width Node run after Blast radial score update (2026-11-12)

`npm run benchmark:build-planner` ran five optimizations per case using the full 512/128/48 search widths, MR 30, initial conditional state, max-ranked mods, Catalyst, Exilus and arcane optimization, and up to three Forma. Default faction target profiles were used; custom target crowd counts were not supplied. Every returned build passed capacity, uniqueness, incompatibility, and Forma-limit validation. The p95 column is the maximum of five samples, not a statistically reliable tail estimate.

| Weapon / attack | Goal / target | Median | p95 (max of 5) | Forma | Legal |
| --- | --- | ---: | ---: | ---: | --- |
| Braton Prime / Normal Attack | Burst / Grineer | 2.39 s | 2.66 s | 3 | Yes |
| Cedo / Normal Attack | Burst / Grineer | 1.89 s | 1.94 s | 3 | Yes |
| Cedo / Glaive Radial Attack | Burst / Grineer | 2.26 s | 2.33 s | 3 | Yes |
| Phantasma Prime / Plasma Bomb Explosion | Burst / Grineer | 1.86 s | 2.06 s | 2 | Yes |
| Laetum / Normal Attack | Burst / Corpus | 2.37 s | 2.44 s | 3 | Yes |
| Cinta / Quick Shot | Burst / Grineer | 2.13 s | 2.16 s | 2 | Yes |
| Kuva Hek / Normal Attack | Scaling / Grineer | 1.85 s | 1.86 s | 2 | Yes |
| Torid / Grenade Impact | Scaling / Corpus | 2.68 s | 2.72 s | 3 | Yes |
| Broken War / Normal Attack | Burst / Grineer | 2.21 s | 2.31 s | 3 | Yes |
| Corvas Prime / Uncharged Shot | Burst / Corpus | 0.90 s | 0.91 s | 3 | Yes |
| Verglas Prime / Normal Attack | Burst / Grineer | 2.13 s | 2.17 s | 3 | Yes |
| Phantasma Prime / Beam | Scaling / Grineer | 1.96 s | 1.97 s | 3 | Yes |
| Rubico Prime / Normal Attack | Burst / Grineer | 1.86 s | 1.96 s | 3 | Yes |
| Epitaph / Charged Shot | Burst / Corpus | 2.87 s | 2.91 s | 3 | Yes |
| Nataruk / Perfect Shot | Burst / Grineer | 1.76 s | 1.77 s | 2 | Yes |
| Gram Prime / Heavy Slam Attack | Burst / Grineer | 1.77 s | 1.81 s | 3 | Yes |

The observed median range is 0.90–2.87 s and the max-of-five p95 range is 0.91–2.91 s on this Windows x64 / Node v22.16.0 desktop. All scenarios were under five seconds in this batch. This does not measure the packaged browser Worker, cold starts, mobile hardware, or Blast-neighbor scoring with a nonzero configured count. The melee heavy-slam result remains a proxy without stance timing, combo generation, or heavy wind-up.

## Electricity/Gas finite collateral follow-up (2026-11-12)

The current Wiki [Electricity Damage](https://wiki.warframe.com/w/Damage/Electricity_Damage) page (last edited 2026-09-02) specifies six one-second Tesla Chain ticks within 3 m, independent status timers, and same-time stacked Electricity damage as one pulse per second. The [Gas Damage](https://wiki.warframe.com/w/Damage/Gas_Damage) page (last edited 2026-10-26) specifies six one-second ticks, independent instances up to ten stacks, a 3 m initial cloud that expands by 0.3 m per stack to 6 m, and continued cloud damage to nearby targets after the host dies.

The finite encounter now coalesces same-time Electricity ticks and sends scheduled Electricity/Gas damage to the configured 0–20 same-profile neighboring pools. Their Overguard, Shields, and Health deplete separately from the primary target; collateral totals do not alter primary TTK. Pending Gas ticks continue after primary death, and oldest-cloud pending ticks are reduced/replaced at the ten-stack cap. It assumes every configured neighbor remains in range and does not simulate neighbor statuses, positions, chain geometry, or Gas radius growth. The optimizer remains a fast score proxy using the configured affected-target count; it does not evolve neighbor pools. Unit tests cover Electric/Gas collateral, same-time Electricity pulse pool routing, Gas cap replacement, and persistence after primary death. In the port-80 in-app browser, Amprex with two configured nearby enemies showed 21,490 aggregate scheduled-tick collateral while primary encounter duration stayed at 509.35 seconds; resetting Faction Focus cleared the temporary custom target and restored the pre-check planner configuration. Release checks pass at 533 tests / 48 files, production build (58,733-byte optimizer Worker), source validation, focused ESLint, and CRLF-aware diff check. The benchmark above predates these finite-encounter-only changes; the optimizer scoring path and its 16-case measurements were unchanged. The measured Node results do not establish packaged Worker, cold-start, or mobile performance.

## Enemy Shield Gate follow-up (2026-11-12)

The current Wiki [Shield Gating](https://wiki.warframe.com/w/Shield#Shield_Gating) section states that an enemy's gate lasts 0.1 seconds after Shields break; during it, only 5% of damage dealt reaches Health. Weakspot hits bypass the gate, some slam/AoE hits are completely blocked, and separate status-effect damage can still land. The finite expected encounter and ordered direct-hit sequence apply that rule to direct Health damage using a persisted target setting with body, weakspot, and blocked-slam/AoE modes. Scheduled status ticks remain ungated. Shield regeneration, per-weapon weakspot eligibility, the one-hit estimate, and optimizer score remain outside this model.

Port-80 in-app-browser QA used a custom Corpus target with 10 Shields and 100 Health and Amprex. In the finite encounter, body-hit mode produced 0.33 s / 5 attacks and weakspot mode 0.25 s / 4 attacks; in the direct-hit sequence, body-hit mode produced 0.42 s / 6 attacks and weakspot mode 0.33 s / 5 attacks. The planner was reloaded to its original no-weapon welcome state without creating a test save. Regression tests verify 5% direct damage inside the gate, full weakspot bypass, blocked area hits, expiry at 0.1 seconds, and ungated scheduled status damage in both direct-hit paths. `npm test` passes 536 tests / 48 files; production build, source validation, focused ESLint, and CRLF-aware diff checks pass. The Worker remains 58,733 bytes because the gate does not enter optimization scoring. The benchmark above does not measure encounter-model latency.

### Port-80 browser Worker timing sample (2026-11-12)

Five consecutive Optimize Build clicks in the ChatGPT in-app browser against `http://127.0.0.1/Tenno-Hub/` used Braton Prime / Normal Attack / Burst DPS, default MR 0, uncatalyzed settings, and the local development server's Worker. Elapsed click-to-result times were 423, 404, 432, 391, and 399 ms (median 404 ms; maximum-of-five p95 observation 432 ms). The final displayed build was legal at 30/30 capacity with 4/8 main slots filled: Malignant Force, Rime Rounds, Thermite Rounds, and Vile Acceleration. The test mods were cleared, and the empty planner was shown in a clean app tab. This is one single-weapon dev-server sample; it does not establish production-bundle, cold-start, full-corpus, or mobile performance.

### Bow cadence correction benchmark (2026-11-12)

After correcting bow charge/reload cadence, five full-width optimizer runs per case returned capacity-legal builds within the three-Forma limit. The harness used its standard MR 30, Initial conditional state, max-rank candidate mods, Catalyst, and Exilus/Arcane optimization settings. The p95 column is the maximum of five samples, a coarse observation rather than a stable tail estimate. Objectives and target presets match the harness defaults and case selections.

| Weapon / attack | Goal / target | Median | p95 (max of 5) | Forma | Legal |
| --- | --- | ---: | ---: | ---: | --- |
| Braton Prime / Normal Attack | Burst / Grineer | 2.398 s | 2.641 s | 3 | Yes |
| Cedo / Normal Attack | Burst / Grineer | 1.890 s | 1.950 s | 3 | Yes |
| Cedo / Glaive Radial Attack | Burst / Grineer | 2.281 s | 2.319 s | 3 | Yes |
| Phantasma Prime / Plasma Bomb Explosion | Burst / Grineer | 1.840 s | 1.900 s | 2 | Yes |
| Laetum / Normal Attack | Burst / Corpus | 2.390 s | 2.484 s | 3 | Yes |
| Cinta / Quick Shot | Burst / Grineer | 2.080 s | 2.100 s | 3 | Yes |
| Kuva Hek / Normal Attack | Scaling / Grineer | 1.844 s | 1.869 s | 2 | Yes |
| Torid / Grenade Impact | Scaling / Corpus | 2.807 s | 2.878 s | 3 | Yes |
| Broken War / Normal Attack | Burst / Grineer | 2.257 s | 2.278 s | 3 | Yes |
| Corvas Prime / Uncharged Shot | Burst / Corpus | 0.930 s | 0.946 s | 3 | Yes |
| Verglas Prime / Normal Attack | Burst / Grineer | 2.134 s | 2.187 s | 3 | Yes |
| Phantasma Prime / Beam | Scaling / Grineer | 1.945 s | 2.029 s | 3 | Yes |
| Rubico Prime / Normal Attack | Burst / Grineer | 1.889 s | 1.961 s | 3 | Yes |
| Epitaph / Charged Shot | Burst / Corpus | 2.884 s | 3.063 s | 3 | Yes |
| Nataruk / Perfect Shot | Burst / Grineer | 2.113 s | 2.234 s | 1 | Yes |
| Gram Prime / Heavy Slam Attack | Burst / Grineer | 1.788 s | 1.855 s | 3 | Yes |

Across this corpus the median range was 0.930–2.884 s and the max-of-five p95 range was 0.946–3.063 s. This is a desktop Node-core benchmark, not packaged-browser Worker, cold-start, or mobile latency. It measures legality and runtime, not global optimality or an Underframe winner comparison; the Gram heavy-slam case remains an attack-rate proxy. Release verification for the bow correction passes at 539 tests / 48 files, production build (59,325-byte optimizer Worker), source validation, focused ESLint, and CRLF-aware diff check. The Vite large application-chunk warning remains.

## Underframe Torid loadout-state reconciliation (2026-11-12)

The saved Torid QA build was duplicated in the in-app browser so its calculator could be checked without editing the original share page. The first calculation on that copy showed 9,699 Luck Average DPS, 1,844 raw + 133 DoT damage per shot, and 0.82 s TTK. Inspection found a mismatched state: `Enable Arcanes` was checked and `Primary Bulwark` was at 500/500. Turning Arcanes off removed that conditional; the same eight mods/ranks then returned 1,830 DPS, 286 raw + 586 DoT, and `?` TTK, exactly matching the existing no-Arcane Underframe capture. The misleading 9,699 result was a conditional-state mismatch, not a same-build parity result. The comparable fixed-list row remains 1,830 Underframe vs 1,800 expected DPS in Tenno-Hub's model; these simulator methods are not identical. Underframe Auto Build still did not expose its winning mod list, so a common-model optimizer-winner comparison remains unavailable. The local duplicate is left in the no-Arcane state; the original saved QA build was not edited.

## Primary Bulwark implementation check (2026-11-12)

The armor-dependent Primary Bulwark effect was exercised on the port-80 planner. Without armor input it is disclosed as unavailable and Auto Optimize does not select it. At 1,500 Warframe Armor, R5 contributes +500% base weapon damage and can be selected in a legal 30/30 Braton build. The empty planner was restored after reload. This confirms the UI path and legality for one scenario; it does not establish full-catalog optimization quality. The separate bounded joint oracle now matches the exhaustive Braton mod/arcane result for six candidates and four slots. The Worker remains catalog-independent at 59,693 bytes. Release checks pass at 542 tests / 48 files, production build, source validation, focused ESLint, and CRLF-aware diff check.

### Refreshed full-width Node run after forced-proc and Corinth attack fixes (2026-11-12)

`npm run benchmark:build-planner` ran five optimizations for each of the 16 scenarios, using full 512/128/48 beam widths, MR 30, Initial conditional state, max-ranked catalog mods, Catalyst, Exilus and arcane optimization, and a three-Forma limit. All 80 runs returned builds passing the harness's legality checks. The p95 column is the maximum of five samples; it is a coarse observation, not a statistically reliable tail estimate.

| Weapon / attack | Goal / target | Median | p95 (max of 5) | Forma | Legal |
| --- | --- | ---: | ---: | ---: | --- |
| Braton Prime / Normal Attack | Burst / Grineer | 2.433 s | 2.670 s | 3 | Yes |
| Cedo / Normal Attack | Burst / Grineer | 1.915 s | 1.993 s | 3 | Yes |
| Cedo / Glaive Radial Attack | Burst / Grineer | 2.294 s | 2.330 s | 3 | Yes |
| Phantasma Prime / Plasma Bomb Explosion | Burst / Grineer | 1.936 s | 2.023 s | 2 | Yes |
| Laetum / Normal Attack | Burst / Corpus | 2.456 s | 2.476 s | 3 | Yes |
| Cinta / Quick Shot | Burst / Grineer | 2.118 s | 2.184 s | 3 | Yes |
| Kuva Hek / Normal Attack | Scaling / Grineer | 1.884 s | 1.922 s | 2 | Yes |
| Torid / Grenade Impact | Scaling / Corpus | 2.694 s | 2.839 s | 3 | Yes |
| Broken War / Normal Attack | Burst / Grineer | 2.221 s | 2.271 s | 3 | Yes |
| Corvas Prime / Uncharged Shot | Burst / Corpus | 0.951 s | 0.964 s | 3 | Yes |
| Verglas Prime / Normal Attack | Burst / Grineer | 2.105 s | 2.162 s | 3 | Yes |
| Phantasma Prime / Beam | Scaling / Grineer | 2.002 s | 2.009 s | 3 | Yes |
| Rubico Prime / Normal Attack | Burst / Grineer | 1.914 s | 1.962 s | 3 | Yes |
| Epitaph / Charged Shot | Burst / Corpus | 2.945 s | 3.052 s | 3 | Yes |
| Nataruk / Perfect Shot | Burst / Grineer | 2.145 s | 2.189 s | 1 | Yes |
| Gram Prime / Heavy Slam Attack | Burst / Grineer | 1.793 s | 1.814 s | 3 | Yes |

Observed medians ranged from 0.951–2.945 s; max-of-five p95 observations ranged from 0.964–3.052 s. This desktop Node-core run does not measure packaged Worker initialization, cold starts, mobile devices, finite encounter latency, or builds outside this 16-case corpus. It does not establish global optimality or Underframe winner parity. Current release checks pass at 545 tests / 48 files, production build, `validate:sources`, focused ESLint, TypeScript (`tsc -b` via build), and CRLF-aware diff check. The production catalog-independent Worker is 59,717 bytes; the existing large application-chunk warning remains.
## Matched Braton Prime Underframe comparison and 33-scenario refresh (2026-11-12)

The latest port-80 Underframe Auto Build capture used Braton Prime / Normal Attack against Grineer with 83,818 Health, 2,700 Armor, no Shields or Overguard, Fully stacked supported mod conditionals, and Primary Overcharge R5 mapped to 1,000 Max Energy / 100% current energy. Underframe's native five-second luck-averaged sample showed 5,492 raw + 1 DoT damage per shot, 105,867 DPS, and 0.80 s TTK. That candidate was 78/60 capacity with zero Forma and is therefore illegal under Tenno-Hub's capacity rules.

Reassigning the captured eight-mod list to Tenno-Hub used 59/60 capacity and three Forma. The optimizer's legal Braton list also used 59/60 and three Forma. With both fixed lists passed through the same Tenno-Hub Expected TTK model and identical target/conditional/arcane assumptions, the Underframe list modeled 0.7691 s TTK and the Tenno-Hub list 0.6593 s, about 14.3% faster. The optimizer list was Malignant Force R3, High Voltage R3, Thermite Rounds R3, Galvanized Scope R10, Spectral Serration R10, Galvanized Aptitude R10, Vile Acceleration R5, and Bladed Rounds R5. Both use Primary Overcharge R5 at its 350% multishot cap. Underframe's native luck-average result is a different stochastic calculation and should not be compared numerically to this expected encounter output.

This capture also revealed that Expected TTK refinement could miss an elemental replacement because it appended replacement mods and thereby changed the source-slot element order. The optimizer now replaces mods in their original slot, retains unique elemental transitions/output families in its finite refinement shortlist, and exposes the same detailed encounter evaluator to the comparison script. A regression confirms a High Voltage candidate survives proxy pruning and that the optimizer's displayed finite TTK matches the shared evaluator. This improves a directly observed search miss, but the shortlist remains heuristic rather than a full-catalog joint optimum proof.

A follow-up substitution audit enumerated every legal one-, two-, three-, and four-mod swap between the optimizer's four unique mods and the Underframe candidate's four unique mods (69 total combinations). None beat the Tenno-Hub baseline of 0.6593 s under the common Expected TTK model. The best one-mod swap tied at 0.6593 s (Bladed Rounds to Vital Sense); the best two-mod result was 0.7142 s, and the exact Underframe list modeled 0.7691 s. This closes the captured candidate neighborhood only; it does not search arbitrary catalog mods or prove global optimality.

The latest full-width desktop Node benchmark covered 33 scenarios × five repetitions (165 optimizations). All returned builds passed capacity and three-Forma validation. Rounded medians ranged approximately 0.98–3.30 s; max-of-five p95 observations ranged approximately 1.00–3.56 s. These are coarse desktop Node observations, not browser Worker, production bundle, cold-start, or mobile measurements. The production catalog-independent Worker is 87,096 bytes. Release checks pass at 553 tests / 48 files, production build, `validate:sources`, focused ESLint, and CRLF-aware diff checks. A final port-80 UI recheck was blocked by an unresponsive welcome overlay; see the matching entry in `BUILD_PLANNER_OVERHAUL.md`.

A separate one-run Arcane audit evaluated every eligible Arcane rank against each returned build's finite Expected TTK result across the 13-case TTK corpus. All 13 selected ranks tied the best conditional Arcane option for their fixed mod list, with zero modeled gap. The audit time is excluded from optimizer latency, uses the corpus's Initial conditional state, and does not test Arcane-mod joint alternatives or prove global selection quality.

## Matched Underframe replay of the legal Tenno-Hub build (2026-11-12)

The earlier port-80 welcome-overlay issue was resolved in Codex's in-app browser. A fresh Braton Prime Expected TTK run on the port-80 development server returned a legal four-mod build at 30/30 capacity. Its explanation showed a 4.21 s expected encounter on the Balanced synthetic target and the optimizer's bounded-search limits. Reset and reload restored the empty planner.

For the native competitor run, the exact legal Tenno-Hub list was entered in the existing Underframe `Braton Prime benchmark (Copy)` QA build: Malignant Force R3, High Voltage R3, Thermite Rounds R3, Galvanized Scope R10, Spectral Serration R10, Galvanized Aptitude R10, Vile Acceleration R5, and Bladed Rounds R5. Underframe showed 1/60 capacity remaining and three Forma. The target was Grineer level 145 with 83,818 Health, 2,700 Armor, no Shields, and no Overguard. Supported conditionals were full: Galvanized Scope 5/5, Galvanized Aptitude 2/2, Bladed Rounds enabled, and Primary Overcharge 350/350. The five-second Luck Average returned 6,343 raw + 0 DoT damage per shot, 123,677 Average DPS, and 0.68 s TTK.

Tenno-Hub's finite expected model on the same mod list and target measured 127,137.94 DPS and 0.6593 s TTK. Relative to those values, Underframe's single native run was about 2.7% lower in DPS and 3.1% slower in TTK. This is a close matched result for one fixture; Luck Average and Tenno-Hub's expected finite encounter are different simulators. It does not establish general build parity. After measurement, the saved Underframe QA copy was restored and reload-verified to its original eight mods/ranks, three Forma, and Primary Bulwark 500/500.

The production build was rerun for this follow-up and passed (`tsc -b` plus Vite); the production catalog-independent Worker is 89,063 bytes. The existing large-chunk warning remains. Vite preview on port 4173 timed out in the Codex in-app browser, so the built Worker asset was subsequently measured through a temporary QA page served from the reachable port-80 dev host.

## Expected TTK refinement, Arcane audit, and metric consistency (2026-11-12)

For Expected TTK, the optimizer skips repeated proxy-only refinement after beam search. It evaluates up to 12 effect-diverse legal beam finalists with the finite encounter model, then tests up to four passes of up to 24 legal one-mod replacements. The additional passes let a later legal replacement revisit choices that an earlier pass moved away from. The TTK comparator prefers a kill within 600 seconds, minimizes kill time, and uses finite encounter DPS only if both candidates reach the safety cap. A candidate already killing at the first attack's 0-second origin short-circuits further local refinement.

When ownership is unrestricted, Arcane selection scores every parsed rank of each eligible candidate against the finite encounter on the final mod list. If inventory filtering is active, the selected Arcane stays at the one highest owned rank recorded by the current inventory model; lower ranks are not assumed to be owned. If the Arcane changes after mod search, one legal finite-encounter mod pass runs and the Arcane is rechecked. The independent fixed-list audit checks every rank. On the 13-case corpus below, each of five runs matched the audited best Arcane for its returned mod list with zero modeled gap. This is conditional-on-build evidence, not joint Arcane/mod or global optimality.

The full filtered-catalog corpus used MR 30, max-rank mods, Catalyst, Exilus and Arcane optimization, Initial conditional state, faction presets, and up to three Forma. It ran five repetitions per case. Every output was stable across repeats and passed capacity, uniqueness, incompatibility, and Forma validation. Timings exclude the independent all-rank audit, are Node-core desktop measurements, and are not production Worker or device-independent latency.

| Weapon / selected attack | Median | Max-of-five p95 | Expected TTK | Forma | Legal |
|---|---:|---:|---:|---:|---|
| Braton Prime / Normal Attack | 1.570 s | 1.820 s | 1.593 s | 3 | Yes |
| Cedo / Glaive Radial Attack | 1.407 s | 1.484 s | 6.842 s | 2 | Yes |
| Phantasma Prime / Plasma Bomb Explosion | 1.521 s | 1.617 s | 2.490 s | 3 | Yes |
| Laetum / Normal Attack | 1.798 s | 1.883 s | 0.160 s | 2 | Yes |
| Cinta / Quick Shot | 1.672 s | 1.733 s | 1.059 s | 3 | Yes |
| Kuva Hek / Normal Attack | 1.011 s | 1.059 s | 0.329 s | 1 | Yes |
| Torid / Grenade Impact | 1.703 s | 1.759 s | 1.333 s | 3 | Yes |
| Broken War / Normal Attack | 1.102 s | 1.119 s | 4.000 s | 2 | Yes |
| Corvas Prime / Uncharged Shot | 0.507 s | 0.545 s | 0.263 s | 3 | Yes |
| Verglas Prime / Normal Attack | 1.852 s | 1.934 s | 1.447 s | 3 | Yes |
| Epitaph / Charged Shot | 2.008 s | 2.107 s | 0.000 s | 3 | Yes |
| Nataruk / Perfect Shot | 1.385 s | 1.479 s | 1.000 s | 1 | Yes |
| Gram Prime / Heavy Slam Attack | 1.444 s | 1.516 s | 0.806 s | 3 | Yes |

Across the cases, medians ranged from 0.507 to 2.008 seconds, and max-of-five p95 observations ranged from 0.545 to 2.107 seconds. All 65 outputs were stable and legal, and the independent all-rank audit found zero conditional Arcane gap on each returned mod list. Epitaph's 0-second first-attack kill evaluated exactly one finite candidate per run. These five-run observations stay below the sampled 5-second desktop Node target, but are not a population-tail estimate; melee timing rows still use the documented attack-time proxy.

Port-80 in-app-browser QA enabled Expected TTK and Optimize Arcane on Braton Prime. The optimizer returned a legal 30/30 four-mod build with Primary Dexterity R5. QA exposed that the live selected-build calculation omitted an optimized Arcane's parsed trigger effects, although the optimizer and “Why This Build” applied its Realistic-state estimate. The live stats, saved-build comparison, optimizer math export, and explanation now all include the selected Arcane's modeled conditional effects. The selected-build encounter and “Why This Build” both showed 1.94 seconds / 10,839.4 expected damage per second. Reset/reload restored no selected weapon and no saved test build. The current production Worker is 88,971 bytes; Vite still reports the existing large lazy-chunk warning.

### Production Worker browser sample (2026-11-13)

The in-app browser loaded the actual 89,063-byte `dist/assets/buildOptimizer.worker-CsfukhLr.js` bundle through the port-80 dev host and sent the same Braton Prime / Normal Attack / Expected TTK request six times. The production Worker returned the same eight-mod list each time, a capacity-valid result, and 1.5932 s modeled TTK. The first request after Worker construction took 1,155 ms; five subsequent requests took 973, 949, 915, 913, and 903 ms (915 ms median, 973 ms maximum-of-five p95 observation). The first request includes Worker startup and computation but not a cold app/page load. These are single-desktop browser timings with catalog inputs supplied by the dev host, not mobile, population-tail, or production-server measurements.

## Perigale Prime burst reload follow-up (2026-11-13)

The optimizer benchmark added Perigale Prime / Normal Attack / Expected TTK against the Grineer preset, using MR 30, max-rank mods, Catalyst, up to three Forma, and the current filtered mod catalog. Five repeated runs returned the same legal build: Heavy Caliber R10, Primed Bane of Grineer R10, Vital Sense R5, Malignant Force R3, Primed Cryo Rounds R10, Hellfire R5, Split Chamber R5, and Point Strike R5. Each used three Forma, 58/60 capacity, and evaluated 61 finite encounter candidates. All modeled a 0.62-second kill before the first magazine ended.

| Weapon / attack | Objective / target | Median optimizer time | Max-of-five p95 observation | Modeled TTK | Forma | Legal |
|---|---|---:|---:|---:|---:|---|
| Perigale Prime / Normal Attack | Expected TTK / Grineer | 1.736 s | 4.451 s | 0.620 s | 3 | Yes |

This benchmark verifies a stable, capacity-legal optimizer result, but not reload behavior because the target dies within the first magazine. Separate catalog-backed encounter regressions cross the first reload: Perigale Prime's 16 ammo-consuming shots are delivered as four-shot bursts, then the next magazine begins after its 3-second reload. Both direct-sequence and finite-encounter tests agree at 5.48 seconds for their calibrated damage fixture; a separate partial-burst case checks the final incomplete burst. The max-of-five is a coarse five-sample observation, not a population p95. Current release checks pass at 561 tests / 48 files, production build, `validate:sources`, focused ESLint, and CRLF-aware diff check. The production optimizer Worker is 89,080 bytes. The existing large lazy-chunk warning remains.

## Five-path Expected TTK exhaustive oracle (2026-11-13)

The optimizer's finite Expected TTK result was compared with exhaustive legal builds on five current catalog attacks: Perigale Prime Normal Attack, Cedo Glaive Radial Attack, Phantasma Prime Plasma Bomb Explosion, Acrid Normal Attack, and Gram Prime Heavy Slam Attack. Each fixture used a four-mod candidate pool, maximum ranks, three mod slots, the scenario's fixed target pools, current compatibility/incompatibility rules, actual slot polarities, capacity validation, and no Forma. The oracle enumerated every unique ordering and subset up to three mods, then evaluated legal builds with the same finite Expected TTK evaluator used for optimizer scoring.

| Weapon / attack | Mechanic exercised | Search result | Build legality |
|---|---|---|---|
| Perigale Prime / Normal Attack | Four-shot burst cadence | TTK and DPS tied exhaustive best | Capacity-valid, 0 Forma |
| Cedo / Glaive Radial Attack | Radial attack/status mix | TTK and DPS tied exhaustive best | Capacity-valid, 0 Forma |
| Phantasma Prime / Plasma Bomb Explosion | Charged alternate fire | TTK and DPS tied exhaustive best | Capacity-valid, 0 Forma |
| Acrid / Normal Attack | Forced Toxin proc | TTK and DPS tied exhaustive best | Capacity-valid, 0 Forma |
| Gram Prime / Heavy Slam Attack | Combo-sensitive heavy melee | TTK and DPS tied exhaustive best | Capacity-valid, 0 Forma |

This checks search quality for five fixed, bounded candidate pools, not accuracy of the underlying evaluator or full-catalog/global optimality. It does not enumerate all ranks, joint Arcane/mod choices, or Incarnon evolutions. The focused oracle passed in 520 ms of Vitest test time; the full suite passes 561 tests across 48 files.

Remaining work includes objective-equivalent Underframe comparisons beyond the captured Braton/Torid fixtures, broader weapon/status and stochastic encounter histories, full-catalog/joint-mod-and-Arcane optimality evidence, cold app startup, mobile, and cross-device measurements.

## PC Hotfix 44.1.3 data refresh and full-width benchmark (2026-11-13)

The generated Incarnon Wiki snapshot still contained the old Dera/Boltor Crimson Overture values. The runtime catalog now uses Hotfix 44.1.3's current +25% Ammo Efficiency per kill stack, 5-second duration, and three-stack cap for Dera, Dera Vandal, Boltor, Boltor Prime, and Telos Boltor. The Dera/Boltor Ammo Efficiency then follows the current 75% ordinary cap. Variant-specific static base damage (+8 Dera, +6 Dera Vandal, and +12 base Boltor) is modeled; the Boltor's separate +2-per-kill base-damage effect remains disclosed as unsupported. Tests verify current labels, timed conditional effects, and the right static damage for all five variants. Custom Riven imports/edits use the official shared 1.20 factor, legacy custom Riven records normalize from their recorded factor, and the browser Riven editor exposes that shared-factor rule.

The refreshed five-run desktop Node corpus ran all 34 cases (170 optimizer runs) under Initial conditionals, MR 30, a Catalyst, max-rank catalog mods, Exilus and Arcane optimization, and at most three Forma. Every case returned a capacity-legal build within the Forma limit. Median latency ranged from 0.775 to 4.546 seconds; max-of-five p95 observations ranged from 0.816 to 5.298 seconds. Only the Epitaph Charged Shot Burst case exceeded five seconds (5.298 seconds). These are coarse Windows x64 Node 22.16.0 timings from five repetitions, not a population tail or packaged/cold/mobile Worker measurement.

An isolated five-run repeat of Epitaph Charged Shot Burst returned the same legal build and score, with a 4.845-second median and 5.570-second maximum observation. This confirms that the five-second exceedance is reproducible on that scenario; no narrower beam or candidate set was applied because prior experiments reduced build quality on other weapons.

The final regression suite passes 567 tests across 49 files. Production build, source validation, focused ESLint for the changed Riven/Incarnon domain and ModBuilder paths, and CRLF-aware diff check pass. The catalog-independent production optimizer Worker is 89,657 bytes. A full-file ESLint run on `Mods.tsx` still reports six errors and one warning in other existing areas; Vite also retains the current large lazy-chunk warning.

## Epitaph Burst scoring allocation follow-up (2026-11-13)

The earlier Epitaph Charged Shot result above five seconds was for the Burst objective; an under-five-second Expected TTK run was a different objective. A fresh five-run Burst rerun on the same Windows x64 Node 22.16.0 environment returned the same capacity-valid, three-Forma build and score on every run: median 7.420 s, max-of-five p95 observation 8.200 s, score 241,624.74. Disabling Exilus and Arcane optimization for one diagnostic run measured 6.687 s and kept the same result, so those optional passes do not explain most of the delay.

The CPU profile showed repeated `calculateBuild` work as the main planner-side hot path. `calculateBuild` now reuses a supplied `Set` of status immunities instead of allocating an identical copy for each beam candidate; other `Iterable` inputs are still copied into a local set. A regression verifies identical output and that the caller's set remains unchanged. The refreshed five-run Burst benchmark returned the identical legal mod list and score, with 5.970 s median and 7.163 s max-of-five p95 observation (about 19.5% lower median than the preceding rerun). This improves the case but still exceeds the five-second desktop Node target. The production Worker is 89,712 bytes. The full suite passes 568 tests / 49 files; production build, source validation, focused ESLint, and CRLF-aware diff check pass.

One warmed port-80 dev-Worker click-to-result check for an uncatalyzed MR 0 Epitaph Charged Shot / Burst build measured 1.013 s and returned a legal four-mod 28/30 build. Reset restored 0/8 filled slots. This browser run used a different progression/capacity setup from the max-rank, three-Forma Node benchmark and is a single observation, not a p95 measurement.

## Epitaph Burst scoring-buffer follow-up (2026-11-13)

The second CPU-profile review showed that the beam loop rebuilt a mapped slot-effect array and concatenated it with pre-equipped effects for every candidate score. `scoreSlots` now fills one reusable scratch buffer per beam search. The scoring path consumes it synchronously and does not retain or mutate the effect list; empty slots remain in place to preserve source ordering. This keeps the scoring function and damage evaluator unchanged while avoiding two transient arrays per candidate.

The same five-run Epitaph Charged Shot / Burst benchmark returned the identical build and exact score on every run: Lethal Torrent R5, Primed Target Cracker R10, Pathogen Rounds R5, Pistol Pestilence R3, Hornet Strike R10, Barrel Diffusion R5, Primed Expel Corpus R10, and Creeping Bullseye R5. It used three Forma, 60/60 capacity, and scored 241,624.7363. Median optimizer time fell from the preceding 5.970 s to 3.013 s (49.5%); the max-of-five p95 observation fell from 7.163 s to 4.734 s. The five-sample observation is below the desktop Node target, but is not a population-tail or packaged/mobile measurement.

`npm test` passes 568 tests across 49 files. The production build, source validation, focused ESLint for `buildOptimizerCore.ts`, and CRLF-aware diff check pass. The catalog-independent production Worker is 89,790 bytes; the existing large lazy-chunk warning remains. The full-corpus latency refresh is recorded below; broader objective-quality comparison remains open.

## Full-width post-buffer benchmark (2026-11-13)

The same five-run 34-case corpus was rerun after scratch-buffer reuse: 170 optimizer runs across the existing Initial-state cases, with MR 30, Catalyst, max-rank catalog mods, Exilus and Arcane optimization, and a three-Forma cap. All cases returned legal builds with stable mod lists, scores, and Arcane selections. Median times ranged from 0.487 to 3.033 s; max-of-five p95 observations ranged from 0.515 to 3.234 s. The Epitaph Charged Shot / Burst case measured 3.031 s median / 3.077 s max-of-five. Compared with the preceding corpus checkpoint, the slowest case median fell from 4.546 to 3.033 s and the slowest max-of-five observation fell from 5.298 to 3.234 s. This is a five-run Windows x64 Node 22.16.0 sample, not a population tail or packaged, cold-start, mobile, or cross-device measurement. It confirms performance and stable output on these 34 cases; it does not establish full-catalog or global optimality.

## Heat crowd-control disclosure correction (2026-11-13)

The Heat tooltip now describes enemy-dependent panic duration (about four seconds for humanoids, three for most Infested, and two for MOAs/Chargers), CC immunity for Ospreys, bosses, Tenno, and enemies with active Overguard, and the panic triggered when Overguard breaks. It also states that this target-dependent utility is not included in the optimizer's damage score. Sources: [Heat Damage](https://wiki.warframe.com/w/Damage/Heat_Damage), [Damage Types](https://wiki.warframe.com/w/Damage_Types). No crowd-control utility model was added.

## Laetum Incarnon path-search audit (2026-11-13)

`npm run audit:incarnon-path-search` runs a reproducible 81-path Laetum / Normal Attack / Expected TTK comparison. The fixed pool has Barrel Diffusion, Frostbite, Hornet Strike, and Pistol Pestilence; compatible Arcane candidates are Secondary Deadhead and Secondary Merciless. The custom Grineer target has 83,818 Health, 2,700 Armor, no Shields, and no Overguard. Every run is limited to three mod slots and three Forma.

The full path sweep took 8.38 ms after the baseline run; the first no-evolution optimization took 108.24 ms. The best full-sweep path used Pistol Pestilence R3, Frostbite R3, and Hornet Strike R10, with no Arcane and no Forma. It modeled 6.3333 seconds Expected TTK. The two-path refinement shortlist selected that same winner and a structurally different runner-up; its winning TTK and score gap to the exhaustive 81-path result were both zero. The no-evolution baseline used Secondary Merciless R5 and modeled 54.7077 seconds. This fixture shows that the current bounded shortlist finds the exhaustive winner for one candidate pool; it does not validate the source damage model independently or establish full-catalog optimality.

Release checks after the implementation pass: `npm test` passes 583 tests across 49 files; production build, source validation, planner-focused ESLint, and CRLF-aware diff checks pass. The catalog-independent production optimizer Worker is 91,326 bytes. Port-80 in-app-browser QA selected Devouring Attrition, verified the expected-value disclosure and legal 30/30 result, and showed a 0.15 s modeled Expected TTK against the Balanced synthetic target. The fixed-pool 81-path audit remains separate from broader catalog, global-optimality, stochastic-history, and device-latency evidence.

## Overwhelming Attrition finite-ramp browser fixture (2026-11-13)

Port-80 QA selected Laetum Incarnon Form, Evolution V Overwhelming Attrition, Realistic conditional state, and Expected TTK. The selected build used Pistol Pestilence R3, Frostbite R3, Accelerated Isotope R3, Magnetic Might R3, and Spry Sights R3 in an uncatalyzed 30/30 setup. The full math trace reported 22.0% crit, 48.4% status, one projectile per attack group, and a 40.248% chance that the whole group qualified. The finite encounter started at zero stacks and reached modeled Expected TTK in 0.75 seconds / 8 expected attacks against the Balanced synthetic pools (21,000 total); the steady-state DPS estimate continued to show its separate three-stack average. This UI observation is a single scenario and does not measure a repeatable browser p95 or a device population.

Current release checks: `npm test` passes 588 tests across 49 files; `npm run build`, `npm run validate:sources`, focused planner ESLint, and `git -c core.whitespace=cr-at-eol diff --check` pass. The catalog-independent optimizer Worker is 97,784 bytes. The current UI encounter is mean-field and does not simulate random crit/status streaks; no equivalent selected-Overwhelming-Attrition Underframe result was available for a matched comparison.

## Pairwise Expected TTK refinement and 14-case refresh (2026-11-14)

A fully stacked Braton Prime / Grineer comparison exposed a local-search trap in the Expected TTK path. Under the same finite evaluator, target pools (83,818 Health / 2,700 Armor / no Shields or Overguard), Primary Overcharge assumption (1,000 Max Energy at 100%), and three-Forma cap, the prior single-mod refinement returned 0.895 s. A legal two-mod change from its own candidate neighborhood modeled 0.670 s, showing that neither swap improved the starting list alone. The new refinement keeps distinct mod-effect families in the single-mod shortlist, then, only when that shortlist stalls, screens legal two-mod replacements from a 12-mod family-diverse pool and finite-scores up to 24 proxy-ranked pair candidates. Capacity, Forma, duplicate-mod, and incompatibility constraints still apply.

The revised optimizer returned a legal 59/60 three-Forma Braton build at 0.6561 s. The captured Underframe list modeled 0.7691 s under the same expected evaluator; this is a 14.7% lower modeled TTK. A controlled no-pair ablation returned 0.6696 s, supporting that the pair step accounts for the improvement on this fixture. This is one candidate pool and shared-model comparison, not a random-time Underframe parity claim or a proof of global optimality.

The full five-run Expected TTK corpus covered 14 weapon/attack cases (70 optimizations). Every returned build fit capacity and stayed within three Forma. The table reports each median and maximum-of-five observation; the latter is sometimes called the corpus's coarse “p95 observation” in the benchmark harness, but five runs are not enough to estimate a population p95.

| Weapon / attack | Median | Maximum of five |
|---|---:|---:|
| Perigale Prime / Normal Attack | 3.936 s | 4.510 s |
| Braton Prime / Normal Attack | 4.118 s | 4.201 s |
| Cedo / Glaive Radial Attack | 3.332 s | 3.740 s |
| Phantasma Prime / Plasma Bomb Explosion | 3.660 s | 3.751 s |
| Laetum / Incarnon Auto Radial Attack | 4.291 s | 4.470 s |
| Cinta / Perfect Shot | 4.382 s | 4.406 s |
| Kuva Hek / Quadruple Tap | 2.786 s | 2.835 s |
| Torid / Incarnon Form | 3.546 s | 3.904 s |
| Broken War / Normal Attack | 3.106 s | 3.152 s |
| Corvas Prime / Charged Shot | 1.176 s | 1.245 s |
| Verglas Prime / Normal Attack | 4.483 s | 4.643 s |
| Epitaph / Charged Shot | 4.455 s | 4.613 s |
| Nataruk / Perfect Shot | 3.267 s | 3.302 s |
| Gram Prime / Heavy Slam Attack | 4.227 s | 4.266 s |

All 14 maximum observations were below five seconds on this desktop Node run, though several are close to the target. This does not measure cold app startup, a production Worker, mobile, or cross-device latency. The fixed Braton quality fixture also remains separate from broad objective-equivalent Underframe coverage.

Release checks after the change: `npm test` passes 588 tests across 49 files; the TypeScript and production Vite build, `npm run validate:sources`, focused ESLint for `buildOptimizerCore.ts` and its regression file, and CRLF-aware diff check pass. The production optimizer Worker is 102,287 bytes. Vite continues to report the existing large lazy chunks.

## Deployed production-browser follow-up (2026-11-14)

After PR #25 merged as `277ffc3`, a fresh cache-busted tab loaded the deployed `version=277ffc3` app in the Codex in-app browser. One Braton Prime / Expected TTK run at MR 0, uncatalyzed, and the Balanced synthetic target returned the same legal four-mod 30/30 build shown by the earlier dev-browser check. The selected-model explanation reported 4.21 s / 64 attacks against the 21,000-point synthetic pools and disclosed the bounded one- and two-mod search. Click-to-result through accessibility-state polling measured 1,265 ms. This is a single end-to-end production-browser observation; it includes UI and accessibility polling, and is not a pure Worker timing or a population p95. The temporary build was reset, and the clean live planner tab was left available for manual testing.

The walkthrough also found that Spring-Loaded Chamber improved the modeled Expected TTK score by 39.4%, but its leave-one-out explanation said “Effect not summarized by the active model.” The optimizer did include its conditional fire-rate effect; only the explanation formatter omitted conditional stats. The follow-up now reports the trigger, duration, aiming/status requirements, stack cap, and supported conditional stats, with a Braton regression. This correction improves explanation accuracy but does not change candidate scoring or build selection.

Port-80 in-app-browser QA then optimized the same uncatalyzed Braton Prime and opened Why This Build. The selected four-mod build remained at 30/30; the Spring-Loaded Chamber row now reads `on reload (9s, while aiming): +75% fr` and retains its +39.4% leave-one-out contribution. The click-to-result observation was 1,226 ms including accessibility polling. The local test build was reset afterward. This confirms the local dev Worker/UI path; it does not substitute for a deployed follow-up after the explanation patch is merged.

## Parser coverage and four-pass Expected TTK refresh (2026-11-14)

Command: `node --import tsx/esm scripts/benchmarkBuildOptimizer.ts --runs=5`

The five-run Node corpus covered 34 cases (170 optimizer results) after the finite Expected TTK refinement budget increased to four passes of up to 24 legal one-mod replacements, with the bounded pairwise fallback retained. Every returned build passed capacity, duplicate-name, incompatibility-group, and three-Forma checks. Per-case medians ranged from 1.476 to 5.037 seconds; the maximum-of-five observations ranged from 1.526 to 5.256 seconds. These five-run maxima are coarse observations, not population p95 estimates.

| Weapon / attack | Goal | Median | Maximum of five | Forma | Legal |
|---|---|---:|---:|---:|---|
| Braton Prime / Normal Attack | Burst | 4.103 s | 4.232 s | 3 | Yes |
| Cedo / Normal Attack | Burst | 3.615 s | 3.647 s | 3 | Yes |
| Cedo / Glaive Radial Attack | Burst | 4.071 s | 4.187 s | 3 | Yes |
| Phantasma Prime / Plasma Bomb Explosion | Burst | 3.190 s | 3.510 s | 2 | Yes |
| Laetum / Normal Attack | Burst | 4.214 s | 4.349 s | 3 | Yes |
| Cinta / Normal Attack | Burst | 3.740 s | 3.878 s | 3 | Yes |
| Kuva Hek / Normal Attack | Scaling | 3.193 s | 3.491 s | 2 | Yes |
| Torid / base mode | Scaling | 4.145 s | 4.453 s | 3 | Yes |
| Broken War / Normal Attack | Burst | 3.829 s | 4.200 s | 3 | Yes |
| Corvas Prime / Normal Attack | Burst | 1.642 s | 1.691 s | 3 | Yes |
| Verglas Prime / Normal Attack | Burst | 3.558 s | 3.745 s | 3 | Yes |
| Phantasma Prime / Beam | Scaling | 3.552 s | 3.746 s | 3 | Yes |
| Rubico Prime / Normal Attack | Burst | 3.629 s | 3.658 s | 3 | Yes |
| Perigale Prime / Normal Attack | Expected TTK | 3.736 s | 3.880 s | 2 | Yes |
| Epitaph / Charged Shot | Burst | 5.037 s | 5.256 s | 3 | Yes |
| Acrid / Normal Attack | Scaling | 3.622 s | 3.720 s | 3 | Yes |
| Hystrix Prime / Fire Quill | Scaling | 4.005 s | 4.396 s | 2 | Yes |
| Nukor / Normal Attack | Burst | 4.551 s | 4.672 s | 3 | Yes |
| Nataruk / Perfect Shot | Burst | 3.395 s | 3.912 s | 1 | Yes |
| Gram Prime / Heavy Slam Attack | Burst | 3.388 s | 3.417 s | 3 | Yes |
| Braton Prime / Normal Attack, Primary Overcharge at 100% energy | Burst | 3.969 s | 4.227 s | 3 | Yes |
| Braton Prime / Normal Attack | Expected TTK | 3.495 s | 3.633 s | 3 | Yes |
| Cedo / Glaive Radial Attack | Expected TTK | 3.462 s | 3.810 s | 3 | Yes |
| Phantasma Prime / Plasma Bomb Explosion | Expected TTK | 3.067 s | 3.408 s | 3 | Yes |
| Laetum / Normal Attack | Expected TTK | 4.257 s | 4.280 s | 3 | Yes |
| Cinta / Normal Attack | Expected TTK | 3.546 s | 3.722 s | 3 | Yes |
| Kuva Hek / Normal Attack | Expected TTK | 1.794 s | 2.216 s | 1 | Yes |
| Torid / base mode | Expected TTK | 3.448 s | 3.550 s | 3 | Yes |
| Broken War / Normal Attack | Expected TTK | 2.037 s | 2.204 s | 2 | Yes |
| Corvas Prime / Normal Attack | Expected TTK | 1.476 s | 1.526 s | 3 | Yes |
| Verglas Prime / Normal Attack | Expected TTK | 2.893 s | 3.373 s | 3 | Yes |
| Epitaph / Charged Shot | Expected TTK | 2.950 s | 3.401 s | 3 | Yes |
| Nataruk / Perfect Shot | Expected TTK | 2.481 s | 2.844 s | 2 | Yes |
| Gram Prime / Heavy Slam Attack | Expected TTK | 2.643 s | 2.769 s | 3 | Yes |

Epitaph Charged Shot / Burst is the performance exception. An isolated five-run repeat measured 5.004 s median / 5.938 s maximum; disabling Arcane optimization measured 4.941 / 5.636 s, so Arcane candidate evaluation does not explain the cost. A single-run CPU profile samples repeated `calculateBuild` calls and scoring as the main optimizer hot path. The four-pass increase is limited to Expected TTK; the Epitaph burst case is still slower than the five-second target and remains open for profiling and improvement.

The catalog-coverage audit checked 694 weapons and 598 unique builder-eligible mod records: 466 have a parsed damage/performance effect, 132 have no parsed effect at maximum rank, and 90 records have unmatched lines conservatively flagged for review (17 partially parsed, 73 fully unparsed). The keyword screen includes utility false positives; this is a review list, not 90 confirmed missing damage models. Affected ranks stay manually selectable with an explanation and are omitted from auto-optimization until their combat effects are modeled.

The production optimizer Worker is 104,038 bytes after moving the review helper out of the catalog's runtime module. This prevents the catalog JSON from being duplicated inside the Worker. Release checks pass at 595 tests / 49 files, TypeScript and production build, `npm run validate:sources`, focused ESLint, and CRLF-aware diff checking. The production Worker remains unmeasured for cold-start and mobile devices.

## Seismic Wave slam-damage and trace follow-up (2026-11-14)

The current Seismic Wave reference (https://wiki.warframe.com/w/Seismic_Wave) lists rank bonuses of +50%, +100%, +150%, and +200% Slam Attack Damage, multiplicative with ordinary melee damage bonuses; it also says the mod affects stance-combo slams. The Melee reference (https://wiki.warframe.com/w/Melee) distinguishes the Slam Damage multiplier from the Update 35 aerial ground-slam rewrite. The calculator now parses the four ranks and applies the Slam Damage multiplier to catalog rows named Slam Attack, Heavy Slam Attack, and stance-combo slam attacks. Normal melee attacks do not receive it.

The calculator trace now uses the same selected-attack multiplier as damage calculation when it shows the quantization base. It includes the Slam Damage multiplier and, where applicable, the heavy-attack combo multiplier; this fixes the previous explanation where scaled damage was divided by a scale based on unscaled damage.

Port-80 Codex in-app-browser QA selected Gram Prime / Slam Attack, equipped max-rank Seismic Wave, and observed modeled damage increase from 600 to 1,800. The trace showed a ×3 Slam Damage multiplier, a quantization base of 1,800, a scale of 56.25, and a final quantized result of 1,800. Reset restored the zero-mod Normal Attack planner.

Current Korumm notes (https://wiki.warframe.com/w/Korumm) confirm that its Tactical Combo Slam hit benefits from Seismic Wave. A calculator regression covers that multiplier, but the full Korumm multi-hit combo, its forced effects, and its restrictions on other mods and conditional effects are not represented. Other stance-combo rows are treated as selected single attacks; Slam radius, falloff, geometry, Nira's Set, Riven Slam Damage, and weapon-specific Slam effects remain unsupported.

Release gates pass: 604 tests across 49 files, TypeScript plus production Vite build, source validation, focused planner ESLint, and the mod-effect coverage audit. The catalog-independent production Worker is 106,165 bytes. The audit covers 694 weapons and 598 eligible mod records; 86 records remain conservatively flagged for review (17 partial and 69 fully unparsed), including utility false positives. Vite still reports existing large lazy chunks. This change does not close global/joint optimizer optimality, broad objective-equivalent Underframe coverage, stochastic history modeling, the Epitaph Burst latency exception, or cold/mobile/cross-device Worker measurements.



## Epitaph Burst shared scoring cache (2026-11-14)

A bounded per-optimization cache now reuses exact proxy scores from the final beam states during the initial single-mod and combo refinement passes. It keeps the score function, candidate neighborhood, and capacity checks unchanged. The cache is shared only while those inputs remain fixed; later finite Expected TTK and Arcane-refinement stages keep their own scoring paths.

Five cache-on runs and five cache-off runs returned the identical legal Epitaph Charged Shot build: Lethal Torrent R5, Primed Target Cracker R10, Pathogen Rounds R5, Pistol Pestilence R3, Hornet Strike R10, Barrel Diffusion R5, Primed Expel Corpus R10, and Creeping Bullseye R5. It scored 241,624.7363 at 60/60 capacity with three Forma in both batches. Cache-on measured 5.140 s median and 5.809 s maximum; cache-off measured 5.558 s median and 5.930 s maximum. This five-run result shows a small improvement but remains above the 5 s latency target and does not establish a stable p95 gain.

The port-80 in-app browser returned a legal four-mod 28/30 build, but the browser click-to-result interval was not captured reliably. Node measurements still do not cover production-browser cold starts, mobile devices, or cross-device performance. The Epitaph case remains an open latency exception.

## Full desktop Node benchmark refresh after the shared-score cache (2026-11-14)

Command: `node --import tsx/esm scripts/benchmarkBuildOptimizer.ts --runs=5`

The 36-case corpus covered 180 optimizations. Every case returned a capacity-legal result within the three-Forma limit. Per-case medians ranged from 0.653 to 3.350 seconds; maximum-of-five observations ranged from 0.668 to 3.440 seconds. Five runs provide a coarse maximum, not a statistically reliable population p95.

| Case | Median | Maximum of five |
|---|---:|---:|
| Corvas Prime / Normal Attack / Expected TTK | 0.653 s | 0.668 s |
| Epitaph / Charged Shot / Burst | 3.350 s | 3.440 s |

Three additional isolated five-run Epitaph Charged Shot / Burst batches returned the same legal build and score (241,624.7363): 3.068 s median / 3.499 s maximum; 3.013 s / 3.321 s; and 3.189 s / 3.493 s. This does not reproduce the earlier cache-on 5.140 s / 5.809 s sample. Treat the older timing as workload-sensitive; the samples do not establish that the cache alone explains the difference.

The 36-case corpus ran before the narrow Prototype Shock Coils parser addition; that weapon-specific change does not affect these cases. The production Worker after that addition is 106,820 bytes. This Node benchmark does not measure production-browser cold start, mobile devices, or cross-device latency.

Warning: truncated output (original token count: 42508)
Total output lines: 1293

Epitaph Charged Shot / Burst returned the same eight-mod list and score (241,624.7363) in all five runs, with 3.204 s median and 3.241 s maximum. This current-source result removes the earlier five-second exception in this Node sample. It does not measure the packaged Worker, cold startup, mobile/cross-device latency, custom target profiles, or global build quality. A bounded benchmark corpus cannot prove full-catalog optimality; broad objective-equivalent Underframe comparisons, weapon/status coverage, and exhaustive oracles remain open. The production optimizer Worker built for this release is 107,171 bytes; the existing Vite large-chunk warning remains.
# Build Planner Optimizer Benchmark

Run date: 2026-11-14; current full-width refresh: 2026-11-13
Command: `npm run benchmark:build-planner` (the harness defaults to five runs)
Environment: Windows x64, Node.js v22.16.0, 28 logical CPUs. This invokes the optimizer core directly in Node. It does not measure a production browser Worker.

## Expected TTK refinement coverage and production baseline (2026-11-14)

The single-replacement Expected TTK shortlist now reserves an exact finite-encounter evaluation for each available effect family before taking a second candidate from any family. The cap increased from 24 to 40 to preserve elemental, tempo, critical, multishot, faction, status, and base-damage alternatives in the same pass. This remains a bounded heuristic; family labels choose which candidates receive the exact evaluator and do not guarantee a global optimum.

This change corrected a reproducible Braton Prime quality miss. Under the same fully stacked state, level-100 Grineer pools (83,818 Health / 2,700 Armor), rank-5 Primary Overcharge cap (350% multishot), and three-Forma limit, the prior optimizer list modeled 0.65613 s Expected TTK. A legal one-mod replacement, Bladed Rounds → Vile Acceleration, modeled 0.59085 s and was previously missed by the exact-evaluation shortlist. After balanced family coverage, the optimizer returns the 0.59085 s list directly. The captured Underframe Auto Build list models 0.76915 s under Tenno-Hub's same finite model; both displayed lists can be assigned legally at 59/60 capacity and three Forma. Tenno-Hub is 23.2% faster on this common expected model, not a claim about Underframe's native stochastic simulator. A bounded 1–4-mod substitution audit over the Underframe-only mods found no legal candidate faster than 0.59085 s. This remains one target/build fixture and a small competitor-neighborhood comparison.

Follow-up against the deployed 396107c code found that the family loop could spend a second candidate on early families before reaching tempo candidates. The shortlist now makes a first pass across all families before any second pass. On the fixture above this preserves Vile Acceleration in the exact-refinement set and returns the 0.59085 s build. The regression requires that mod and a result under 0.60 s. This changes ordering within a bounded shortlist; it does not prove the full candidate space optimal.

After the shortlist change, the 14-case Expected TTK corpus ran five times per case (70 optimizations). All results were deterministic and legal within three Forma. Medians ranged from 1.445 to 4.173 s; maximum-of-five observations ranged from 1.465 to 4.199 s. These maxima are coarse observations from five runs, not statistically robust population p95 estimates.

| Weapon / selected attack | Median | Max-of-five | Expected TTK | Forma | Legal |
|---|---:|---:|---:|---:|---|
| Perigale Prime / Normal Attack | 3.813 s | 3.942 s | 0.144 s | 3 | Yes |
| Braton Prime / Normal Attack | 3.595 s | 3.686 s | 1.593 s | 3 | Yes |
| Cedo / Glaive Radial Attack | 3.726 s | 3.855 s | 5.105 s | 3 | Yes |
| Phantasma Prime / Plasma Bomb Explosion | 3.265 s | 3.555 s | 2.490 s | 3 | Yes |
| Laetum / Normal Attack | 4.173 s | 4.199 s | 0.138 s | 3 | Yes |
| Cinta / Normal Attack | 3.536 s | 3.677 s | 1.059 s | 3 | Yes |
| Kuva Hek / Normal Attack | 2.950 s | 3.369 s | 0.200 s | 1 | Yes |
| Torid / Normal Attack | 3.323 s | 3.491 s | 1.333 s | 3 | Yes |
| Broken War / Normal Attack | 2.358 s | 2.555 s | 4.000 s | 2 | Yes |
| Corvas Prime / Normal Attack | 1.445 s | 1.465 s | 0.000 s | 3 | Yes |
| Verglas Prime / Normal Attack | 3.384 s | 3.506 s | 1.316 s | 3 | Yes |
| Epitaph / Charged Shot | 3.252 s | 3.303 s | 0.000 s | 3 | Yes |
| Nataruk / Perfect Shot | 2.511 s | 2.857 s | 0.000 s | 2 | Yes |
| Gram Prime / Heavy Slam Attack | 2.702 s | 2.731 s | 1.613 s | 3 | Yes |

As a separate production baseline at merge `396107c`, four warmed, blank-start Epitaph / Charged Shot runs at MR 0 with no Catalyst completed at 767, 789, 801, and 830 ms (795 ms median). Each returned the same legal four-mod 28/30 build. This is a narrow UI-to-result sample from the earlier shortlist version; it is neither a production measurement of the new 40-candidate refinement nor comparable to the MR 30 Node corpus above.

## Production UI and Incarnon path-search audit (2026-11-14)

The production app at merge commit `07e75a6` was exercised in the Codex in-app browser after deployment. Braton Prime / Normal Attack / Expected TTK used the uncatalyzed MR 0 setup, blank starting mod slots, and the Balanced synthetic target. Fifteen warmed optimize/reset runs completed. The observed result was a legal four-mod 30/30 build. Measured click-to-"Optimize Build"-enabled observations were 1,110, 921, 1,109, 1,063, 1,109, 920, 1,064, 950, 1,109, 1,032, 1,025, 1,041, 1,079, 942, and 952 ms (1,041 ms median; 1,110 ms maximum observation). Timing includes browser action and accessibility-state polling, so it is a UI-to-result observation, not a pure Worker duration or population p95. The production tab used for this measurement was temporary; the separate live manual-testing tab remained blank.

The reproducible `npx tsx scripts/auditIncarnonPathSearch.ts --weapon=...` audit now compares the current-path baseline as well as every evolved path. For Laetum Normal Attack, it compared 81 evolution paths plus the baseline with four max-rank mod candidates, three slots, two compatible Arcane families, and the Grineer 83,818 Health / 2,700 Armor target. The two-path shortlist found the same 6.3333 s Expected TTK winner as the full sweep (zero measured gap); the candidate-pool winner used zero Forma. The full 81-path optimizer sweep took 7.440 s on this Node run. For Torid Incarnon Form, the 18 evolution paths plus baseline used four max-rank mod candidates, three slots, two Arcane families, and the same target. Both searches retained the unevolved baseline at 217.6 s, with zero gap; the full 18-path sweep took 7.803 s. These checks measure shortlist quality only within these fixed candidate pools and target assumptions; they do not establish full-catalog mod-rank, path, Arcane, or global optimality. The multi-path full sweeps also exceed the five-second target, supporting the current bounded-refinement tradeoff.

The latest release gates pass at 588 tests across 49 files; `npm run build`, `npm run validate:sources`, focused planner ESLint, and CRLF-aware diff checking pass. The production optimizer Worker is 97,784 bytes. Vite retains its existing large lazy-chunk warning. Production cold-start, physical mobile-device, cross-device, and population-tail latency remain unmeasured.

## HiGHS runtime prototype and deployed production UI sample (2026-11-14)

The `highs@1.15.4` WebAssembly package was installed in a disposable temporary folder, without changing project dependencies. A 12-binary-variable additive surrogate enforced a four-slot count, capacity, and exclusivity groups. HiGHS reported an optimal objective of 799, equal to exhaustive enumeration of all 4,096 subsets. Solver initialization took 18.0 ms; the first solve took 53.5 ms and four warm solves had a 5.36 ms median. The ESM loader plus WASM measured 3,699,489 bytes raw / 1,258,610 bytes gzip. This prototype tests the binding and linear constraints only: it does not score real weapon damage or compare build quality. No solver dependency was added to the app.

The deployed production page at commit `f62362f` was also exercised in a real browser. Five warmed Braton Prime / Expected TTK optimizations at MR 0, uncatalyzed, and the Balanced synthetic target returned one legal 30/30 four-mod build with 4.21 s modeled TTK. Click-to-result times were 519, 417, 422, 415, and 420 ms (420 ms median, 519 ms maximum). Reset and reload restored the blank planner. This is a single desktop/browser UI measurement, not cold app startup, mobile latency, or a statistically robust tail estimate.

Release checks for this follow-up: `npm test` passes 577 tests across 49 files; `npm run build`, `npm run validate:sources`, planner ESLint, and CRLF-aware diff checking pass. The production optimizer Worker is 90,717 bytes.

## Joint Expected TTK quality oracle (2026-11-14)

The bounded exhaustive Expected TTK oracle now jointly searches legal mod sets and every rank of two compatible Arcanes across five attack profiles: Perigale Prime burst, Cedo glaive radial, Phantasma Prime charged explosion, Acrid forced-Toxin secondary, and Gram Prime heavy slam. Each case searches up to three max-rank mods drawn from four candidates, with actual slot capacity and ordered evaluation. The optimizer matches both the finite TTK and DPS values of the exhaustive winner in all five pools. A separate Braton Prime test includes Primary Bulwark and energy-gated Primary Overcharge. These exact results apply only to the stated small candidate sets; they do not validate evaluator assumptions independently or establish full-catalog/global optimality.

## Joint Arcane refinement full-width refresh (2026-11-13)

Command: `npx tsx scripts/benchmarkBuildOptimizer.ts --runs=5`

Five repetitions were run for each of 34 cases (170 optimizations) after Arcane/mod refinement was made iterative. The corpus spans Burst and Scaling proxy objectives, 13 Expected TTK cases, and Primary Overcharge with energy inputs. All 170 results were capacity-, uniqueness-, incompatibility-, and three-Forma-legal. Per-case medians ranged from 0.551 to 3.633 seconds; max-of-five p95 observations ranged from 0.641 to 3.855 seconds. Each p95 is the maximum of five observations, not a statistically stable tail estimate.

| Weapon / selected attack | Goal | Median | Max-of-five p95 | Forma | Legal |
|---|---|---:|---:|---:|---|
| Braton Prime | Burst | 2.830 s | 2.929 s | 3 | Yes |
| Cedo | Burst | 2.312 s | 2.457 s | 3 | Yes |
| Cedo / Glaive Radial Attack | Burst | 2.710 s | 2.813 s | 3 | Yes |
| Phantasma Prime / Plasma Bomb Explosion | Burst | 2.311 s | 2.466 s | 2 | Yes |
| Laetum | Burst | 2.956 s | 3.089 s | 3 | Yes |
| Cinta | Burst | 2.533 s | 2.665 s | 3 | Yes |
| Kuva Hek | Scaling | 2.229 s | 2.300 s | 2 | Yes |
| Torid | Scaling | 3.223 s | 3.338 s | 3 | Yes |
| Broken War | Burst | 2.729 s | 2.920 s | 3 | Yes |
| Corvas Prime | Burst | 1.101 s | 1.129 s | 3 | Yes |
| Verglas Prime | Burst | 2.624 s | 2.653 s | 3 | Yes |
| Phantasma Prime / Beam | Scaling | 2.390 s | 2.528 s | 3 | Yes |
| Rubico Prime | Burst | 2.431 s | 2.578 s | 3 | Yes |
| Perigale Prime | Burst | 1.968 s | 1.993 s | 3 | Yes |
| Epitaph / Charged Shot | Burst | 3.633 s | 3.855 s | 3 | Yes |
| Acrid | Scaling | 2.604 s | 2.657 s | 3 | Yes |
| Hystrix Prime / Fire Quill | Scaling | 2.940 s | 3.030 s | 2 | Yes |
| Nukor | Burst | 3.180 s | 3.453 s | 3 | Yes |
| Nataruk / Perfect Shot | Burst | 2.624 s | 2.703 s | 1 | Yes |
| Gram Prime / Heavy Slam Attack | Burst | 2.281 s | 2.352 s | 3 | Yes |
| Braton Prime / Primary Overcharge at 1,000 Max Energy, 100% Energy | Burst | 2.915 s | 3.157 s | 3 | Yes |
| Braton Prime | Expected TTK | 1.993 s | 2.073 s | 3 | Yes |
| Cedo / Glaive Radial Attack | Expected TTK | 1.768 s | 1.820 s | 2 | Yes |
| Phantasma Prime / Plasma Bomb Explosion | Expected TTK | 1.861 s | 1.925 s | 3 | Yes |
| Laetum | Expected TTK | 2.061 s | 2.144 s | 2 | Yes |
| Cinta | Expected TTK | 2.027 s | 2.180 s | 3 | Yes |
| Kuva Hek | Expected TTK | 1.097 s | 1.200 s | 1 | Yes |
| Torid | Expected TTK | 1.883 s | 1.936 s | 3 | Yes |
| Broken War | Expected TTK | 1.304 s | 1.379 s | 2 | Yes |
| Corvas Prime | Expected TTK | 0.551 s | 0.641 s | 3 | Yes |
| Verglas Prime | Expected TTK | 2.088 s | 2.104 s | 3 | Yes |
| Epitaph / Charged Shot | Expected TTK | 2.230 s | 2.285 s | 3 | Yes |
| Nataruk / Perfect Shot | Expected TTK | 1.416 s | 1.514 s | 1 | Yes |
| Gram Prime / Heavy Slam Attack | Expected TTK | 1.653 s | 1.711 s | 3 | Yes |

A separate `--runs=1 --verify-arcane-selection` pass audited each returned fixed mod list against the supplied Arcane ranks. All 34 cases selected a best Arcane for the final returned list, with zero measured gap. This is conditional-on-build evidence, not proof of joint or global mod/Arcane optimality. The production build emits a 90,717-byte catalog-independent optimizer Worker; Vite continues to report existing large lazy chunks. Packaged Worker, cold-start, mobile, and cross-device latency remain unmeasured.

## Expected TTK objective, targeted Braton Prime run (2026-11-12)

Command: `npx tsx scripts/benchmarkBuildOptimizer.ts --weapon=Braton Prime --runs=5 --goal=timeToKill`

The Expected TTK objective screens builds with the fast sustained proxy, then applies up to two bounded passes of finite-encounter one-mod replacement ranking. The isolated five-run Braton refresh returned the same legal 60/60 build, three Forma, Primary Merciless R5, and 1.5932 s expected TTK at 15,691.38 expected encounter damage/s. It evaluated 61 encounter candidates on each run. The proxy score (39,301.33) remains separately reported and is not used as the final finite-kill ranking. Optimizer time was 3.006 s median and 3.219 s max-of-five p95; observations ranged from 2.883 to 3.219 s.

The target uses the Grineer faction preset, MR 30, max-rank mods, Catalyst, Exilus and Arcane optimization, Initial conditional state, and a three-Forma cap. Port-80 QA saved a named temporary Expected TTK build, reloaded the page, loaded the save, and verified that its objective and target explanation restored; the temporary save was then removed and the planner returned to its empty state. A separate uncatalyzed MR 0 Braton run on the Balanced synthetic target completed five port-80 dev-Worker clicks in 497–622 ms (504 ms median; 622 ms max-of-five p95), with the same legal 30/30 four-mod build and 4.21 s finite TTK. This is one desktop Node scenario plus a warmed dev-server browser scenario; neither establishes global optimality or broad objective parity with Underframe. It also does not measure production-packaged Worker, cold-start, or mobile latency. Use `--weapon=Braton Prime --goal=timeToKill` to isolate the Node case and `--runs=N` to change repetitions.

## Expected TTK 13-case weapon/attack refresh (2026-11-12)

Command: `npx tsx scripts/benchmarkBuildOptimizer.ts --runs=5 --goal=timeToKill`

All cases used MR 30, max-rank mods, Catalyst, Exilus and Arcane optimization, Initial conditional state, and up to three Forma. Targets used the script's Grineer or Corpus faction presets, without a custom target profile. Each row returned the same build in all five runs, and every build passed capacity, incompatibility, unique-mod, and Forma-limit checks. Timings are optimizer-core Node measurements; they do not represent a browser Worker or device-independent performance.

| Weapon / selected attack | Median | Max-of-five p95 | Expected TTK | Forma | Legal |
|---|---:|---:|---:|---:|---|
| Braton Prime | 3.254 s | 3.580 s | 1.593 s | 3 | Yes |
| Cedo / Glaive Radial Attack | 2.921 s | 3.104 s | 6.842 s | 2 | Yes |
| Phantasma Prime / Plasma Bomb Explosion | 2.772 s | 2.857 s | 2.490 s | 3 | Yes |
| Laetum | 3.357 s | 3.515 s | 0.160 s | 2 | Yes |
| Cinta | 2.766 s | 2.884 s | 1.059 s | 3 | Yes |
| Kuva Hek | 2.358 s | 2.489 s | 0.288 s | 1 | Yes |
| Torid | 3.664 s | 3.786 s | 1.000 s…34508 tokens truncated…ferent runner-up; its winning TTK and score gap to the exhaustive 81-path result were both zero. The no-evolution baseline used Secondary Merciless R5 and modeled 54.7077 seconds. This fixture shows that the current bounded shortlist finds the exhaustive winner for one candidate pool; it does not validate the source damage model independently or establish full-catalog optimality.

Release checks after the implementation pass: `npm test` passes 583 tests across 49 files; production build, source validation, planner-focused ESLint, and CRLF-aware diff checks pass. The catalog-independent production optimizer Worker is 91,326 bytes. Port-80 in-app-browser QA selected Devouring Attrition, verified the expected-value disclosure and legal 30/30 result, and showed a 0.15 s modeled Expected TTK against the Balanced synthetic target. The fixed-pool 81-path audit remains separate from broader catalog, global-optimality, stochastic-history, and device-latency evidence.

## Overwhelming Attrition finite-ramp browser fixture (2026-11-13)

Port-80 QA selected Laetum Incarnon Form, Evolution V Overwhelming Attrition, Realistic conditional state, and Expected TTK. The selected build used Pistol Pestilence R3, Frostbite R3, Accelerated Isotope R3, Magnetic Might R3, and Spry Sights R3 in an uncatalyzed 30/30 setup. The full math trace reported 22.0% crit, 48.4% status, one projectile per attack group, and a 40.248% chance that the whole group qualified. The finite encounter started at zero stacks and reached modeled Expected TTK in 0.75 seconds / 8 expected attacks against the Balanced synthetic pools (21,000 total); the steady-state DPS estimate continued to show its separate three-stack average. This UI observation is a single scenario and does not measure a repeatable browser p95 or a device population.

Current release checks: `npm test` passes 588 tests across 49 files; `npm run build`, `npm run validate:sources`, focused planner ESLint, and `git -c core.whitespace=cr-at-eol diff --check` pass. The catalog-independent optimizer Worker is 97,784 bytes. The current UI encounter is mean-field and does not simulate random crit/status streaks; no equivalent selected-Overwhelming-Attrition Underframe result was available for a matched comparison.

## Pairwise Expected TTK refinement and 14-case refresh (2026-11-14)

A fully stacked Braton Prime / Grineer comparison exposed a local-search trap in the Expected TTK path. Under the same finite evaluator, target pools (83,818 Health / 2,700 Armor / no Shields or Overguard), Primary Overcharge assumption (1,000 Max Energy at 100%), and three-Forma cap, the prior single-mod refinement returned 0.895 s. A legal two-mod change from its own candidate neighborhood modeled 0.670 s, showing that neither swap improved the starting list alone. The new refinement keeps distinct mod-effect families in the single-mod shortlist, then, only when that shortlist stalls, screens legal two-mod replacements from a 12-mod family-diverse pool and finite-scores up to 24 proxy-ranked pair candidates. Capacity, Forma, duplicate-mod, and incompatibility constraints still apply.

The revised optimizer returned a legal 59/60 three-Forma Braton build at 0.6561 s. The captured Underframe list modeled 0.7691 s under the same expected evaluator; this is a 14.7% lower modeled TTK. A controlled no-pair ablation returned 0.6696 s, supporting that the pair step accounts for the improvement on this fixture. This is one candidate pool and shared-model comparison, not a random-time Underframe parity claim or a proof of global optimality.

The full five-run Expected TTK corpus covered 14 weapon/attack cases (70 optimizations). Every returned build fit capacity and stayed within three Forma. The table reports each median and maximum-of-five observation; the latter is sometimes called the corpus's coarse “p95 observation” in the benchmark harness, but five runs are not enough to estimate a population p95.

| Weapon / attack | Median | Maximum of five |
|---|---:|---:|
| Perigale Prime / Normal Attack | 3.936 s | 4.510 s |
| Braton Prime / Normal Attack | 4.118 s | 4.201 s |
| Cedo / Glaive Radial Attack | 3.332 s | 3.740 s |
| Phantasma Prime / Plasma Bomb Explosion | 3.660 s | 3.751 s |
| Laetum / Incarnon Auto Radial Attack | 4.291 s | 4.470 s |
| Cinta / Perfect Shot | 4.382 s | 4.406 s |
| Kuva Hek / Quadruple Tap | 2.786 s | 2.835 s |
| Torid / Incarnon Form | 3.546 s | 3.904 s |
| Broken War / Normal Attack | 3.106 s | 3.152 s |
| Corvas Prime / Charged Shot | 1.176 s | 1.245 s |
| Verglas Prime / Normal Attack | 4.483 s | 4.643 s |
| Epitaph / Charged Shot | 4.455 s | 4.613 s |
| Nataruk / Perfect Shot | 3.267 s | 3.302 s |
| Gram Prime / Heavy Slam Attack | 4.227 s | 4.266 s |

All 14 maximum observations were below five seconds on this desktop Node run, though several are close to the target. This does not measure cold app startup, a production Worker, mobile, or cross-device latency. The fixed Braton quality fixture also remains separate from broad objective-equivalent Underframe coverage.

Release checks after the change: `npm test` passes 588 tests across 49 files; the TypeScript and production Vite build, `npm run validate:sources`, focused ESLint for `buildOptimizerCore.ts` and its regression file, and CRLF-aware diff check pass. The production optimizer Worker is 102,287 bytes. Vite continues to report the existing large lazy chunks.

## Deployed production-browser follow-up (2026-11-14)

After PR #25 merged as `277ffc3`, a fresh cache-busted tab loaded the deployed `version=277ffc3` app in the Codex in-app browser. One Braton Prime / Expected TTK run at MR 0, uncatalyzed, and the Balanced synthetic target returned the same legal four-mod 30/30 build shown by the earlier dev-browser check. The selected-model explanation reported 4.21 s / 64 attacks against the 21,000-point synthetic pools and disclosed the bounded one- and two-mod search. Click-to-result through accessibility-state polling measured 1,265 ms. This is a single end-to-end production-browser observation; it includes UI and accessibility polling, and is not a pure Worker timing or a population p95. The temporary build was reset, and the clean live planner tab was left available for manual testing.

The walkthrough also found that Spring-Loaded Chamber improved the modeled Expected TTK score by 39.4%, but its leave-one-out explanation said “Effect not summarized by the active model.” The optimizer did include its conditional fire-rate effect; only the explanation formatter omitted conditional stats. The follow-up now reports the trigger, duration, aiming/status requirements, stack cap, and supported conditional stats, with a Braton regression. This correction improves explanation accuracy but does not change candidate scoring or build selection.

Port-80 in-app-browser QA then optimized the same uncatalyzed Braton Prime and opened Why This Build. The selected four-mod build remained at 30/30; the Spring-Loaded Chamber row now reads `on reload (9s, while aiming): +75% fr` and retains its +39.4% leave-one-out contribution. The click-to-result observation was 1,226 ms including accessibility polling. The local test build was reset afterward. This confirms the local dev Worker/UI path; it does not substitute for a deployed follow-up after the explanation patch is merged.

## Parser coverage and four-pass Expected TTK refresh (2026-11-14)

Command: `node --import tsx/esm scripts/benchmarkBuildOptimizer.ts --runs=5`

The five-run Node corpus covered 34 cases (170 optimizer results) after the finite Expected TTK refinement budget increased to four passes of up to 24 legal one-mod replacements, with the bounded pairwise fallback retained. Every returned build passed capacity, duplicate-name, incompatibility-group, and three-Forma checks. Per-case medians ranged from 1.476 to 5.037 seconds; the maximum-of-five observations ranged from 1.526 to 5.256 seconds. These five-run maxima are coarse observations, not population p95 estimates.

| Weapon / attack | Goal | Median | Maximum of five | Forma | Legal |
|---|---|---:|---:|---:|---|
| Braton Prime / Normal Attack | Burst | 4.103 s | 4.232 s | 3 | Yes |
| Cedo / Normal Attack | Burst | 3.615 s | 3.647 s | 3 | Yes |
| Cedo / Glaive Radial Attack | Burst | 4.071 s | 4.187 s | 3 | Yes |
| Phantasma Prime / Plasma Bomb Explosion | Burst | 3.190 s | 3.510 s | 2 | Yes |
| Laetum / Normal Attack | Burst | 4.214 s | 4.349 s | 3 | Yes |
| Cinta / Normal Attack | Burst | 3.740 s | 3.878 s | 3 | Yes |
| Kuva Hek / Normal Attack | Scaling | 3.193 s | 3.491 s | 2 | Yes |
| Torid / base mode | Scaling | 4.145 s | 4.453 s | 3 | Yes |
| Broken War / Normal Attack | Burst | 3.829 s | 4.200 s | 3 | Yes |
| Corvas Prime / Normal Attack | Burst | 1.642 s | 1.691 s | 3 | Yes |
| Verglas Prime / Normal Attack | Burst | 3.558 s | 3.745 s | 3 | Yes |
| Phantasma Prime / Beam | Scaling | 3.552 s | 3.746 s | 3 | Yes |
| Rubico Prime / Normal Attack | Burst | 3.629 s | 3.658 s | 3 | Yes |
| Perigale Prime / Normal Attack | Expected TTK | 3.736 s | 3.880 s | 2 | Yes |
| Epitaph / Charged Shot | Burst | 5.037 s | 5.256 s | 3 | Yes |
| Acrid / Normal Attack | Scaling | 3.622 s | 3.720 s | 3 | Yes |
| Hystrix Prime / Fire Quill | Scaling | 4.005 s | 4.396 s | 2 | Yes |
| Nukor / Normal Attack | Burst | 4.551 s | 4.672 s | 3 | Yes |
| Nataruk / Perfect Shot | Burst | 3.395 s | 3.912 s | 1 | Yes |
| Gram Prime / Heavy Slam Attack | Burst | 3.388 s | 3.417 s | 3 | Yes |
| Braton Prime / Normal Attack, Primary Overcharge at 100% energy | Burst | 3.969 s | 4.227 s | 3 | Yes |
| Braton Prime / Normal Attack | Expected TTK | 3.495 s | 3.633 s | 3 | Yes |
| Cedo / Glaive Radial Attack | Expected TTK | 3.462 s | 3.810 s | 3 | Yes |
| Phantasma Prime / Plasma Bomb Explosion | Expected TTK | 3.067 s | 3.408 s | 3 | Yes |
| Laetum / Normal Attack | Expected TTK | 4.257 s | 4.280 s | 3 | Yes |
| Cinta / Normal Attack | Expected TTK | 3.546 s | 3.722 s | 3 | Yes |
| Kuva Hek / Normal Attack | Expected TTK | 1.794 s | 2.216 s | 1 | Yes |
| Torid / base mode | Expected TTK | 3.448 s | 3.550 s | 3 | Yes |
| Broken War / Normal Attack | Expected TTK | 2.037 s | 2.204 s | 2 | Yes |
| Corvas Prime / Normal Attack | Expected TTK | 1.476 s | 1.526 s | 3 | Yes |
| Verglas Prime / Normal Attack | Expected TTK | 2.893 s | 3.373 s | 3 | Yes |
| Epitaph / Charged Shot | Expected TTK | 2.950 s | 3.401 s | 3 | Yes |
| Nataruk / Perfect Shot | Expected TTK | 2.481 s | 2.844 s | 2 | Yes |
| Gram Prime / Heavy Slam Attack | Expected TTK | 2.643 s | 2.769 s | 3 | Yes |

Epitaph Charged Shot / Burst is the performance exception. An isolated five-run repeat measured 5.004 s median / 5.938 s maximum; disabling Arcane optimization measured 4.941 / 5.636 s, so Arcane candidate evaluation does not explain the cost. A single-run CPU profile samples repeated `calculateBuild` calls and scoring as the main optimizer hot path. The four-pass increase is limited to Expected TTK; the Epitaph burst case is still slower than the five-second target and remains open for profiling and improvement.

The catalog-coverage audit checked 694 weapons and 598 unique builder-eligible mod records: 466 have a parsed damage/performance effect, 132 have no parsed effect at maximum rank, and 90 records have unmatched lines conservatively flagged for review (17 partially parsed, 73 fully unparsed). The keyword screen includes utility false positives; this is a review list, not 90 confirmed missing damage models. Affected ranks stay manually selectable with an explanation and are omitted from auto-optimization until their combat effects are modeled.

The production optimizer Worker is 104,038 bytes after moving the review helper out of the catalog's runtime module. This prevents the catalog JSON from being duplicated inside the Worker. Release checks pass at 595 tests / 49 files, TypeScript and production build, `npm run validate:sources`, focused ESLint, and CRLF-aware diff checking. The production Worker remains unmeasured for cold-start and mobile devices.

## Direct-only per-status AoE regression sample (2026-11-15)

Command: `node --import tsx/esm scripts/benchmarkBuildOptimizer.ts --weapon=Cedo --attack="Glaive Radial Attack" --goal=burst --runs=5`

The five desktop Node runs used Initial state, Grineer, MR 30, Catalyst, Exilus and Arcane search, and up to three Forma. All selected the same legal 59/60 build, with three Forma; median optimizer time was 2.274 s and the maximum-of-five observation was 2.523 s. The result selected Primed Point Blank, Primed Cleanse Grineer, Toxic Barrage, Frigid Blast, Primed Charged Shell, Hell's Chamber, Shotgun Barrage, and Lingering Torment. This confirms a stable legal optimizer result on a source-marked radial attack after direct-only per-status effects were excluded. It is not a before/after quality comparison, a global optimum, a browser Worker measurement, or a population p95.

## Current-source 36-case benchmark refresh (2026-11-14)

Command: `node --import tsx/esm scripts/benchmarkBuildOptimizer.ts --runs=5`

This full-width five-run refresh supersedes the preceding Epitaph performance exception for the current local source. It covered 36 weapon/attack/objective cases on Windows x64 with Node v22.16.0 and 28 logical CPUs. All cases used Initial conditionals, Catalyst, MR 30, max-rank catalog mods, optional Exilus and Arcane optimization, and a three-Forma limit; target profiles are the benchmark's faction presets. All 36 outputs were stable across repetitions, Arcane selections were stable, and every build passed capacity, unique-name, incompatibility-group, and Forma checks. Medians ranged from 0.670 to 3.204 seconds; maximum-of-five observations ranged from 0.703 to 3.569 seconds. For five samples, the harness's p95 is the maximum observed value; it is not a population-tail estimate.

| Weapon / attack | Goal | Median | Maximum of five | Forma | Legal |
|---|---|---:|---:|---:|---|
| Braton Prime | Burst | 3.137 s | 3.569 s | 3 | Yes |
| Cedo | Burst | 2.385 s | 2.523 s | 3 | Yes |
| Cedo / Glaive Radial Attack | Burst | 3.054 s | 3.395 s | 3 | Yes |
| Phantasma Prime / Plasma Bomb Explosion | Burst | 2.342 s | 2.387 s | 2 | Yes |
| Laetum | Burst | 3.071 s | 3.306 s | 3 | Yes |
| Cinta | Burst | 2.347 s | 2.643 s | 3 | Yes |
| Kuva Hek | Scaling | 2.018 s | 2.041 s | 2 | Yes |
| Torid | Scaling | 3.029 s | 3.230 s | 3 | Yes |
| Broken War | Burst | 2.434 s | 2.657 s | 3 | Yes |
| Corvas Prime | Burst | 1.054 s | 1.068 s | 3 | Yes |
| Verglas Prime | Burst | 2.333 s | 2.430 s | 3 | Yes |
| Phantasma Prime / Beam | Scaling | 2.135 s | 2.429 s | 3 | Yes |
| Rubico Prime | Burst | 2.165 s | 2.183 s | 3 | Yes |
| Perigale Prime | Expected TTK | 2.465 s | 2.499 s | 3 | Yes |
| Epitaph / Charged Shot | Burst | 3.204 s | 3.241 s | 3 | Yes |
| Acrid | Scaling | 2.327 s | 2.414 s | 3 | Yes |
| Hystrix Prime / Fire Quill | Scaling | 2.710 s | 2.777 s | 2 | Yes |
| Nukor | Burst | 2.900 s | 2.982 s | 3 | Yes |
| Nataruk / Perfect Shot | Burst | 2.427 s | 2.445 s | 1 | Yes |
| Gram Prime / Heavy Slam Attack | Burst | 1.519 s | 1.567 s | 3 | Yes |
| Braton Prime | Burst | 2.718 s | 2.738 s | 3 | Yes |
| Braton Prime | Expected TTK | 2.265 s | 2.364 s | 3 | Yes |
| Cedo / Glaive Radial Attack | Expected TTK | 2.273 s | 2.357 s | 3 | Yes |
| Phantasma Prime / Plasma Bomb Explosion | Expected TTK | 2.050 s | 2.060 s | 3 | Yes |
| Laetum | Expected TTK | 2.814 s | 2.913 s | 3 | Yes |
| Cinta | Expected TTK | 2.235 s | 2.388 s | 3 | Yes |
| Kuva Hek | Expected TTK | 2.107 s | 2.141 s | 1 | Yes |
| Torid | Expected TTK | 2.328 s | 2.444 s | 3 | Yes |
| Broken War | Expected TTK | 1.445 s | 1.496 s | 2 | Yes |
| Corvas Prime | Expected TTK | 0.670 s | 0.703 s | 3 | Yes |
| Verglas Prime | Expected TTK | 2.121 s | 2.697 s | 3 | Yes |
| Epitaph / Charged Shot | Expected TTK | 2.044 s | 2.095 s | 3 | Yes |
| Nataruk / Perfect Shot | Expected TTK | 1.700 s | 1.757 s | 2 | Yes |
| Gram Prime / Heavy Slam Attack | Expected TTK | 1.299 s | 1.330 s | 3 | Yes |
| Lex Prime | Burst | 2.729 s | 2.782 s | 3 | Yes |
| Lex Prime | Expected TTK | 2.122 s | 2.130 s | 3 | Yes |

Epitaph Charged Shot / Burst returned the same eight-mod list and score (241,624.7363) in all five runs, with 3.204 s median and 3.241 s maximum. This current-source result removes the earlier five-second exception in this Node sample. It does not measure the packaged Worker, cold startup, mobile/cross-device latency, custom target profiles, or global build quality. A bounded benchmark corpus cannot prove full-catalog optimality; broad objective-equivalent Underframe comparisons, weapon/status coverage, and exhaustive oracles remain open. The production Worker after Maiming Strike support is 107,043 bytes; the existing Vite large-chunk warning remains.

## Incarnon Wiki-stat ingestion and Torid path sweep (2026-11-15)

The shared Incarnon catalog parser now resolves variant-specific evolution values from slash-separated Wiki text, normalizes legacy pre-Update-36 stat labels, scopes form notes by stat family, and applies normal-form-only magazine values only to normal attacks. Current Torid, Burston, Gorgon, and Latron Wiki descriptions replace stale or unresolved generated snapshot records. Direct damage per active target status is also parsed where the Wiki lists it. Furax slide Critical Damage Multiplier and Sicarus/Sicarus Prime Status Chance remain explicit unsupported lines pending a verified formula/value interpretation.

`npx tsx scripts/auditIncarnonPathSearch.ts --weapon=Torid` checked 18 evolution paths plus the no-evolution baseline with four candidate mods and two Arcanes against the fixed 83,818 Health / 2,700 Armor Grineer target. The full sweep and bounded two-path refinement selected the same capacity-valid, zero-Forma build (Final Fusillade, Extended Volley, Elemental Balance) with Primary Merciless R5, with a 0.000-second modeled TTK gap. The full pass evaluated 19 candidates in about 2.68 seconds on desktop Node. This only checks shortlist consistency with the same evaluator. Torid Incarnon transformation timing and transformed ammunition behavior remain insufficiently represented, so this is not an independent damage-accuracy result or proof of global optimality.

Release checks pass at 686 tests / 52 files, production TypeScript/Vite build, source validation, prerequisite audit, mod-effect audit (482/599 parsed, 117 without a parsed effect, 85 review candidates, zero weapon pools without parsed damage), focused ESLint, and `git diff --check`. The production optimizer Worker is 113,579 bytes. Production Worker browser latency, cold start, mobile/cross-device performance, broad Underframe comparisons, and full-catalog optimality remain open.

## One-charge Incarnon finite encounter and corrected Torid path audit (2026-11-15)

All 69 ranged Incarnon attack rows now have Wiki-backed separate-gauge capacities. The bundled evolution feed contains 63 matching ranged forms; six newer Genesis variants (Ballistica, Rakta Ballistica, Ballistica Prime, Stug, Vectis, and Vectis Prime) have capacity and source-link fallbacks while their evolution choices remain absent from the feed. The curated family values correct the stale Laetum snapshot from 220 to the current Wiki value of 216. Selected transformed attacks use their capacity for magazine/shot statistics, and the finite direct sequence, expected encounter, and optimizer stop firing after one full gauge. The encounter continues already-applied status effects after the last shot. The Evolution panel shows the capacity, source link, and one-charge boundary.

Vasto and Vasto Prime use the current [Vasto Incarnon Genesis Wiki data](https://wiki.warframe.com/w/Vasto_Incarnon_Genesis): six attack rounds per burst, six innate pellets per round, 0.1s between burst rounds, and 24 rounds in a full gauge (four bursts). The Wiki's [Vasto Prime attack table](https://wiki.warframe.com/w/Vasto_Prime) confirms the Incarnon attack's Burst trigger and per-round multishot. These are modeled as 24 round events grouped into four timed bursts, not as 24 trigger pulls. The [Onos Wiki page](https://wiki.warframe.com/w/Onos) states that each completed charged Heat release consumes 50 rounds after charge-beam ticks; both release rows use that ammo cost, so one 350-round gauge permits seven modeled releases. The pre-release tick damage and charge timing are omitted and disclosed in the builder.

The earlier Torid path-audit harness used a base attack object after `resolveIncarnonState` cloned the candidate attack array. That broke attack identity matching, so the optimizer audit did not reliably select the transformed mode. The harness now binds each run to the attack row from that candidate's resolved weapon before scoring it.

With that correction and the Wiki-listed Torid 170-round gauge, the fixed Grineer Heavy Gunner fixture (83,818 Health, 2,700 Armor, no Shields or Overguard) evaluated all 18 evolution paths plus the no-evolution baseline. The full sweep and two-path refinement shortlist selected the same legal zero-Forma result: Malignant Force R3, Serration R10, and Galvanized Chamber R10, with no Arcane. Both returned a 21.25s TTK and identical score; the full sweep took 1.263s on desktop Node. This is a bounded comparison under the same finite evaluator and one target profile, not independent gameplay validation, general optimality, or global build-quality proof.

Only the first full transformed gauge is modeled. Charge-building, the transformation/switch animation, reversion, subsequent normal-form attacks, and cross-mode combat history are omitted; Onos pre-release beam ticks/charge timing are also outside its release-row approximation. Status outcomes remain expected values rather than full stochastic histories. Current release checks pass at 693 tests / 52 files, TypeScript/production build, source validation, prerequisite audit, mod-effect audit (482/599 parsed, 117 with no parsed effect, 85 review candidates, 25 partial and 60 fully unparsed, zero weapon pools without parsed damage), focused ESLint, and CRLF-aware diff check. The production optimizer Worker is 114,045 bytes. Browser Worker cold-start, mobile/cross-device latency, broader Underframe comparisons, and full-catalog optimality remain open. See `scripts/auditIncarnonPathSearch.ts` and the source links above for reproduction context.

## Vasto Prime finite-burst Incarnon path audit (2026-11-15)

The path-search harness now includes Vasto Prime's Incarnon Form with four candidate mods (Galvanized Diffusion, Hornet Strike, Pathogen Rounds, Target Cracker) and Secondary Deadhead / Merciless. On the same fixed 83,818 Health / 2,700 Armor Grineer target, the 18 evolution paths plus the no-evolution baseline and the two-path refinement shortlist both selected a capacity-valid, zero-Forma build: Target Cracker R5, Hornet Strike R10, and Galvanized Diffusion R10, with no Arcane. Both returned a 3.800s expected TTK and identical score; two full 19-evaluation passes took 215.6ms and 220.8ms on desktop Node. The winner's path was Deathtrap Trigger, Awakened Readiness, and Survivor's Edge.

This specifically exercises the Wiki-sourced 24-round gauge, six-round burst timing, and finite encounter limit for a second Incarnon weapon. It is a bounded candidate pool and target under the same evaluator, not an independent gameplay comparison, global-optimality proof, or broad optimizer-quality claim.

## Laetum evolution shortlist path-quality audit (2026-11-15)

The full Laetum search compared all 81 legal evolution combinations plus the no-evolution baseline on the same 83,818 Health / 2,700 Armor Grineer target. Each path received its own 3-slot, three-Forma-limited Expected TTK optimization over Barrel Diffusion, Frostbite, Hornet Strike, and Pistol Pestilence, with Secondary Deadhead and Merciless available. The fast two-path shortlist and the full 82-candidate sweep selected the same legal zero-Forma build: Pistol Pestilence R3, Frostbite R3, and Hornet Strike R10, no Arcane, with the same 6.333s TTK and score. The full desktop Node sweep took 4.262s.

This checks the production-style path shortlist against path-specific mod and Arcane optimization for one large 81-path catalog. It does not prove global optimality outside this four-mod pool, other targets, or the rest of the Incarnon catalog. An automated regression now repeats this full Laetum comparison, while separate Vasto Prime coverage checks its burst-expanded finite gauge and all 18 paths.

The current follow-up also asserts the same legal Perigale Prime standard/Flawed mod pool in both builder surfaces and checks standard counterparts plus display order for every weapon catalog entry. Release checks pass at 694 tests / 52 files, production TypeScript/Vite build, `validate:sources`, prerequisite and mod-effect audits (482/599 parsed records; 117 without parsed effects; 85 review candidates; zero weapon pools without parsed damage), focused ESLint, and CRLF-aware diff check. The production optimizer Worker remains 114,045 bytes. The build bundle contains Wiki-backed Neutral-combo output and none of the screenshot's stance-input labels. In-app browser open requests for port 80 and the production URL were queued, so no fresh visual QA was obtained in this follow-up.

## Three-weapon Incarnon path-shortlist comparison (2026-11-15)

Command: `npx tsx scripts/auditIncarnonPathSearch.ts --weapon=Laetum`, then repeat with `--weapon=Torid` and `--weapon="Vasto Prime"`. Each scenario used a fixed four-mod/two-Arcane pool, three mod slots, up to three Forma, and the same Grineer Heavy Gunner fixture (83,818 Health, 2,700 Armor, no Shields or Overguard). Each path received its own Expected TTK optimization, then the two-path refinement shortlist was compared with the complete sweep plus the no-evolution baseline.

The shortlist selected the same legal zero-Forma, no-Arcane winner as the full path sweep in all three pools. Laetum matched at 6.333s using Pistol Pestilence R3, Frostbite R3, and Hornet Strike R10; its selected path was Rapid Wrath, Feather of Justice, Elemental Excess, and Devouring Attrition. The 82-candidate sweep (81 paths plus baseline) took 5.569s in this desktop Node run. Torid matched at 21.25s using Malignant Force R3, Serration R10, and Galvanized Chamber R10; its selected path was Final Fusillade, Extended Volley, and Elemental Balance. Its 19-candidate sweep took 1.567s. Vasto Prime matched at 3.80s using Target Cracker R5, Hornet Strike R10, and Galvanized Diffusion R10; its selected path was Deathtrap Trigger, Awakened Readiness, and Survivor's Edge. Its 19-candidate sweep took 0.262s. Score and TTK gaps were zero in each comparison.

These are single desktop Node timing observations and restricted candidate-pool search checks. They do not establish full-catalog or global optimality, independent gameplay accuracy, or performance on a browser Worker or mobile device. The transformed-ammo model still omits charge-up, transformation/reversion transitions, later normal-form combat, and cross-mode encounter history; these limitations particularly affect interpreting full Incarnon TTK as a live-game result.

## Fully Stacked Cedo Expected TTK benchmark (2026-11-16)

Command: `npx tsx scripts/benchmarkBuildOptimizer.ts --weapon=Cedo --goal=timeToKill --fully-stacked --runs=5`. The benchmark harness can select Fully Stacked conditionals and records that state in its report.

The direct Normal Attack case used the 104-mod / 15-Arcane catalog pools and Grineer faction preset. All five runs returned the same legal three-Forma build at 60/60 capacity, with 235 finite-encounter refinement candidates, 0.3540s modeled TTK, 1.767s median optimizer time, and 1.829s maximum / five-run p95 observation. The selected list omitted Galvanized Savvy, so this is a legal-build and optimizer-latency sample under Fully Stacked state, not a build-quality comparison for the same-trigger Galvanized behavior. This is desktop Node timing, not browser Worker, cold-start, or mobile measurement.

## Realistic Galvanized finite-score oracle (2026-11-16)

The exhaustive joint mod/Arcane Expected TTK oracle now includes a direct Cedo Normal Attack under Realistic state. For this scenario it enumerates legal ordered builds from four mods over three slots and every rank of Primary Frostbite, then verifies the optimizer returns the same finite TTK and DPS. The exact optimizer scorer now passes its iterative `1 / TTK` kill cadence into the same finite encounter used by the planner; Arcane comparison, refinement, and final rescoring use this path. A regression also verifies this cadence does not alter unrelated `onKill` effects. The seven-scenario oracle passed in isolation in 46.30 seconds.

After the exact-score change, a three-run Cedo Expected TTK benchmark returned legal three-Forma results for both Glaive Radial Attack and direct Normal Attack. The radial case measured 3.6842s TTK (3,189.7ms median / 3,751.7ms maximum optimizer time); the direct case measured 0.6550s (3,600.3ms median / 3,740.7ms maximum). A one-run direct confirmation selected Galvanized Savvy R10, Primary Frostbite R5, and a 59/60-capacity build. The radial attack does not use the per-status kill cadence estimate. These desktop Node samples are not browser Worker, cold-start, or mobile measurements, and this single fast-kill pool does not establish broad optimizer quality or slower kill-stack cadence accuracy.

## Slower Realistic Galvanized partial-stack oracle (2026-11-16)

The exhaustive joint mod/Arcane oracle now includes a second direct Cedo Normal Attack target at 100,000 Health / 3,000 Armor, with four candidate mods, three slots, and every Primary Frostbite rank. A forced Galvanized Savvy R10 / Toxic Barrage R10 / Primed Charged Shell R10 / Primary Frostbite R5 build returns 43.4146214s Expected TTK, so the Wiki's 20-second Galvanized duration gives `20 / TTK = 0.4606743` average stack per eligible status, below its two-stack cap. The exhaustive optimizer comparison passes; a separate optimizer run selects a Savvy-free legal build, so the forced candidate specifically exercises the partial-stack calculation. The isolated oracle test took 59.15s; the full suite passes 756 tests / 53 files. This validates the deterministic cadence estimate against its own exhaustive pool, not random per-target proc and expiry histories or live gameplay.

## Full-pool Cedo finite-TTK replacement-slot audit (2026-11-17)

Command: `npx tsx scripts/auditExpectedTtkFullPool.ts --weapon=Cedo --faction=Grineer --state=realistic --health=100000 --armor=3000`. The scenario used Cedo Normal Attack, eight slots, Catalyst, Mastery Rank 30, up to three Forma, no Arcane/Exilus optimization, and the Grineer target at 100,000 Health / 3,000 Armor. The catalog contained 104 candidates; 61 damage candidates passed the audit's source/effect/faction filters. The script exactly scored 404 capacity-legal one-mod add/remove/replacement neighbors.

Before the slot-alternative fix, the optimizer returned Frail Momentum R5, Galvanized Hell R10, Primed Chilling Grasp R10, Toxic Barrage R3, Scattering Inferno R3, Shotgun Barrage R5, Repeater Clip R5, and Galvanized Savvy R10 at 2.7656226s / 36,158.2 DPS. The exact best neighbor replaced Repeater Clip with Blaze R3, used three Forma, and scored 2.6109661s / 38,300 DPS. The same Blaze candidate's proxy-preferred replacement slot scored 5.1112s finite TTK, demonstrating that candidate-only diversity did not preserve its stronger outgoing-mod alternative.

The finite-refinement shortlist now reserves up to eight alternate replacement slots for already-selected candidates across reload-tempo, base-damage, elemental, status, multishot, critical, faction, and weapon-tempo families, within the existing 40 exact-scoring proposals per pass. The Cedo result now includes Blaze at 2.6109661s. A repeat of the complete 404-neighbor audit found no improving one-mod neighbor. The prior Braton Spring-Loaded Chamber reload-tempo case still passes its independent exact-score regression.

The audit helper reports both exact and proxy-ranked neighbors plus all Blaze proposals so later findings can be reproduced. Local focused tests, all 789 tests / 53 files, TypeScript/production build, source validation, prerequisite audit, mod-effect coverage, focused ESLint, and diff check pass. This is full one-mod neighborhood coverage for one Cedo target under the planner model; it does not prove global optimality, stochastic-history accuracy, or live gameplay performance. Current-main CI and release are pending.


## D3-OPT-UNDERFRAME-LEX-REPEAT-001 — Lex Prime secondary Auto Build capture (2026-11-18; bounded)

Reproduce the common-model scoring and optimizer comparison with:

```sh
npx tsx scripts/compareLexPrimeUnderframeMatched.ts
```

The integrated in-app browser used the fresh Underframe build `/Codex-Matched-Corpus-Lex-Prime`, Lex Prime / Secondary / Normal Attack, and a custom Grineer target with 100,000 Health, 3,000 Armor, and zero Shields or Overguard. The target had headshots off (the displayed multiplier was 3x), there were no external statuses or buffs, and the weapon had a Catalyst, no Exilus, and Arcanes disabled. Accurate Ammo was enabled and the simulation time was five seconds. Auto Build settings were 28 CPU cores, GPU off, Sample Size Multiplier 3, final refinement enabled with 200 samples, Luck Averaged enabled, Elemental Candidates and Cost Control enabled, a three-Forma maximum, and Raw Damage / Status Damage / both blacklists disabled.

Three Auto Build runs returned the same eight mods: Ice Storm R3, Pistol Pestilence R3, Primed Heated Charge R10, Galvanized Shot R10, Galvanized Diffusion R10, Anemic Agility R5, Lethal Torrent R5, and Frostbite R3. The first output showed −22/60 capacity and zero Forma. Underframe's Auto Polarize then made the list legal at 1/60 with three Forma; the next two Auto Build runs retained that legal capacity. The two observed standard Calculate DPS snapshots differed (51,724 DPS / 1.93 s and 57,692 DPS / 1.73 s), while Luck Averaged repeated at 57,433 DPS / 1.75 s in all three runs. The Luck Averaged result is used as the native repeat observation; the standard samples are retained as individual UI readings, not averaged evidence.

Under the matched Tenno-Hub Realistic Expected TTK model (Grineer / 100,000 Health / 3,000 Armor, eight normal slots, Catalyst, max-rank mods, up to three Forma, no Arcane/Exilus/external effects/headshots), the captured Underframe list is legal at 60/60 with three Forma and scores 1.9231 s / 52,000 expected damage per second. The Tenno-Hub optimizer returns a legal 60/60, three-Forma build—Galvanized Diffusion R10, Pistol Pestilence R3, Primed Convulsion R10, Scorch R3, Primed Target Cracker R10, Lethal Torrent R5, Accelerated Isotope R3, and Galvanized Shot R10—at 1.6827 s / 59,428.6 expected damage per second after evaluating 277 candidates. That is 12.5% lower modeled TTK for this single shared-model fixture. The captured Underframe list scores 9.8923 s in the Initial-state ablation, illustrating why this comparison uses the same Realistic conditional state for both builds.

Two independent executions of the comparison script returned identical structured scoring and optimizer output. This worktree had no `node_modules`; `npx tsx` could not resolve `tsx` because registry DNS was unavailable. The script was executed twice with Node 22's experimental TypeScript stripping and a temporary extension/JSON loader. No app source changed, and the full test suite, TypeScript project, ESLint, and production build were not run in this dependency-free worktree. The source audit below confirms Underframe Auto Build's default objective is mean avgDps over seeded five-second simulations, not finite Expected TTK. These results are a Tenno-Hub shared-model rescore, not native search-objective parity, general optimizer superiority, or gameplay validation. More categories, objectives, targets, and live-game accuracy remain open.
## D3-OPT-UNDERFRAME-CEDO-REPEAT-001 — Cedo shotgun Auto Build and stack-state comparison (2026-11-18; bounded)

### D3-OPT-UNDERFRAME-CEDO-READOUT-REPEATABILITY-001 — current calculator replay (2026-11-22; bounded)

On the existing saved /Codex-Matched-Corpus-Cedo page, read-only IAB inspection confirmed Cedo / Shotgun / Normal Attack, Grineer / 100,000 Health / 3,000 Armor / no Shields or Overguard, and a five-second simulation. The visible controls had Galvanized Hell at 4/4, Galvanized Savvy at 2/2, the Cedo conditional unchecked, no external statuses/buffs, and the distance control at 26m within 26–52m. Four recorded Standard Calculate DPS results were 37,500 / 2.67s (2,857 raw + 0 DoT per shot), 32,787 / 3.05s (2,500 + 0), 42,553 / 2.35s (3,226 + 0), and 40,000 / 2.50s. One additional standard calculation was triggered during accessibility extraction, but its structured readout was not retained and is excluded. A Luck Averaged read returned 38,091 / 2.74s and 2,893 raw + 0 DoT per shot. The latter matches the three repeated 38,091 / 2.74s Auto Build readouts recorded in the original capture.

For each standard result, displayed Average DPS multiplied by displayed TTK is 100,125; 100,000.35; 99,999.55; and 100,000 damage respectively, within 125 damage (0.125%) of the 100,000-health pool. This close fit is consistent with a kill-time-normalized standard readout; it remains an inference from a two-decimal TTK display, not a documented formula. All four displayed rates exceed the 20,000 DPS ceiling for Tenno-Hub's health-clipped applied-damage/5s objective on this target. Luck Averaged's 38,091 × 2.74s product is 104,369, so the displayed averages do not obey the same simple reciprocal exactly; their aggregation semantics remain unknown. This evidence shows the standard calculator readout differs from Tenno-Hub's fixed-window score when the target dies during the window, but does not prove the Auto Build scorer uses an identical denominator.

This is a small page-level readout repeatability observation. The page does not expose seeds or its effective score denominator, and the observed fully visible Galvanized stacks do not establish how the Luck Averaged path samples them. It does not compare Auto Build winners, prove objective parity, or validate either simulator against gameplay. No Save, Auto Build, or Auto Polarize action was used. Raw observation state is in scripts/fixtures/underframeCedoReadoutRepeatability.json; continue the multi-weapon objective-matched corpus without treating this as a Cedo optimizer result.

#### Cedo Standard and Luck Averaged replay (2026-11-23)

On the same existing saved Cedo page and unchanged five-second Grineer / 100,000 Health / 3,000 Armor / 26m setup, four Standard Calculate DPS reads returned 29,703 (3.37s; 2,273 raw / 0 DoT per shot), 34,483 (2,632 raw / 0 DoT; TTK not retained), 42,553 (2.35s; 3,226 / 0), and 36,585 (2.73s; 2,778 / 0). Three Luck Averaged reads repeated exactly at 38,091 DPS / 2.74s / 2,893 raw + 0 DoT per shot. The visible Galvanized Hell 4/4 and Galvanized Savvy 2/2 state, disabled Cedo conditional, empty external status/buff lists, and 26m distance were unchanged. Only the calculator actions were used; there was no Save, Auto Build, Auto Polarize, or build editing.

This new sample reproduces variable Standard output and a stable Luck Averaged value on this page, complementing the 2026-11-22 reads. The page does not expose the website's seeds or aggregation denominator. This does not establish the simulator formula, explain raw/DoT attribution, compare Auto Build winners, or prove objective/gameplay parity. The incomplete TTK field is explicitly retained as unknown in the fixture. See `readoutReplay2026-11-23` in `scripts/fixtures/underframeCedoReadoutRepeatability.json`.

#### Surviving-target readout (2026-11-22)

With the same saved Cedo setup and five-second simulation, Health was temporarily raised to 2,000,000 while Armor remained 3,000. One Standard Calculate DPS read returned 3,572 raw / 0 DoT average damage per shot, 46,279 Average DPS, and `> 5s` TTK. The combat log showed the target still alive at the end of the simulation. This is consistent with Standard Calculate DPS using the full five-second duration when TTK exceeds the window; it complements the earlier DPS × TTK fit for targets killed within the window. This is a single readout, the site does not expose the exact denominator, and neither observation establishes the Auto Build scorer's semantics. Health was restored to 100,000 and no saved build was changed. See the `survivingTargetCheck` fixture fields.

Reproduce the common-model scorer with `npx tsx scripts/compareCedoUnderframeMatched.ts` in a normal dependency install. In this dependency-free worktree, Node 22 experimental TypeScript stripping plus a temporary extension/JSON loader was used; that helper is not included. The scorer emits build legality, the shared finite scores, and relevant weapon/status stats.

The integrated in-app browser used a new Underframe build `/Codex-Matched-Corpus-Cedo`, Cedo / Shotgun / Normal Attack, Grineer custom target 100,000 Health / 3,000 Armor / no Shields or Overguard, no headshots, Catalyst on, Exilus and Arcanes off, no external status/buffs, and five-second Auto Build with three Forma maximum, Luck Averaged and final refinement enabled. Accurate Ammo was disabled because Normal Attack has no ammo cost. Three runs selected the same eight mods: Primed Charged Shell R10, Toxic Barrage R3, Galvanized Hell R10, Primed Point Blank R10, Amalgam Shotgun Barrage R5, Accelerated Blast R3, Galvanized Savvy R10, and Frail Momentum R5. The first list showed −22/60 capacity and zero Forma; Auto Polarize made it legal at 0/60 with three Forma. Later runs retained that list and legal capacity. Native Standard Calculate DPS was 32,787 / 3.05 s in one sample; native Luck Averaged repeated at 38,091 / 2.74 s in all three runs.

Underframe's Stats tab displayed 20.00% critical chance, 2.40x critical multiplier, 0.80% status chance, 12.82 attack speed, 19.80 multishot, and 288.28 damage per projectile (168.75 Corrosive, 119.53 Puncture). The current [Cedo Wiki page](https://wiki.warframe.com/w/Cedo) lists 0.30% base status chance and confirms the six-pellet primary fire and its +60% damage per unique status. The [Galvanized Hell Wiki page](https://wiki.warframe.com/w/Galvanized_Hell) lists +110% base multishot plus +30% per kill, stacking four times to +230%; 6 × 3.3 = 19.8. The displayed Underframe value therefore corresponds to the full four-stack Galvanized Hell state.

The reproducible Tenno-Hub scorer evaluates the captured list and optimizer result with the same single-target finite Expected TTK engine. Under Realistic state, the fixed list is legal at 60/60 with three Forma and scores 5.3176 s / 18,805.6 DPS after 41 attacks. The legal Tenno-Hub optimizer list—Frail Momentum R5, Galvanized Hell R10, Primed Chilling Grasp R10, Toxic Barrage R3, Scattering Inferno R3, Blaze R3, Shotgun Barrage R5, and Galvanized Savvy R10—uses 59/60 capacity and two Forma, scores 2.6110 s / 38,300 DPS, and is evaluated from 133 candidates. The optimizer's result matches the existing Cedo one-mod neighborhood audit baseline; this is not a new neighborhood sweep.

State ablations show why native values cannot be read as a like-for-like score: the captured Underframe list scores 6.8764 s in Tenno-Hub Initial state and 2.4941 s when all modeled conditionals start fully stacked. The latter is close to Underframe's 2.74 s Luck Averaged display. Underframe's visible 19.80 multishot is the full Galvanized Hell stack state, while Tenno-Hub Realistic estimates 15.624 multishot and partial Galvanized Savvy uptime for its repeated-target cadence. This makes conditional-state differences a plausible contributor to the separate-simulator gap, but this Expected TTK ablation does not reproduce Underframe's seeded five-second avgDps objective. The shared-model Realistic result favors Tenno-Hub's returned build by 50.9% lower modeled TTK than the captured list; this is one objective-limited fixture, not simulator parity, broad optimizer superiority, or gameplay validation.

The Cedo Wiki page and local damage/status breakdown agree that the primary's base status chance is 0.30%; Tenno-Hub's parser is correct, so no weapon-data defect was found. The comparison script was run with Node 22 experimental TypeScript stripping and the temporary extension/JSON loader because this worktree lacked `node_modules` and registry DNS was unavailable. The full suite, TypeScript project, ESLint, production build, and browser capture of Tenno-Hub were not run for this documentation/scorer-only pass. Underframe capture is recorded in the integrated browser, but no screenshot artifact was saved. The default Underframe Auto Build objective is now source-confirmed as mean avgDps over seeded five-second runs; Tenno-Hub optimized Expected TTK here, so optimizer-objective parity remains open. Full-stack timing semantics, additional categories/objectives, and gameplay accuracy remain open.


## D3-OPT-UNDERFRAME-OBJECTIVE-SOURCE-001 — public Auto Build objective audit (2026-11-18; bounded)

The latest public [Underframe Desktop repository commit](https://github.com/NevermindNilas/underframe-desktop/commit/fe38d07f3515a995a068015314ad85acc65bef61) is the current upstream commit as of this review. Its [Auto Build port spec](https://github.com/NevermindNilas/underframe-desktop/blob/fe38d07f3515a995a068015314ad85acc65bef61/docs/port-auto-build.md#0-summary) describes the site's default search objective as mean `avgDps` across seeded runs of a five-second simulation; Raw Damage and Status Damage are alternate metrics. The spec identifies the reviewed site build as `staticVersion 1792684257`.

The source implements that boundary: [`metricOf`](https://github.com/NevermindNilas/underframe-desktop/blob/fe38d07f3515a995a068015314ad85acc65bef61/src/shared/auto-build-settings.js) defaults to `avgDps` unless Raw/Status is enabled; [`runsFor`](https://github.com/NevermindNilas/underframe-desktop/blob/fe38d07f3515a995a068015314ad85acc65bef61/src/shared/auto-build-settings.js) returns three base samples for the Cedo setup (5 seconds × multiplier 3); and [`runAutoBuild`](https://github.com/NevermindNilas/underframe-desktop/blob/fe38d07f3515a995a068015314ad85acc65bef61/src/shared/auto-build.js) uses deterministic seeds 1…N when Luck Averaged is enabled. Final refinement separately uses the configured 200-sample count. The search's readout path uses eight seeds and is separate from candidate ranking ([`poolScorer`](https://github.com/NevermindNilas/underframe-desktop/blob/fe38d07f3515a995a068015314ad85acc65bef61/src/renderer/auto-build-job.js)).

Therefore the Cedo and Lex captures used Underframe's default mean-`avgDps` search metric with Luck Averaged enabled. Tenno-Hub's paired optimizer runs used finite Expected TTK. The shared Tenno-Hub rescores put both lists through one evaluator, but they do not compare optimizer rankings under the same objective. The public Desktop README identifies the damage/data `core/` as a private submodule, so this review cannot independently run or audit that engine. The current corpus remains useful for legal-build and common-model comparison; objective parity and gameplay validation remain open.

## D3-OPT-UNDERFRAME-AVG-DPS-SEMANTICS-001 — surviving-target Gram readout probe (2026-11-23; bounded, read-only)

On the existing `Codex Matched Corpus Gram Prime` page, I temporarily raised target Health from 100,000 to 2,000,000 so the target survived the five-second readout, then restored Health to 100,000. The page remained Gram Prime / Normal Attack / Lashing Tempest (Forward), Grineer / 3,000 Armor, with Galvanized Steel and Galvanized Elementalist each shown at 4/4. No build edit, Save, Auto Build, or Auto Polarize was used. The displayed weapon composition was Heat-heavy (60% Heat, 30% Slash, 7.5% Impact, 2.5% Puncture).

| Readout mode | Sample | Raw avg/shot | DoT avg/shot | Sum shown | DPS | TTK |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Standard | 1 | 18,155 | 40,239 | 58,394 | 116,788 | >5 s |
| Standard | 2 | 19,549 | 43,031 | 62,580 | 125,161 | >5 s |
| Standard | 3 | 27,051 | 66,695 | 93,746 | 187,492 | >5 s |
| Standard | 4 | 20,672 | 62,633 | 83,305 | 166,609 | >5 s |
| Standard | 5 | 19,783 | 66,480 | 86,263 | 172,525 | >5 s |
| Luck Averaged | 1–3 | 19,788 | 52,183 | 71,971 | 143,942 | `?` |

The five Standard values vary substantially. The three Luck Averaged reads repeat exactly at the displayed precision. In all eight reads, displayed DPS is the displayed Raw + DoT sum multiplied by about two (within 1 DPS after rounding), which is consistent with a 2/s display conversion for this page and build. The page's Weapon Stats showed attack speed 1.86, so the UI alone does not identify whether the conversion uses a separate stance cadence, rounded/hidden values, or another internal rate. Treat this as a readout-arithmetic observation only; it does not identify the private damage engine's raw/DoT aggregation, status-tick timing, general DPS denominator, seed policy, or Auto Build ranking semantics. The private `core/` remains unavailable, and Gram's Lashing Tempest sequence is not represented by Tenno-Hub's generic Normal Attack scorer. No simulator parity or gameplay conclusion follows.

Next, use a supported non-melee build with a surviving target and a materially different attack cadence to test whether the same UI conversion appears, while preserving separate Standard and Luck Averaged results. Keep native optimizer parity open until a legal comparator and comparable objective/state are observable.

### Braton Prime magazine-limited cadence cross-check (2026-11-23; bounded, read-only)

The existing `Codex Matched Corpus Braton Prime` page was read with its captured eight-mod list unchanged: Braton Prime / Normal Attack / Grineer / 3,000 Armor / five seconds, Galvanized Chamber 5/5, Galvanized Aptitude 2/2, no external statuses, and Accurate Ammo enabled. Target Health was temporarily set to 2,000,000 and restored to 100,000 after the reads. Weapon Stats showed 18.20 Attack Speed, 3.30 Multishot, a 75-round Magazine, and 2.15s Reload. No build edit, Save, Auto Build, or Auto Polarize was used.

| Readout mode | Sample | Raw avg/shot | DoT avg/shot | Sum shown | DPS | TTK |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Standard | 1 | 3,550 | 660 | 4,210 | 62,939 | >5 s |
| Standard | 2 | 4,012 | 868 | 4,880 | 72,957 | >5 s |
| Standard | 3 | 3,928 | 567 | 4,495 | 67,203 | >5 s |
| Standard | 4 | 4,113 | 592 | 4,705 | 70,336 | >5 s |
| Standard | 5 | 3,841 | 740 | 4,581 | 68,479 | >5 s |
| Standard, combat-log check | 6 | 4,305 | 458 | 4,763 | 71,209 | >5 s |
| Luck Averaged | 1–3 | 3,929 | 600 | 4,529 | 67,699 | `?` |

The six Standard values vary from 62,939 to 72,957 DPS; the three Luck Averaged reads repeat at the displayed precision. For each result, DPS divided by the displayed Raw + DoT per shot is approximately 14.95. In the Standard combat log, projectile hits begin at 0.02s and recur at about 0.05–0.07s intervals; ammo decreases once per volley despite multiple projectile-hit entries. The log's visible first volleys reduce ammo 75 → 74 → 73. These observations fit a short-window magazine limit: at 18.20 attacks/s, 75 rounds are consumed in about 4.1s, and a 2.15s reload cannot complete before the five-second endpoint, yielding about 15 fired volleys per five-second window. The readout arithmetic therefore appears to use the realized short-window attack count for this ammo-limited build instead of multiplying by the displayed attack speed alone.

This interpretation is supported by visible stats and a partial combat log, not by an independently runnable Underframe engine. The 5,073-item log was virtualized to its first 500 entries, and Luck Averaged mode explicitly says it does not generate a combat log. Do not generalize the ≈14.95 conversion to other weapons, ammo settings, fire modes, or denominators, and do not infer how status ticks, residual DoTs, kills, or the private Auto Build objective are aggregated. The page remains a different weapon class from Gram, but it still does not establish native score parity.

### Custom maintained-stack fixed-window correction and Braton replay (2026-11-23; bounded, read-only capture plus offline rescore)

Reproduce the offline rescore with `npx tsx scripts/compareUnderframeFixedWindowDps.ts --weapon="Braton Prime" --runs=1 --state=custom --stacks=5`.

Offline replay of the captured Braton Prime list exposed a Tenno-Hub scoring mismatch: `getFixedWindowScoringEffects` removed event-triggered conditional effects for every state except Fully Stacked, even when Custom explicitly supplied a nonzero maintained-stack snapshot. With Braton Prime / Normal Attack against Grineer / 2,000,000 Health / 3,000 Armor, the captured eight-mod list and Custom 5 state initially scored 5,964.6127 Avg DPS / 29,823.06 applied damage / 75 attacks, identical to Initial. The fix now preserves event-triggered effects for Fully Stacked and nonzero Custom states; Custom 0 and other states still start those triggers inactive. The UI and script explain that a Custom snapshot is held for the full window without simulating how stacks were earned or expired.

After the correction, the unchanged captured list scores 60,374.3178 DPS / 301,871.5892 applied damage / 75 attacks and does not kill the target. This is 4.1% below the lowest of six noisy Standard reads (62,939 DPS) and 10.8% below the repeated Luck Averaged read (67,699 DPS). A Tenno-Hub `windowDps` optimization under the same Custom 5 state returns 108,903.6702 DPS in 5,131.6ms from 317 candidates, at 59/60 capacity and three Forma. The native Underframe list was not re-optimized at 2,000,000 Health; this does not compare native Auto Build results. It is a bounded common-model rescore and readout correlation, not simulator parity, gameplay validation, or a conclusion about Underframe's score denominator.

Focused regression checks Initial, Custom 0, Custom 5, and Fully Stacked; it verifies Custom 0 equals Initial, Custom 5 increases the fixed-window score, and Custom 5 equals Fully Stacked for Galvanized Chamber and Galvanized Aptitude. The focused `fixed-window DPS objective` test selection passed 11/11 (21.01s); app/test TypeScript, focused ESLint, a 987-module temporary Vite build, and CRLF-aware diff check passed. PR [#337](https://github.com/Appl3Tree/Tenno-Hub/pull/337) merged as squash commit `74d2f708e488c3fc0ebb257e0b87e42dfbe97f17`. Pages run [#419](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45208072525) succeeded at main commit `90c4f56`, which includes the fix. Current-source visual review was not run. The saved Underframe build was not edited; only its previously recorded target Health was temporarily changed during the earlier read-only capture and restored. The private engine, event history, and native Auto Build semantics remain open.

### Custom-stack optimizer-level regression (2026-11-23; bounded consistency check)

The follow-up optimizer regression sends Custom 5 through the same full-catalog Braton Prime / Normal Attack / Grineer / 2,000,000 Health / 3,000 Armor fixture used by the readout replay. The legal 8-slot / up-to-three-Forma optimizer result includes Galvanized Chamber and Galvanized Aptitude, and an independent `debugEvaluateFixedWindowDps` replay reproduces both the optimizer's DPS and total five-second damage. The focused test passes 1/1 (7.82s); test-project TypeScript, focused ESLint, and CRLF-aware diff check pass. This verifies Tenno-Hub candidate scoring honors the Custom snapshot; it is not an Underframe Auto Build comparison, native optimizer parity, or a global-optimality proof. No application code or deployment changed.

### Braton Custom 5 captured-list pair samples (2026-11-23; bounded)

The pair-sample runner accepts a Custom stack snapshot and echoes the selected mode/stacks in its JSON result. The capture is preserved in `scripts/fixtures/underframeBratonFixedWindowCapture.json`. Reproduce each seed with:

```sh
npx tsx scripts/auditFixedWindowDpsPairSample.ts --weapon="Braton Prime" --attack="Normal Attack" --samples=1024 --seed=20261159 --faction=Grineer --health=2000000 --shields=0 --overguard=0 --armor=3000 --state=custom --stacks=5 --baseline-file=./scripts/fixtures/underframeBratonFixedWindowCapture.json
npx tsx scripts/auditFixedWindowDpsPairSample.ts --weapon="Braton Prime" --attack="Normal Attack" --samples=1024 --seed=20261160 --faction=Grineer --health=2000000 --shields=0 --overguard=0 --armor=3000 --state=custom --stacks=5 --baseline-file=./scripts/fixtures/underframeBratonFixedWindowCapture.json
```

Both seeds use the deterministic `[0,5s)` single-target score, hold Custom 5 stacks throughout, and preserve the captured eight-mod baseline at 60/60 capacity with three Forma. The baseline scores 60,374.3178 DPS / 301,871.5892 damage. Each run sampled and exact-scored 1,024 legal max-rank two-out/two-in moves from a 46,284 raw-tuple universe; seed 20261159 examined 3,121 raw tuples and found 11 improvements, while seed 20261160 examined 3,129 and found seven. Their best sampled pairs score 88,130.5429 DPS (High Voltage + Primed Bane of Grineer → Magnetic Capacity + Wildfire) and 87,246.3318 DPS (High Voltage + Primed Bane of Grineer → Thermite Rounds + Wildfire), respectively. The full-pool optimizer returned the same 108,903.6702 DPS build in both runs, legal at 59/60 capacity and three Forma after 317 candidates. The seed samples can overlap and do not exhaust the legal pair neighborhood; the two improvement counts are per run, not unique combined candidates.

This is a Tenno-Hub neighborhood audit under an explicit static stack snapshot, not a claim about Underframe's native Auto Build objective. The original native list was not re-optimized at 2,000,000 Health, the private engine remains unavailable, and trigger history/expiry are not simulated. The runner now applies a supplied `--attack-distance` to both range-conditioned effects and the selected attack's falloff. A wiring smoke on a synthetic Mausolon Archwing profile/list produced 18,731.1592 DPS at 1,000m and 16,142.4196 DPS at 2,000m; this confirms distance reaches the falloff scorer, not an Underframe result.

### Exhaustive Braton Custom 5 pair neighborhoods (2026-11-23; bounded)

The pair-sample runner stops only after it has scored the requested number of legal unique builds or examined the complete raw tuple universe. Requesting 50,000 samples exhausts all 46,284 raw tuples for these eight-mod baselines. For the captured Underframe list:

```sh
npx tsx scripts/auditFixedWindowDpsPairSample.ts --weapon="Braton Prime" --attack="Normal Attack" --samples=50000 --seed=20261159 --faction=Grineer --health=2000000 --shields=0 --overguard=0 --armor=3000 --state=custom --stacks=5 --baseline-file=./scripts/fixtures/underframeBratonFixedWindowCapture.json
```

The run scored all 15,298 legal unique two-out/two-in builds around the 60,374.3178 DPS / 301,871.5892 damage captured list and found 116 improvements. Its best pair removes High Voltage and Vile Acceleration and adds Spring-Loaded Chamber and Wildfire, scoring 108,767.9816 DPS / 543,839.9081 damage. The full-pool optimizer independently returns the same legal 108,903.6702 DPS / 544,518.3510 damage build (59/60 capacity, three Forma).

The optimizer build is preserved as `scripts/fixtures/tennohubBratonFixedWindowOptimizerCustom5.json` to audit its own exact legal two-mod neighborhood:

```sh
npx tsx scripts/auditFixedWindowDpsPairSample.ts --weapon="Braton Prime" --attack="Normal Attack" --samples=50000 --seed=20261161 --faction=Grineer --health=2000000 --shields=0 --overguard=0 --armor=3000 --state=custom --stacks=5 --baseline-file=./scripts/fixtures/tennohubBratonFixedWindowOptimizerCustom5.json
```

That run exact-scored all 16,146 legal unique pairs from the same 46,284 raw tuples and found no improvement over the optimizer baseline. Its best legal pair scores 108,767.9816 DPS, 135.6886 DPS below the baseline. These exhaust only the legal max-rank two-out/two-in neighborhoods around the named builds under `[0,5s)`, Grineer / 2,000,000 Health / 3,000 Armor / Custom 5. They do not cover one-mod, three-mod, rank, Arcane, Forma, alternate-state, or alternate-target changes, and establish no global optimum, native Underframe objective, or gameplay result. The exhaustive follow-up was released in PR [#343](https://github.com/Appl3Tree/Tenno-Hub/pull/343), squash merge `d3939b1c670f7d7b75fc7f748f939020e5f23341`; PR #342 contains the earlier capture tooling and seeded samples.

The next slower single-shot probe was unavailable in the current saved-build session; see the availability check below. Preserve Standard and Luck Averaged reads separately and leave the private-engine boundary open.

### Slower-profile availability check (2026-11-23; read-only, not scored)

The saved Lex Prime route `/Codex-Matched-Corpus-Lex-Prime` redirected to Underframe's build list; the current session's saved-build inventory contains no Lex page. The existing Mausolon page exposes a Charged Shot Laser row with 0.57 effective fire rate and a listed 300.2m range, but its shared distance slider is locked to 1,400–2,800m for the page's Auto falloff controls. Attempting to set 250m was rejected by the slider, so no charged-shot result was run. The transient target Health change was restored to 100,000; the slider remained at its original 1,400m, and no build was saved or edited.

The saved Mausolon page therefore cannot supply an in-range slower-shot denominator probe, and the Lex route is unavailable in this browser session. Keep the Underframe readout-semantics gap open. Resume this branch of the probe only with an accessible profile whose distance control permits a source-backed in-range single-target comparison; continue independent planner mechanics, optimizer, and performance work in the meantime.

## D3-OPT-UNDERFRAME-CEDO-READOUT-001 — Tenno-Hub result in Underframe's Luck Averaged scorer (2026-11-18; bounded)

The integrated in-app browser duplicated `/Codex-Matched-Corpus-Cedo` as `/Codex-Matched-Corpus-Cedo-Copy` so the captured Auto Build result stayed intact. The duplicate retained Cedo / Shotgun / Normal Attack, the Grineer 100,000 Health / 3,000 Armor target, five-second simulation, Catalyst, no headshots, and no external statuses/buffs. Its eight mods were set to Tenno-Hub's returned Expected TTK list: Frail Momentum R5, Galvanized Hell R10, Primed Chilling Grasp R10, Toxic Barrage R3, Scattering Inferno R3, Blaze R3, Shotgun Barrage R5, and Galvanized Savvy R10.

After Auto Polarize the duplicate was capacity-valid at 3/60, but displayed four Forma, exceeding the original Auto Build setting of three Forma and Tenno-Hub's reported two-Forma plan. On Underframe's five-second Luck Averaged DPS readout, the duplicate showed 3,119 raw + 3 DoT average damage per shot, 34,507 average DPS, and `? ttk`. The captured Underframe list's same readout was 38,091 average DPS / 2.74 s. The Tenno-Hub list was therefore 3,584 DPS (9.4%) lower on this readout. The source audit documents that the separate Underframe readout scores eight seeded runs; this does not change the fact that Tenno-Hub selected its list under finite Expected TTK.

This is a same-readout rescore. The original four-Forma Auto Polarize result did not find the best polarity layout: the bounded source-backed plan below fits the same mod/rank list at two Forma and 59/60, within the three-Forma setting. Until that plan is applied and captured in the UI, describe capacity as computed feasible and placement as unverified. In Tenno-Hub's own finite Expected TTK model, the same returned list scores 2.6110 s versus 5.3176 s for the captured list. This records one objective tradeoff and neither establishes optimizer-objective parity nor simulator/gameplay accuracy. The original Underframe capture was not edited. The screenshot was visible during integrated-browser inspection but was not saved as a file artifact.


## D3-OPT-UNDERFRAME-CEDO-FORMA-001 — source-backed capacity feasibility (2026-11-18; bounded)

The exact Tenno-Hub Cedo mod/rank list fits Underframe's 60-capacity limit with two added Forma, below the original three-Forma cap. Underframe's public [capacity.js](https://github.com/NevermindNilas/underframe-desktop/blob/fe38d07f3515a995a068015314ad85acc65bef61/src/shared/capacity.js) confirms base drain is base drain plus rank and a matching polarity halves positive drain rounded up. On the duplicate's displayed slot order, slots 3 and 8 already have Madurai. Adding Vazarin in slots 1 and 7 yields:

| Displayed slot | Mod | Raw drain | Planned slot polarity | Effective drain |
| ---: | --- | ---: | --- | ---: |
| 1 | Primed Chilling Grasp R10 | 16 | Vazarin (new Forma) | 8 |
| 2 | Toxic Barrage R3 | 7 | Unpolarized | 7 |
| 3 | Galvanized Hell R10 | 16 | Madurai (native) | 8 |
| 4 | Blaze R3 | 9 | Unpolarized | 9 |
| 5 | Shotgun Barrage R5 | 9 | Unpolarized | 9 |
| 6 | Scattering Inferno R3 | 7 | Unpolarized | 7 |
| 7 | Galvanized Savvy R10 | 12 | Vazarin (new Forma) | 6 |
| 8 | Frail Momentum R5 | 9 | Madurai (native) | 5 |
| **Total** |  | **85** | **2 new Forma** | **59 / 60** |

At reset, the same slot order with only the two native Madurai slots drains 73/60; the plan saves 8+6=14 capacity. A Node check against the checked-in catalog metadata reproduced the raw drains, 73/60 reset total, 59/60 planned total, and two changes. This establishes a feasible capacity/polarity arrangement under the public rule; it does not establish that the arrangement was applied in Underframe's UI. The duplicate remains at 0 Forma / -13/60 after the integrated-browser interaction stalled on a confirmation prompt. The original captured Underframe build remains untouched. Reopen the capacity conclusion only if a fresh UI rejects this placement, the displayed slot order/polarities differ, or the catalog inputs change.


## D3-OPT-UNDERFRAME-AVG-DPS-OBJECTIVE-001 — fixed-window objective corpus (2026-11-20; released and browser-verified)

Reproduce with `npx tsx scripts/compareUnderframeFixedWindowDps.ts --runs=3`. It scores captured Cedo, Lex Prime, and Broken War Auto Build lists and runs the Tenno-Hub optimizer under the same target and objective. All cases use Grineer / 100,000 Health / 3,000 Armor / zero Shields and Overguard, Realistic conditionals, Normal Attack, eight normal slots, max-rank mods, Catalyst, at most three Forma, and no Exilus or Arcane. The fixed objective is applied single-target damage divided by five seconds over the half-open interval `[0, 5s)`. Hits are clipped to remaining defense pools; overkill and damage after death contribute nothing; events at exactly five seconds are excluded. On-kill stacks begin at zero and the target does not reset. Area collateral and Broken War's Lone Vengeance stance sequence / evolving combo are not included.

| Fixture | Captured list: Tenno-Hub score | Tenno-Hub 5s Avg DPS result | Shared-model change | Exact candidates; optimizer time | Legality |
| --- | ---: | ---: | ---: | --- | --- |
| Cedo / Shotgun | 14,638.7 DPS (73,193.6 damage; 40 attacks) | 20,000.0 DPS (100,000 damage; 4.8097 s TTK diagnostic) | +36.6% | 85; 3,802–4,456 ms | Result 57/60, 3 Forma; captured list 60/60 under Tenno-Hub's modeled polarity plan. Underframe UI showed 0/60, 3 Forma after Auto Polarize. |
| Lex Prime / Secondary | 8,568.5 DPS (42,842.4 damage; 14 attacks) | 20,000.0 DPS (100,000 damage; 3.3654 s TTK diagnostic) | +133.4% | 133; 4,302–4,868 ms | Result 59/60, 3 Forma; captured list 60/60 under Tenno-Hub's modeled polarity plan. Underframe UI showed 1/60, 3 Forma after Auto Polarize. |
| Broken War / Melee | 4,296.2 DPS (21,480.8 damage; 7 attacks) | 7,068.7 DPS (35,343.4 damage; no kill in window) | +64.5% | 229; 6,767–7,264 ms | Result 60/60, 3 Forma; captured list 59/60 under Tenno-Hub's modeled polarity plan. Underframe UI showed 5/60, 2 Forma after Auto Polarize. |

Each optimizer returned an identical mod list and score in all three repetitions. The Cedo and Lex 20,000 DPS results reach the objective ceiling of target health / window duration; their faster TTK values are diagnostic and do not break score ties. The captured-list capacity entries are recalculations with Tenno-Hub's polarity planner, not reproductions of Underframe's displayed Auto Polarize layout.

Underframe's public source documents seeded five-second mean-`avgDps` ranking, but its private damage engine is unavailable for independent execution. Tenno-Hub's scorer is deterministic and mean-field; it is not Underframe's stochastic simulator. This is a same-window, same-objective common-model comparison, not damage-engine parity, global optimizer optimality, or gameplay validation. The integrated browser could not reach the supplied local preview (`http://localhost/Tenno-Hub/`; `ERR_CONNECTION_TIMED_OUT`) and blocks `file:` URLs. After PR [#173](https://github.com/Appl3Tree/Tenno-Hub/pull/173) merged as `ec476039`, Pages run #253 built and uploaded the site but failed at deploy when its artifact lookup returned no artifact; its same-run retry found duplicate artifacts. Follow-up PR [#174](https://github.com/Appl3Tree/Tenno-Hub/pull/174) triggered fresh Pages run [#254](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/44843909526), which succeeded. On the cache-busted production page (`?probe=20261120-1730&version=0295de9`), the integrated browser verified the `5s Avg DPS` selector and explanation. A Cedo build against Grineer / 100,000 Health / 3,000 Armor / Realistic state with Catalyst and up to three Forma returned eight mods at 57/60, three Forma, and 20,000 modeled DPS (100,000 applied damage / 5s); the explanation shows a 4.81s kill diagnostic and explicitly excludes overkill, endpoint events, and neighboring collateral. The Tazicor model-local one-mod audit is recorded below; one-mod audits for the captured Cedo, Lex Prime, and Broken War lists, further weapon/target coverage, and cold/mobile latency remain open.

## D3-OPT-FIXED-WINDOW-COMPANION-001 — Tazicor fixed-window one-mod neighborhood (2026-11-20; bounded local-model audit)

Reproduce with `npx tsx scripts/auditFixedWindowDpsFullPool.ts --weapon=Tazicor --attack='Normal Attack' --runs=3`. The fixture uses Tazicor / Companion / Normal Attack, Grineer / 100,000 Health / 3,000 Armor / zero Shields and Overguard, Realistic state, eight normal slots, max-rank mods, Catalyst, up to three Forma, and no Exilus or Arcane. It uses Tenno-Hub's deterministic single-target applied damage over `[0, 5s)`; the target is not killed, so the objective is uncapped at 2,625.3 DPS (13,126.5 damage). The optimizer returned a legal 59/60 build using three Forma and selected Heavy Caliber R10, Infected Clip R5, High Voltage R3, Thermite Rounds R3, Radiated Reload R3, Serration R10, Galvanized Chamber R10, and Vile Acceleration R5.

| Repetitions | Candidate pool / eligible full-pool candidates | Exact optimizer candidates | Exact legal one-mod neighbors | Baseline | Best neighbor | Build legality |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| 3 identical builds and scores | 107 / 62 | 133 per run | 280 | 2,625.3 DPS | 2,494.3 DPS (Heavy Caliber → Primed Bane of Grineer; a Serration → Primed Bane replacement ties) | 59/60, 3 Forma |

Run times were 3,694.9, 3,959.8, and 5,365.4 ms (median 3,959.8 ms; maximum 5,365.4 ms). The independent fixed-window scorer reproduced the optimizer score; none of the 280 exact legal add/remove/replacement neighbors improved it. Replacements and additions use max-rank candidates; each candidate set is deduplicated and must satisfy mod identity/incompatibility rules, capacity assignment, and the three-Forma limit. This is a bounded one-mod local result, not global optimality.

This is a Tenno-Hub model audit only; no Underframe Tazicor Auto Build was captured. The checked-in Tazicor catalog stats were not independently Wiki-audited for this run. The weapon-only score does not represent Companion precepts, target acquisition, range, hit probability, other enemies, or the private Underframe engine, so it is not Underframe parity or live-game validation. PR [#176](https://github.com/Appl3Tree/Tenno-Hub/pull/176) merged the audit script and Tazicor record as `544b348b274bf2ffdf343c83756505f5e68630d6`; Pages run [#256](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/44847760513) succeeded. Follow-up: capture an Underframe-supported Arch-Gun or Companion build under the same target/repeat protocol, and compare the native output with this fixed-window scorer; if no candidate is supported, select a source-verified Arch-Gun fixture and record the limitation.

## D3-OPT-FIXED-WINDOW-BROKEN-WAR-NEIGHBOR-001 — Broken War fixed-window one-mod neighborhood (2026-11-20; bounded local-model audit)

Reproduce with `npx tsx scripts/auditFixedWindowDpsFullPool.ts --weapon='Broken War' --attack='Normal Attack' --runs=3`. This uses the same Grineer / 100,000 Health / 3,000 Armor / zero Shields and Overguard / Realistic / eight normal slots / max-rank / Catalyst / up-to-three-Forma / no Exilus or Arcane setup as the fixed-window corpus. It scores deterministic applied damage over `[0, 5s)`. The target survives the window, so the 7,068.6846 DPS result (35,343.4228 damage) is uncapped.

| Repetitions | Candidate pool / eligible candidates | Exact optimizer candidates | Exact legal one-mod neighbors | Baseline | Best neighbor | Build legality |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| 3 identical builds and scores | 110 / 62 | 229 per run | 286 | 7,068.6846 DPS | 6,837.7235 DPS (Volcanic Edge → Melee Prowess) | 60/60, 3 Forma |

The optimizer's list was Primed Pressure Point R10, Carnis Mandible R5, Volcanic Edge R3, Primed Smite Grineer R10, Galvanized Elementalist R10, Galvanized Steel R10, Organ Shatter R5, and Primed Fury R10. Run times were 3,133.2, 3,158.1, and 3,668.1 ms (median 3,158.1 ms; maximum 3,668.1 ms). Independent fixed-window scoring reproduced the optimizer score, and none of the 286 exact legal one-mod add/remove/replacement neighbors improved it.

This audits the optimizer baseline, not the captured Underframe list's neighborhood. The model uses a generic melee Normal Attack; it omits Broken War's Lone Vengeance stance sequence and evolving combo history. Capacity is checked for eight normal slots without an extra stance slot. The result is bounded to Tenno-Hub's deterministic model and is not Underframe or gameplay parity. Exact audits of captured-list neighborhoods, a matched Arch-Gun/Companion capture, and broader targets remain open.

## D3-OPT-WINDOW-DPS-CORPUS-001 — seeded fixed-window full-pool neighborhood and shortlist correction (2026-11-21; released and deployed)

Reproduce the fixture selection and exact legal one-mod audit with:

```sh
npx tsx scripts/auditFixedWindowDpsCorpus.ts --seed=20261144 --runs=1
```

The seeded corpus uses eight fixed anchors plus one uniformly selected weapon from each of four listed strata, using Mulberry32 in a fixed order. The targets are Grineer / 2,000,000 Health / 3,000 Armor / zero Shields and Overguard, Realistic state, and a half-open `[0,5s)` score window. Each run uses eight normal slots, Catalyst, MR30, max-rank candidates, up to three Forma, and no Exilus or Arcane optimization. `scripts/auditFixedWindowDpsFullPool.ts` validates the returned build and independently scores every legal one-mod add/remove/replacement at max rank under the same target and distance setting. All 12 targets survive the five-second window, so the reported value is applied damage divided by five seconds rather than TTK.

The first full-pool pass found two exact legal one-mod improvements. The optimizer now uses its single-target `windowDps` proxy to rank both one-mod and paired proposals, reserves a second incoming candidate in the multishot and critical families, and allows seven refinement passes with a core shortlist of up to 44 single-mod proposals (plus the pre-existing bounded outgoing-family supplements). Expected TTK retains its existing six-pass / 40-proposal core budget. The Braton move replaces Galvanized Chamber with Split Chamber. The Laetum move replaces Hornet Strike with Primed Target Cracker.

| Category | Weapon / attack | Distance | Baseline | Capacity | Exact legal one-mod neighbors | Best exact neighbor | Improvement |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- |
| Rifle | Braton Prime / Normal Attack | — | 30,707.94 DPS | 60/60, 3 Forma | 226 | 30,707.94 (Heavy Caliber → Serration) | No |
| Hybrid shotgun | Cedo / Normal Attack | — | 29,769.16 DPS | 58/60, 3 Forma | 359 | 28,951.55 (Vigilante Armaments → Primed Ravage) | No |
| Incarnon secondary | Laetum / Normal Attack | — | 56,869.97 DPS | 60/60, 3 Forma | 286 | 50,748.09 (Primed Expel Grineer → Hornet Strike) | No |
| Spooling rifle | Soma Prime / Fully Spooled | — | 45,602.16 DPS | 57/60, 3 Forma | 414 | 45,602.16 (Heavy Caliber → Serration) | No |
| Melee | Broken War / Normal Attack | — | 5,071.25 DPS | 56/60, 3 Forma | 379 | 4,946.70 (Organ Shatter → Amalgam Organ Shatter) | No |
| Beam secondary | Kuva Nukor / Normal Attack | — | 61,237.29 DPS | 72/80, 3 Forma | 436 | 59,028.21 (Barrel Diffusion → Amalgam Barrel Diffusion) | No |
| Bow | Nataruk / Perfect Shot | — | 110,066.83 DPS | 51/60, 3 Forma | 403 | 110,066.83 (Heavy Caliber → Serration) | No |
| Incarnon explosive | Torid / Grenade Impact | — | 10,876.37 DPS | 60/60, 3 Forma | 295 | 10,876.37 (Heavy Caliber → Serration) | No |
| Explosive primary (seeded) | Kuva Ogris / Rocket Explosion | — | 42,749.00 DPS | 59/80, 3 Forma | 450 | 42,310.22 (Thermite Rounds → Heavy Caliber) | No |
| Archgun (seeded) | Mausolon (Archwing) / Auto | 250m | 210,027.96 DPS | 59/60, 3 Forma | 139 | 205,644.26 (Parallax Scope → Magnetized Cycle) | No |
| Companion weapon (seeded) | Verglas Prime / Normal Attack | — | 30,095.76 DPS | 59/60, 3 Forma | 264 | 29,129.14 (Heavy Caliber → Split Chamber) | No |
| Heavy melee (seeded) | Arca Titron / Heavy Slam Attack | — | 56,005.31 DPS | 54/60, 3 Forma | 412 | 54,814.78 (Volcanic Edge → Molten Impact) | No |

After the correction, the one-run corpus contains 4,063 exact legal neighbors and no improvement over any returned baseline. The Mausolon distance is 250m, inside its Wiki-listed 300m maximum and inside the separate Archwing direct falloff profile. An omitted distance for other rows uses their catalog profile's full-damage default; the reported maximum range is not treated as a no-hit cap. The script now reports rank-40 capacity correctly for Kuva weapons (80 with Catalyst).

A second seeded run, `npx tsx scripts/auditFixedWindowDpsCorpus.ts --seed=20261145`, selected Tenet Envoy / Rocket Explosion, Corvas Prime / Charged Shot, Verglas Prime / Normal Attack, and Arca Titron / Heavy Slam Attack for the four randomized strata. All four and the eight fixed-anchor baselines were legal; exact scoring found no improving one-mod neighbor in any case. The run scored 4,091 legal neighbors (2,798 across the fixed anchors and 1,293 across the four seeded fixtures), bringing the two-seed total to 8,154 across 24 fixture-runs.

| Seeded stratum | Weapon / attack | Baseline | Exact legal one-mod neighbors | Improving neighbors |
| --- | --- | ---: | ---: | ---: |
| Explosive primary | Tenet Envoy / Rocket Explosion | 41,392.47 DPS | 434 | 0 |
| Archgun | Corvas Prime / Charged Shot | 134,573.95 DPS | 183 | 0 |
| Companion weapon | Verglas Prime / Normal Attack | 30,095.76 DPS | 264 | 0 |
| Heavy melee | Arca Titron / Heavy Slam Attack | 56,005.31 DPS | 412 | 0 |

This second seed adds category coverage under the same single faction, target, state, and objective. It does not test two-mod moves, Underframe's native objective, alternate targets, or live-game accuracy.

Three repeated full-pool runs returned identical lists and scores for the two corrected cases. Braton Prime returned 30,707.94 DPS at 60/60 and three Forma in 5,191.7 / 3,855.0 / 4,024.8ms (median 4,024.8ms; maximum 5,191.7ms). Laetum returned 56,869.97 DPS at 60/60 and three Forma in 4,489.1 / 3,489.0 / 3,285.5ms (median 3,489.0ms; maximum 4,489.1ms). These are in-process desktop optimizer timings, not browser, Worker, mobile, cold-start, or tail-latency measurements. Focused regressions pass 2/2. PR [#186](https://github.com/Appl3Tree/Tenno-Hub/pull/186) merged as `2429af4c085c72670ad30dfbc9463b8e82f7146c`; Pages deployment [run #44893796864](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/44893796864) succeeded. The cache-busted published page rendered Build Planner and the `5s Avg DPS` selector in the integrated browser; this smoke check did not run optimizer scoring. The supplied localhost page responds with older build `2bf6faea`, so it is not evidence for this release.

Validation passes: full serial suite 831/831 across 54 files (optimizer file 156/156); app TypeScript/production build; node TypeScript; source validation; prerequisite audit (162 entries, no unresolved references or cycles); mod-effect audit (695 weapons / 600 eligible / 492 parsed / 108 without effects / 70 review / 18 partial / 52 unparsed / zero empty pools); focused ESLint; and CRLF-aware diff check. The production build retains its existing Vite large-chunk warning. This change touches optimizer scoring and audit scripts only; no UI layout changed. The deployment and limited published-page smoke check are recorded above. PR/release is complete; no optimizer interaction was run in the browser.

These are bounded Tenno-Hub model-local one-mod results, not exhaustive multi-mod search, Underframe objective parity, global optimality, Companion AI/range validation, spatial coverage, or gameplay accuracy. Melee stance/combo sequence, Incarnon activation histories, status randomness, and Underframe's private sampling engine remain model boundaries. Continue with other seeds/targets and compare captured Underframe outputs under the same fixed-window objective before claiming broad optimizer quality.

### Seeded two-mod pair sample

Reproduce the seeded legal two-out/two-in sample with:

```sh
npx tsx scripts/auditFixedWindowDpsPairSample.ts --seed=20261145 --samples=1024
```

The runner uses the same eight fixed anchors and four seed-selected fixtures as the fixed-window corpus for seed `20261145`. It samples 1,024 legal max-rank two-mod replacements per fixture without replacement from outgoing-pair × eligible full-catalog incoming-pair tuples. Each accepted build must pass compatibility, modeled-effect, duplicate-identity, capacity, and three-Forma checks before exact deterministic single-target scoring over `[0,5s)`. The target remains Grineer / 2,000,000 Health / 3,000 Armor, Realistic, eight slots, Catalyst, and up to three Forma; the Mausolon Archwing fixture carries its 250m distance.

| Fixture | Baseline | Best sampled score | Best sampled move | Raw tuples examined | Sampled improvements |
| --- | ---: | ---: | --- | ---: | ---: |
| Braton Prime / Normal Attack | 30,707.94 DPS | 25,640.24 DPS | Primed Bane of Grineer + Magnetic Capacity → Hammer Shot + Wildfire | 2,893 | 0 |
| Cedo / Normal Attack | 29,769.16 DPS | 27,335.31 DPS | Vigilante Armaments + Shotgun Barrage → Amalgam Shotgun Barrage + Blaze | 1,676 | 0 |
| Laetum / Normal Attack | 56,869.97 DPS | 42,780.74 DPS | Creeping Bullseye + Primed Target Cracker → Magnetic Might + Primed Pistol Gambit | 2,186 | 0 |
| Soma Prime / Fully Spooled | 45,602.16 DPS | 38,881.12 DPS | Wildfire + Vile Acceleration → Hellfire + Speed Trigger | 1,546 | 0 |
| Broken War / Normal Attack | 5,071.25 DPS | 3,740.59 DPS | Carnis Mandible + Primed Fury → Gladiator Might + Gladiator Vice | 1,604 | 0 |
| Kuva Nukor / Normal Attack | 61,237.29 DPS | 46,274.58 DPS | Lethal Torrent + Barrel Diffusion → Anemic Agility + Galvanized Diffusion | 1,455 | 0 |
| Nataruk / Perfect Shot | 110,066.83 DPS | 76,265.37 DPS | Vital Sense + Hellfire → Hunter Munitions + Rifle Elementalist | 1,590 | 0 |
| Torid / Grenade Impact | 10,876.37 DPS | 9,643.73 DPS | Hellfire + Vigilante Armaments → Bane of Grineer + Thermite Rounds | 1,728 | 0 |
| Tenet Envoy / Rocket Explosion | 41,392.47 DPS | 38,870.89 DPS | Hellfire + Heavy Caliber → Amalgam Serration + Thermite Rounds | 1,450 | 0 |
| Corvas Prime / Charged Shot | 134,573.95 DPS | 114,288.23 DPS | Automatic Trigger + Parallax Scope → Critical Focus + Magnetized Cycle | 2,041 | 0 |
| Verglas Prime / Normal Attack | 30,095.76 DPS | 24,807.10 DPS | Thermite Rounds + Primed Bane of Grineer → Vile Acceleration + Wildfire | 2,169 | 0 |
| Arca Titron / Heavy Slam Attack | 56,005.31 DPS | 42,888.45 DPS | True Steel + Organ Shatter → Amalgam Organ Shatter + Melee Elementalist | 1,449 | 0 |

Across the twelve fixtures, the run accepted 12,288 legal sampled pairs after examining 21,787 raw tuples; no sampled move improved its optimizer baseline. Rejected tuples include unsupported effects, incompatible or duplicate mods, and builds that fail capacity/Forma constraints. This is a seeded sample, not an exhaustive pair neighborhood. It covers one target faction, target profile, state, and objective, and does not validate Underframe's native Auto Build objective, alternate target conditions, live-game damage, or global optimizer quality. The reproducible worker and corpus runner are in `scripts/auditFixedWindowDpsPairSample.ts`.

### Armor-sensitivity sample with target overrides

The pair-sample runner accepts `--faction`, `--health`, `--shields`, `--overguard`, and `--armor` integer options; defaults preserve the original Grineer / 2,000,000 Health / 0 Shields / 0 Overguard / 3,000 Armor fixture. Seed `20261146` selected Tenet Envoy / Rocket Explosion, Mausolon (Archwing) / Auto, Verglas Prime / Normal Attack, and Arca Titron / Heavy Slam Attack for the four seeded strata, alongside the same eight fixed anchors. The Mausolon sample keeps the corpus's 250m distance.

I first tried these armor values at 2,000,000 Health. That exploratory run reached the score ceiling for Mausolon and, at zero Armor, Nataruk, so I excluded it from the comparison below. The final runs raise Health to 10,000,000 to keep every optimizer and best-sampled result below the five-second damage cap:

```sh
npx tsx scripts/auditFixedWindowDpsPairSample.ts --seed=20261146 --samples=1024 --armor=500 --health=10000000
npx tsx scripts/auditFixedWindowDpsPairSample.ts --seed=20261146 --samples=1024 --armor=0 --health=10000000
```

Both use Grineer, 0 Shields, 0 Overguard, Realistic state, eight slots, Catalyst, max-rank replacements, and up to three Forma. Each run scored 12,288 legal two-out/two-in pairs. The 500-Armor run examined 23,038 raw tuples; the zero-Armor run examined 21,935. No sampled pair improved its optimizer baseline. The largest baseline score in either run applied 3,587,175 damage in five seconds, below the 10,000,000 Health cap.

| Fixture | 500 Armor baseline / best sampled DPS | 0 Armor baseline / best sampled DPS | Improvements in either sample |
| --- | ---: | ---: | ---: |
| Braton Prime / Normal Attack | 62,371.08 / 59,947.85 | 95,853.11 / 78,056.99 | 0 |
| Cedo / Normal Attack | 145,547.95 / 112,734.39 | 237,551.09 / 183,995.57 | 0 |
| Laetum / Normal Attack | 139,155.59 / 102,882.62 | 211,288.68 / 158,981.08 | 0 |
| Soma Prime / Fully Spooled | 132,512.74 / 109,912.40 | 215,589.48 / 179,054.75 | 0 |
| Broken War / Normal Attack | 20,741.19 / 17,359.91 | 33,282.48 / 27,876.78 | 0 |
| Kuva Nukor / Normal Attack | 150,622.81 / 122,674.51 | 245,711.55 / 220,080.38 | 0 |
| Nataruk / Perfect Shot | 330,402.68 / 299,066.06 | 528,743.42 / 479,052.31 | 0 |
| Torid / Grenade Impact | 28,358.80 / 24,494.00 | 41,686.66 / 38,813.68 | 0 |
| Tenet Envoy / Rocket Explosion | 181,293.78 / 147,725.32 | 295,892.42 / 241,104.81 | 0 |
| Mausolon (Archwing) / Auto | 528,051.45 / 503,636.83 | 717,435.02 / 608,774.77 | 0 |
| Verglas Prime / Normal Attack | 74,519.14 / 59,214.02 | 105,668.63 / 84,237.70 | 0 |
| Arca Titron / Heavy Slam Attack | 209,486.99 / 191,816.66 | 341,907.00 / 313,066.98 | 0 |

This changes one synthetic target parameter to isolate armor sensitivity; it does not represent named enemy profiles or establish gameplay accuracy. The sample remains bounded to one faction and one fixed-window objective, not exhaustive pair coverage, Underframe parity, or global optimizer quality. Node TypeScript, focused ESLint, and a 500-Armor worker smoke pass for the override support.

### Faction and shield sensitivity

The same seeded fixture selection (`20261147`) was sampled against two further synthetic profiles:

```sh
npx tsx scripts/auditFixedWindowDpsPairSample.ts --seed=20261147 --samples=1024 --faction=Corpus --health=10000000 --shields=10000000 --overguard=0 --armor=0
npx tsx scripts/auditFixedWindowDpsPairSample.ts --seed=20261147 --samples=1024 --faction=Infested --health=10000000 --shields=0 --overguard=0 --armor=0
```

Both runs selected Tenet Envoy / Rocket Explosion, Mausolon (Archwing) / Auto, Verglas Prime / Normal Attack, and Gram Prime / Heavy Slam Attack for the seeded strata. Corpus uses an explicit 10,000,000 Health + 10,000,000 Shields pool; Infested uses 10,000,000 Health and no Shields. Both use 0 Overguard, zero Armor, Realistic state, eight slots, Catalyst, max-rank replacements, and up to three Forma. The faction's other built-in status assumptions remain in effect; the explicit health-pool override is synthetic, and neighboring targets are not represented.

Each run sampled 12,288 legal pairs. The Corpus sample examined 23,921 raw tuples and the Infested sample examined 22,452. No sampled pair improved its optimizer baseline. The highest baseline applied 4,725,333 damage in five seconds, below the Infested target's 10,000,000 Health limit.

| Fixture | Corpus baseline / best sampled DPS | Infested baseline / best sampled DPS | Improvements in either sample |
| --- | ---: | ---: | ---: |
| Braton Prime / Normal Attack | 108,051.20 / 101,261.44 | 103,517.96 / 91,212.00 | 0 |
| Cedo / Normal Attack | 195,350.14 / 193,041.23 | 237,551.09 / 215,704.74 | 0 |
| Laetum / Normal Attack | 200,058.55 / 191,990.48 | 251,876.89 / 190,301.22 | 0 |
| Soma Prime / Fully Spooled | 212,539.67 / 167,982.17 | 228,805.32 / 202,641.65 | 0 |
| Broken War / Normal Attack | 25,330.13 / 21,663.06 | 37,234.42 / 30,444.60 | 0 |
| Kuva Nukor / Normal Attack | 289,469.89 / 241,424.95 | 280,164.65 / 231,658.77 | 0 |
| Nataruk / Perfect Shot | 528,743.42 / 492,615.69 | 550,902.18 / 475,506.43 | 0 |
| Torid / Grenade Impact | 42,760.04 / 38,246.67 | 43,340.42 / 42,346.14 | 0 |
| Tenet Envoy / Rocket Explosion | 295,892.42 / 248,029.22 | 295,892.42 / 244,815.89 | 0 |
| Mausolon (Archwing) / Auto | 759,555.59 / 611,823.26 | 945,066.68 / 831,216.38 | 0 |
| Verglas Prime / Normal Attack | 128,193.49 / 109,232.25 | 134,982.95 / 110,964.99 | 0 |
| Gram Prime / Heavy Slam Attack | 314,186.60 / 303,510.73 | 357,665.42 / 291,696.79 | 0 |

Across the seed-20261145 Grineer / 3,000-Armor sample, the two seed-20261146 Grineer armor points, and these seed-20261147 Corpus and Infested profiles, the current bounded corpus covers 61,440 legal sampled pairs across 60 fixture-runs from 113,133 raw tuples. No sample improved an optimizer baseline. The three factions and shield/armor variations broaden model-local coverage; the custom pools do not validate named-enemy values, spatial AoE, native Underframe behavior, or live gameplay. The script rejects noncanonical faction names and zero/invalid target Health; node TypeScript, focused ESLint, valid worker smoke, and invalid-input guards pass.

### Exact one-mod neighborhoods for Corpus and Infested

The full-pool runner now accepts the same `--faction`, `--health`, `--shields`, `--overguard`, and `--armor` target overrides. Reproduce the exact legal one-mod add/remove/replacement neighborhoods for the seed-`20261147` fixtures with:

```sh
npx tsx scripts/auditFixedWindowDpsCorpus.ts --seed=20261147 --runs=1 --faction=Corpus --health=10000000 --shields=10000000 --overguard=0 --armor=0
npx tsx scripts/auditFixedWindowDpsCorpus.ts --seed=20261147 --runs=1 --faction=Infested --health=10000000 --shields=0 --overguard=0 --armor=0
```

Each baseline is Auto Optimize's legal eight-slot / Catalyst / up-to-three-Forma `windowDps` build. The audit scores every eligible legal max-rank add, remove, or replacement around that baseline. It uses the same synthetic shielded Corpus and unarmored Infested pools as the pair sample; the faction's other built-in status assumptions remain active, but the custom pools are not named enemies. All baseline and best-neighbor scores remain below the 10,000,000 Health limit.

| Fixture | Corpus baseline | Corpus exact neighbors | Best Corpus neighbor | Infested baseline | Infested exact neighbors | Best Infested neighbor |
| --- | ---: | ---: | --- | ---: | ---: | --- |
| Braton Prime / Normal Attack | 108,051.20 DPS | 225 | 104,585.58 (Heavy Caliber → Primed Bane of Corpus) | 103,517.96 DPS | 321 | 103,517.96 (Heavy Caliber → Serration; ties baseline) |
| Cedo / Normal Attack | 195,350.14 DPS | 359 | 195,174.78 (Frail Momentum → Accelerated Blast) | 237,551.09 DPS | 348 | 237,551.09 (Shotgun Barrage → Amalgam Shotgun Barrage; ties baseline) |
| Laetum / Normal Attack | 200,058.55 DPS | 286 | 198,620.24 (Primed Expel Corpus → Hornet Strike) | 251,876.89 DPS | 286 | 227,563.96 (Primed Expel Infested → Hornet Strike) |
| Soma Prime / Fully Spooled | 212,539.67 DPS | 328 | 209,472.26 (Heavy Caliber → Vigilante Armaments) | 228,805.32 DPS | 328 | 225,504.57 (Serration → Vigilante Armaments) |
| Broken War / Normal Attack | 25,330.13 DPS | 336 | 25,134.57 (Gladiator Might → Magnetic Rush) | 37,234.42 DPS | 377 | 37,075.21 (Volcanic Edge → Molten Impact) |
| Kuva Nukor / Normal Attack | 289,469.89 DPS | 422 | 282,474.97 (Primed Pistol Gambit → Magnum Force) | 280,164.65 DPS | 436 | 269,907.92 (Barrel Diffusion → Amalgam Barrel Diffusion) |
| Nataruk / Perfect Shot | 528,743.42 DPS | 382 | 516,447.06 (Serration → Amalgam Serration) | 550,902.18 DPS | 382 | 538,090.51 (Serration → Amalgam Serration) |
| Torid / Grenade Impact | 42,760.04 DPS | 233 | 41,148.90 (Heavy Caliber → Primed Bane of Corpus) | 43,340.42 DPS | 231 | 42,558.23 (Radiated Reload → Rime Rounds) |
| Tenet Envoy / Rocket Explosion | 295,892.42 DPS | 413 | 288,762.48 (Serration → Amalgam Serration) | 295,892.42 DPS | 413 | 288,762.48 (Serration → Amalgam Serration) |
| Mausolon (Archwing) / Auto | 759,555.59 DPS | 139 | 658,430.53 (Parallax Scope → Containment Breach) | 945,066.68 DPS | 139 | 901,454.64 (Parallax Scope → Magnetized Cycle) |
| Verglas Prime / Normal Attack | 128,193.49 DPS | 278 | 126,627.96 (Critical Delay → Point Strike) | 134,982.95 DPS | 264 | 131,590.65 (Heavy Caliber → Split Chamber) |
| Gram Prime / Heavy Slam Attack | 314,186.60 DPS | 346 | 305,781.04 (Organ Shatter → Amalgam Organ Shatter) | 357,665.42 DPS | 346 | 348,096.63 (Organ Shatter → Amalgam Organ Shatter) |

Across the two target profiles, the exact audit scored 7,618 legal one-mod neighbors: 3,747 for Corpus and 3,871 for Infested. No neighbor improved its optimizer baseline. Together with the existing seed-20261144 / 20261145 Grineer one-mod corpora, the exact corpus now covers 15,772 legal neighbors across 48 fixture-runs with no improvements. This is still local evidence under selected target overrides; it is not global optimizer quality, Underframe parity, or gameplay validation. `auditFixedWindowDpsCorpus.ts` now validates canonical faction names and positive Health before invoking the full-pool worker.

### D3-UX-FIXED-WINDOW-FLOW-001 — mobile fixed-window objective and explanation smoke check (2026-11-21)

The cache-busted production planner (`version=2429af4`) was exercised in Codex's integrated in-app browser at 390×844. Selecting `5s Avg DPS`, choosing Braton Prime, and running Optimize Build kept that objective active and returned a legal four-mod configuration at 30/30 uncatalyzed capacity. “Why This Build” identified the Balanced synthetic target, reported 21,000 applied damage during `[0,5s)` / 4,200 DPS and a target defeat at 4.70s, and explained the score's limits: target-pool clipping, endpoint exclusion, no reset/on-kill trigger history, and deterministic mean-field estimates rather than Underframe's seeded sample mean. The objective controls wrapped to a second row without observed overlap at this width. Reset restored the empty 0/8 configuration and the temporary viewport was removed; no saved build was changed.

This verifies one production desktop-browser page at a narrow viewport, including objective selection, optimization, explanation, and reset. It is not physical-device coverage, a performance-tail measurement, a live-game result, or proof of Underframe score parity. The supplied localhost URL still served stale build `2bf6faea`, so this check used the published `2429af4` bundle.

## D3-OPT-UNDERFRAME-COMPANION-FIXTURE-DISCOVERY-001 — read-only Featured Builds search complete (2026-11-22; no legal comparator)

The read-only in-app-browser scan now covers all 11 public Featured Arch-Gun builds and all 3 Featured Beast Companion pages. The initial pass inspected Mausolon, Arbucep, Kuva Ayanga, Cortege, Dual Decurions, Pharaoh Predasite (mecha), and Huras. None supplied a legal, objective-scored pair; the Arch-Gun/Beast mod configurations were over capacity at zero Forma, and the Mausolon Stats panel did not expose a calculator result.

The remaining six Arch-Gun examples are Grattler (Kuva Grattler), Corvas, Corvas Prime, Morgha, Phaedra, and Larkspur (Larkspur Prime). Their displayed zero-Forma capacities are −14/60, −34/60, −24/60, −16/60, −29/60, and −15/60, respectively. The last Beast Companion page, [Pharaoh Predasite (heal bot + decent nuke and primer)](https://www.underframe.site/featured_builds/pharaoh-predasite-heal-bot-decent-nuke-and-primer), is −18/60 for the companion and −24/60 for its Claw Mods, with zero Forma. These pages show no objective-scored DPS calculator result; numeric DPS tags are category ratings. The [Featured Builds list](https://www.underframe.site/featured_builds) is the source for the complete public inventory.

No Copy & Edit/Test action was used, and no saved build was changed. This closes the current public Featured Build search with no usable fixture; it does not close D3-OPT-UNDERFRAME-MATCHED-CORPUS-001. Resume that comparison if a legal, scoreable build becomes available through a read-only path. Until then, keep the known metric and simulator differences explicit and do not claim Underframe parity.

## D3-OPT-FIXED-WINDOW-JOINT-ARCANE-ORACLE-001 — seeded exhaustive 5s Avg DPS mod/Arcane oracle (2026-11-21)

Reproduce with:

```sh
npx vitest run src/domain/logic/__tests__/buildOptimizer.test.ts -t "seeded exhaustive three-slot joint mod-and-Arcane oracle for 5s Avg DPS"
```

The deterministic LCG seed is `20261123`. Four fixtures cover Braton Prime / Primary / Grineer, Lex Prime / Secondary / Corpus, Cedo / Shotgun / Grineer, and Broken War / Melee / Infested. For each weapon, the test selects one supported attack and five max-rank damage mods from its compatible full-catalog pool, filtering out flawed/beginner duplicates, faction-incompatible mods, and effects the scorer does not model. It enumerates every legal distinct-mod subset through three slots at the weapon's default polarities with a Catalyst and no Forma, then scores each subset with no Arcane and every modeled rank of each compatible Arcane. The target pools use 1,000,000 Health (and for Corpus, 1,000,000 Shields) to avoid a low-health score ceiling; armor, conditional state, faction, Warframe Armor, and Energy context vary by fixture.

All four optimizer results match the independent exact fixed-window scorer's exhaustive best score and report the same `windowDpsScore`. The focused run passes 1/1 in 10.24s. The complete `buildOptimizer.test.ts` file passes 160/160 in 549.80s; focused ESLint and `git diff --check` pass. PR [#205](https://github.com/Appl3Tree/Tenno-Hub/pull/205) was squash-merged as `28864020ca9f63d27aa9df41e21a76bf7698aec1`. GitHub reported no PR-triggered workflows; there is no production deployment for this test/docs-only change. This adds bounded randomized joint-search evidence for the objective used in the Underframe fixed-window comparison. It does not test all catalog mods, alternate ranks, Forma choices, broader Arcane loadout combinations, global optimality, native Underframe parity, or live-game behavior. No production build or full-suite run was needed or performed.

## D3-OPT-FIXED-WINDOW-JOINT-ARCANE-FULLPOOL-001 — Braton Prime exact full-pool neighborhood (2026-11-21)

The audit runner now accepts `--joint-arcane=true`, reselecting an Arcane independently for the optimizer baseline and every exact legal one-mod neighbor. It scores the no-Arcane option and every modeled rank of each compatible Arcane using the same deterministic `[0,5s)` applied-damage scorer. The flag requires an explicit `--warframe-armor` when compatible Arcanes use that input. This mode is restricted to an optimizer baseline; it rejects `--baseline-file` because a captured Underframe list has no matched equipped-Arcane input in this audit.

Reproduce the three-slot pass with:

```sh
npx tsx scripts/auditFixedWindowDpsFullPool.ts --weapon="Braton Prime" --attack="Normal Attack" --slots=3 --forma=0 --runs=1 --state=realistic --health=2000000 --armor=3000 --joint-arcane=true --warframe-armor=1500 --warframe-max-energy=1000 --warframe-energy-percent=100
```

The legal optimizer result is Infected Clip R5 + Stormbringer R5 + Heavy Caliber R10 with Primary Overcharge R5. It scores 49,928.4661 damage / five seconds = 9,985.6932 DPS, survives the window, and uses 38/60 capacity with zero Forma. The compatible full candidate list contains 106 records, 62 eligible damage mods, 14 Arcanes, and 84 modeled ranks. The exact neighborhood includes 180 legal additions/removals/replacements; evaluating the baseline and every neighbor across the empty Arcane option plus all modeled ranks produced 15,385 exact Arcane scores. No neighbor improves the baseline; the best neighbor ties by replacing Heavy Caliber with Serration. Optimizer search time was 2,108.8ms with 307 evaluated candidates.

A two-slot repeat with the same target and context also found no improvement across 122 legal neighbors / 10,455 exact Arcane scores; its baseline was Infected Clip R5 + Stormbringer R5 with Primary Overcharge R5 at 3,771.2503 DPS. The no-Arcane mode remains the default and passed a separate Braton smoke run (122 neighbors, no baseline improvement).

Validation for this audit-only change: `npx tsc -p tsconfig.node.json --noEmit`, focused ESLint on `scripts/auditFixedWindowDpsFullPool.ts`, the default-mode smoke run, both joint-Arcane full-pool runs, and `git diff --check` pass. PR [#207](https://github.com/Appl3Tree/Tenno-Hub/pull/207) was squash-merged as `7dd315fd776463dfd410ad48461393d04364f67b`; GitHub reported no PR-triggered workflows. No application source or UI changed, so no browser capture or production deployment applies. This is one-target, one-faction, one-state, three-slot, zero-Forma, max-rank, single-mod neighborhood evidence. It does not cover ranks, Forma search, multi-mod moves, all catalog configurations, native Underframe parity, or live-game behavior.

## D3-OPT-UNDERFRAME-CAPTURED-WINDOW-NEIGHBORS-001 — exact neighborhoods around captured lists (2026-11-21; bounded)

Reproduce a captured-list audit with Node 22's built-in TypeScript stripping and the checked-in extension loader. For example:

```sh
node --no-warnings --experimental-strip-types --experimental-loader ./scripts/resolveTsExtensionLoader.mjs scripts/auditFixedWindowDpsFullPool.ts --weapon="Cedo" --attack="Normal Attack" --faction=Grineer --state=realistic --health=2000000 --shields=0 --overguard=0 --armor=3000 --slots=8 --forma=3 --runs=3 --baseline-file=./scripts/fixtures/underframeCedoFixedWindowCapture.json
```

Use the corresponding fixtures `underframeLexPrimeFixedWindowCapture.json` and `underframeBrokenWarFixedWindowCapture.json` for the other rows. The audit uses the deterministic applied-single-target `windowDps` model over `[0,5s)`, Grineer / 2,000,000 Health / 3,000 Armor / zero Shields and Overguard, Realistic conditionals, eight normal slots, Catalyst, max-rank incoming mods, up to three Forma, and no Exilus or Arcane. Each captured list is checked for modeled capacity legality; the optimizer is run three times and the exact legal max-rank one-mod add/remove/replacement neighborhood around the captured list is independently scored. All three targets survive the window. Totals cover 918 legal neighbors.

| Captured build | Captured list score and modeled capacity | Best legal one-mod neighbor | Tenno-Hub optimizer | Exact neighbors |
| --- | --- | --- | --- | ---: |
| Cedo / Normal Attack | 10,592.48 DPS; 60/60, 3 Forma | 18,013.49 DPS (Galvanized Savvy → Primed Ammo Stock; +70.1%) | 29,769.16 DPS; 58/60, 3 Forma; 349 candidates/run | 310 |
| Lex Prime / Normal Attack | 6,623.68 DPS; 59/60, 3 Forma | 22,662.18 DPS (Anemic Agility → Semi-Pistol Cannonade; +242.1%) | 38,011.00 DPS; 60/60, 3 Forma; 373 candidates/run | 301 |
| Broken War / Normal Attack | 1,669.32 DPS; 59/60, 3 Forma | 2,961.47 DPS (Berserker Fury → Organ Shatter; +77.4%) | 5,071.25 DPS; 60/60, 2 Forma; 193 candidates/run | 307 |

Every captured baseline was legal under Tenno-Hub's modeled capacity assignment, and each of the three repeated optimizer runs returned the same build and score. The result shows that the captured lists have improving one-mod neighbors under Tenno-Hub's model; it does not establish Underframe's own ranking quality. Underframe's native simulator remains private, its auto-build target settings are a distinct observation, and Broken War uses a generic Normal Attack without the captured Lone Vengeance stance sequence or evolving combo history. These are common-model list comparisons, not engine parity or gameplay validation.

The first Broken War run stopped before scoring because the audit harness resolved the first matching name, which was the Beginner Berserker Fury R3 record, instead of the standard Berserker Fury R5 in the captured build. The baseline resolver now prefers a non-flawed variant; the corrected script completed the exact neighborhood and identified Berserker Fury → Organ Shatter. No weapon/mod catalog entry or app scoring code changed. The three captures were run with Node 22.16.0's experimental TypeScript stripping and `scripts/resolveTsExtensionLoader.mjs` because this worktree had no `node_modules`; the repeated optimizer timings are one Windows desktop sample, not Worker/mobile or tail-latency measurements.

## D3-OPT-UNDERFRAME-CAPTURED-CROSSFACTION-001 — captured lists across shielded Corpus and unarmored Infested (2026-11-21; bounded)

The three captured lists from the preceding section were rescored without changes against two more synthetic target profiles using the same `auditFixedWindowDpsFullPool.ts --baseline-file=...` runner. Both use Realistic conditionals, Normal Attack, `[0,5s)`, eight slots, Catalyst, up to three Forma, no Arcane, and no attack-distance override: shielded Corpus has 10,000,000 Health + 10,000,000 Shields / zero Overguard / zero Armor; unarmored Infested has 10,000,000 Health / zero Shields, Overguard, and Armor. For example, add `--faction=Corpus --health=10000000 --shields=10000000 --overguard=0 --armor=0 --runs=3` to the Cedo reproduction command above; use `--faction=Infested --health=10000000 --shields=0 --overguard=0 --armor=0 --runs=3` and the matching Lex Prime or Broken War capture path for the other rows. The 10m pools remain far above all damage scored in five seconds, so no row reaches a kill cap.

| Faction / captured build | Captured-list DPS | Best legal one-mod neighbor | Tenno-Hub optimizer DPS | Neighbors |
| --- | ---: | --- | ---: | ---: |
| Corpus / Cedo | 48,513.62 | 92,347.72 (Toxic Barrage → Chilling Reload) | 195,350.14 | 310 |
| Corpus / Lex Prime | 8,348.17 | 29,068.97 (Anemic Agility → Semi-Pistol Cannonade) | 158,891.32 | 301 |
| Corpus / Broken War | 4,626.78 | 8,208.07 (Berserker Fury → Organ Shatter) | 25,330.13 | 316 |
| Infested / Cedo | 48,513.62 | 90,539.10 (Primed Charged Shell → Primed Chilling Grasp) | 237,551.09 | 310 |
| Infested / Lex Prime | 32,932.22 | 99,046.91 (Anemic Agility → Semi-Pistol Cannonade) | 192,144.25 | 301 |
| Infested / Broken War | 5,513.28 | 9,780.71 (Berserker Fury → Organ Shatter) | 37,234.42 | 316 |

Each captured list remains capacity-legal under the configured assignment. The optimizer returned an identical build and score on all three repetitions per case. All six captured-list one-mod neighborhoods improve, for 1,854 exact legal neighbors across the two factions; with the preceding Grineer cases, these comparisons score 2,772 neighbors total. This tests faction and shield sensitivity of fixed captured lists against Tenno-Hub's scorer. The profiles are synthetic, not named-enemy settings; results do not establish Underframe objective parity or live-game accuracy. Broken War's captured stance sequence and evolving combo remain outside the Normal Attack model. The user's Underframe saved builds were not edited.

## D3-OPT-UNDERFRAME-CAPTURED-PAIR-SAMPLE-001 — seeded two-mod samples around captured lists (2026-11-21; bounded)

`auditFixedWindowDpsPairSample.ts` now accepts `--baseline-file=...` for a direct single-weapon run. It validates the capture's weapon/attack, resolves same-name mod variants to the standard entry, preserves retained capture ranks, assigns incoming mods at maximum rank, and rejects duplicate, incompatible, or over-capacity builds. The output separates the sampled comparison baseline from the full-pool Tenno-Hub optimizer result. Reproduce the first row with:

```sh
node --no-warnings --experimental-strip-types --experimental-loader ./scripts/resolveTsExtensionLoader.mjs scripts/auditFixedWindowDpsPairSample.ts --weapon="Cedo" --attack="Normal Attack" --faction=Grineer --health=2000000 --shields=0 --overguard=0 --armor=3000 --samples=1024 --seed=20261158 --baseline-file=./scripts/fixtures/underframeCedoFixedWindowCapture.json
```

The three Cedo / Lex Prime / Broken War captures were each sampled at 1,024 unique legal two-out/two-in replacements in each of the same three fixed-window profiles: Grineer / 2m Health / 3k Armor, shielded Corpus / 10m Health + 10m Shields / zero Armor, and unarmored Infested / 10m Health / no Shields or Armor. All use Realistic state, Normal Attack, eight slots, Catalyst, up to three Forma, and no Arcane. The sampled pool preserves the other six captured mods and their ranks. The full-pool optimizer is independently scored under the same profile. All nine captured lists are legal; 9,216 unique legal pair candidates were scored, and 1,493 beat their captured baseline. Raw tuple draws are only 3.824%–4.792% of each unfiltered outgoing-pair × incoming-pair universe, so these results remain sampled rather than exhaustive.

| Profile / capture | Captured DPS | Best sampled pair and score | Optimizer DPS | Improvements / 1,024 | Seed / raw tuples drawn |
| --- | ---: | --- | ---: | ---: | --- |
| Grineer / Cedo | 10,592.48 | Accelerated Blast + Galvanized Savvy → Scattering Inferno + Shotgun Elementalist; 20,510.46 | 29,769.16 | 158 | 20261158 / 1,832 |
| Grineer / Lex Prime | 6,623.68 | Galvanized Shot + Anemic Agility → Magnetic Might + Semi-Pistol Cannonade; 24,520.72 | 38,011.00 | 56 | 20261159 / 2,051 |
| Grineer / Broken War | 1,669.32 | Berserker Fury + Volcanic Edge → Magnetic Rush + Organ Shatter; 2,834.41 | 5,071.25 | 62 | 20261160 / 1,795 |
| Corpus / Cedo | 48,513.62 | Toxic Barrage + Galvanized Savvy → Atomic Fallout + Chilling Grasp; 123,913.06 | 195,350.14 | 238 | 20261161 / 1,920 |
| Corpus / Lex Prime | 8,348.17 | Pistol Pestilence + Galvanized Shot → Magnetic Might + Semi-Pistol Cannonade; 46,389.46 | 158,891.32 | 279 | 20261162 / 2,142 |
| Corpus / Broken War | 4,626.78 | Berserker Fury + Primed Smite Grineer → North Wind + Organ Shatter; 9,518.11 | 25,330.13 | 200 | 20261163 / 1,649 |
| Infested / Cedo | 48,513.62 | Primed Charged Shell + Galvanized Savvy → Ammo Stock + Frigid Blast; 116,827.40 | 237,551.09 | 236 | 20261164 / 1,816 |
| Infested / Lex Prime | 32,932.22 | Galvanized Shot + Lethal Torrent → Hornet Strike + Semi-Pistol Cannonade; 88,391.57 | 192,144.25 | 86 | 20261165 / 2,112 |
| Infested / Broken War | 5,513.28 | Berserker Fury + Primed Smite Grineer → Amalgam Organ Shatter + Buzz Kill; 12,358.29 | 37,234.42 | 178 | 20261166 / 1,673 |

Each score is deterministic for the recorded seed and profile; the table's `improvements` count is measured against the captured list, not against the optimizer. The best sampled candidate in every row remains below the full-pool optimizer. These results show that multi-mod alternatives can materially improve the captured lists under Tenno-Hub's model, but do not establish Underframe's native ranking, practical gameplay performance, exhaustive pair quality, or global optimizer quality. Broken War uses a generic Normal Attack rather than the captured Lone Vengeance stance and combo sequence. The profiles remain synthetic, and the user's saved Underframe builds were not changed.

### Mausolon Atmosphere Auto captured-list pair neighborhood

The existing [Mausolon capture](scripts/fixtures/underframeMausolonAutoBuild.json) is explicitly the Atmosphere profile / Auto attack, not Archwing. Its eight mods assign legally at 58/60 with three Forma. The same runner exhaustively visited its 12,180 raw outgoing-pair × incoming-pair tuples and exact-scored all 5,223 unique legal two-mod replacements with seed `20261169` (`--samples=100000` ends only after exhausting the raw universe):

| Captured DPS | Best legal two-mod neighbor | Current Tenno-Hub optimizer DPS | Legal candidates scored | Pair improvements |
| ---: | --- | ---: | ---: | ---: |
| 8,546.40 | Archgun Ace + Ballista Measure → Polar Magazine + Venomous Clip; 71,977.61 DPS | 315,041.23 | 5,223 / 5,223 | 1,499 |

A preceding 1,024-pair sample (seed `20261167`) peaked at 51,928.19 DPS; a 4,096-pair sample (seed `20261168`) peaked at 71,977.61 after examining 77.808% of raw tuples. The exhaustive run found the same maximum among all legal pair builds; tied top variants differ in which two captured mods they remove. The current full-pool optimizer is still well above this captured-list pair neighborhood. This is exact only for legal two-out/two-in max-rank incoming changes under this fixed candidate pool, not for three-or-more changes, rank/FORMA search, or the global space.

The Mausolon row uses Grineer / 2,000,000 Health / 3,000 Armor / Realistic / `[0,5s)` / eight slots / Catalyst / three Forma / no Arcane. This captured-list audit supplied no distance override, so it evaluated full profile damage; current scoring applies a hard cap when a distance beyond the cap is explicitly configured, while an unset distance still assumes full damage. Auto's attached radial event scores against the directly struck target only; area coverage and other targets are excluded. The Archwing profile and its falloff curve remain separate and were not tested by this fixture. The capture's original invalid Archgun Arcane slider state is disclosed in the fixture; three later Auto-only zero-slider runs reproduced the same list. No Underframe saved data was modified.

### Pair-sampler validation and capacity reporting


## D3-MOD-ARCHGUN-CHARGE-RATE-001 — Shell Rush and linked charged Arch-Gun components (2026-11-21; released in PR #216)

### Source-backed model

- [Shell Rush](https://wiki.warframe.com/w/Shell_Rush) lists +12.5%, +25%, +37.5%, and +50% Charge Rate at ranks 0–3. It is parsed to a separate `chargeRateBonus`; all ranks now have no unmatched stat lines.
- The [Fire Rate page](https://wiki.warframe.com/w/Fire_Rate) gives charged-weapon cadence as `1 / (modded charge time + 1 / modded fire rate)`. The [Shell Rush page](https://wiki.warframe.com/w/Shell_Rush) gives charge time as `base charge time / (1 + Charge Rate bonus)`. In this model, Fire Rate and Charge Rate bonuses add in the charge-time denominator, while only Fire Rate changes the post-charge firing interval. This stacking rule is an explicit model assumption pending an independent in-game comparison.
- [Larkspur](https://wiki.warframe.com/w/Larkspur) and [Larkspur Prime](https://wiki.warframe.com/w/Larkspur_Prime) each document an Archwing charged Alt-Fire Projectile Impact and Explosion pair at 0.5s charge. The impact has an immediate linked explosion component and the separate Explosion-only row is reference-only. A later source audit found forced Knockdown on the charged projectile; the 2026-11-22 boundary follow-up below confirms current Arch-Gun pools have no per-status direct-damage bonus and restores the impact-plus-linked-explosion single-target score, while Knockdown control and priming remain unscored. Their values and Shell Rush charge timing remain visible.
- [Mausolon](https://wiki.warframe.com/w/Mausolon) Charged Shot Laser and Charged Shot Explosion share 0.8s charge / 0.50 attack per second. The laser is the selected row and one immediate blast component is linked against the directly struck target; the component-only row is reference-only. Both Archwing and Atmosphere profiles preserve their sourced Auto and charged damage values; this charge change does not copy range behavior between profiles or enforce either 300m listing as a hard cap.
- At the time of the Shell Rush release, spatial area coverage, damage to additional targets, and the initial charge delay before the first event were not simulated; charged finite encounters assumed the selected attack was ready at `t=0`. The active `D3-ATTACK-MODEL-CHARGED-INITIAL-WINDUP-001` follow-up adds a selected mode's source-backed startup delay from an uncharged state; see the checkpoint below. Mausolon's five-primary-kill charge gauge/recharge history remains outside the model and continues to block charged-shot Auto Optimize. Larkspur charged Alt-Fire scoring was initially blocked by forced Knockdown; the current pool-boundary follow-up below now scores only the directly struck target and linked explosion.

### Validation status

Catalog regressions check Shell Rush's four parsed ranks, Larkspur's shared charge/component rows, Mausolon's two selectable profiles, and unchanged Auto rows. Damage-model regressions check charged and uncharged cadence plus linked component profiles; an optimizer regression checks Shell Rush selection on Corvas Charged Shot and explanation text. Focused tests pass 5/5; the serial full suite passes 841/841 tests across 54 files; production TypeScript/build, focused ESLint, and source validation pass. `audit:mod-effect-coverage` reduces flagged records from 70 to 69 (600 eligible mod records). CRLF-aware diff check passes. PR [#216](https://github.com/Appl3Tree/Tenno-Hub/pull/216) squash-merged as `6fa764f9b9a1e235ab9c35dfb88c5e6cf89bd821`; Pages run [#296](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/44946241370) succeeded. A later source audit found that Knockdown can contribute to per-status damage on a susceptible target; the 2026-11-22 pool audit below restores bounded Larkspur single-target impact-plus-explosion scoring after confirming no compatible or intrinsic per-status direct-damage bonus. The component-only row remains blocked. A fresh Codex IAB tab still loaded `wfpt-build-id=7aca467` at that time; only IAB may be used for visual QA. The following profile audit adds the missing Atmosphere choices.

## D3-MOD-LARKSPUR-ATMOSPHERE-PROFILE-001 — distinct Larkspur equipment profiles (implementation and visual follow-up released; 2026-11-21)

### Source-backed profiles and model boundaries

- WFCD supplies only the Archwing catalog rows. The current [Larkspur](https://wiki.warframe.com/w/Larkspur) and [Larkspur Prime](https://wiki.warframe.com/w/Larkspur_Prime) pages list separate Archwing and Atmosphere profiles; the Mod Builder now creates selectable `Larkspur (Archwing)`, `Larkspur (Atmosphere)`, `Larkspur Prime (Archwing)`, and `Larkspur Prime (Atmosphere)` entries. Atmosphere entries retain Archgun mod compatibility through the source identity.
- Normal Attack base damage remains 90 (Impact 10 / Radiation 80) in Archwing and becomes 180 (Impact 20 / Radiation 160) in Atmosphere. Critical/status values and 12/s beam cadence are inherited. The Wiki beam rule ramps damage from 20% to 100% over 0.6s, starts decay after 0.8s idle, and returns to 20% over 2s; the catalog applies it to both equipment profiles. Ammo cost is set to 0.5 per beam tick.
- Larkspur base Alt-Fire remains 420 impact damage plus a linked 800-damage Explosion, 0.5s charge, 1/s profile cadence; Larkspur Prime remains 420 + 800, 0.5s charge, 2/s cadence. Atmosphere damage is 840 total direct impact (Impact 280 / Blast 360 / Radiation 200) plus a linked 1,600 Explosion (Blast 800 / Radiation 800). The Atmosphere Alt-Fire projectile lists 100m range and costs 10 ammo. Atmosphere profiles use the listed 2.5s reload versus 4.5s Archwing reload. Prime Atmosphere also lists a forced Impact proc on the projectile; its page is marked under active revision.
- The charged Explosion lists linear 100%→40% falloff across 9.6m for both profiles. The calculator carries this component falloff but models the linked hit at the direct target only; it excludes other targets and spatial coverage. At the time of this profile release, the chosen charged attack began ready at `t=0` where scoreable. The active `D3-ATTACK-MODEL-CHARGED-INITIAL-WINDUP-001` follow-up now applies initial charge time in finite scoring when the attack is scoreable; the 2026-11-22 follow-up now scores direct impact plus the linked explosion under current pools, while disclosing that Knockdown control and cross-weapon setup are not modeled.
- The Wiki lists forced Knockdown on Larkspur charged projectiles. [Condition Overload](https://wiki.warframe.com/w/Condition_Overload), [Galvanized Aptitude](https://wiki.warframe.com/w/Galvanized_Aptitude), and [Status Duration](https://wiki.warframe.com/w/Status_Duration) say Knockdown counts for status-count damage bonuses on later hits when the target accepts it. The 2026-11-22 follow-up verifies that no direct per-status damage effect is compatible with the current Larkspur pools and no intrinsic attack bonus applies, so the current weapon's own single-target damage sequence can be scored without simulating that status history. It still excludes Knockdown control, susceptibility/immunity and expiry, priming another weapon, other targets, and spatial coverage. The linked Explosion-only row remains reference-only because it is one part of the same release.
- Normal Attack remains scoreable as a direct hit with its beam ramp, while a visible source note says that chained hits to up to three additional enemies, auto-lock acquisition, and multi-target damage are excluded. The table lists Larkspur ranges of 160m Archwing / 40m Atmosphere; the overview separately describes 320m Archwing beam range and a 160m lock-on limit. For Larkspur Prime, the table lists 180m / 50m, while the overview lists 320m / 40m and the page says it is under active revision. Displayed beam ranges remain informational: the current distance model records exceeded range but does not convert it to a miss. No Mausolon 300m values or falloff are shared with Larkspur.

### Validation

Catalog tests assert all four distinct profiles, exact base attack damage, charge/fire cadence, reload, profile-specific range, linked Explosion, falloff, compatibility, ammo cost, Prime's Atmosphere forced Impact, and reference-only charged attacks. Damage-calculator tests verify the 20% starting ramp, 70% Explosion midpoint at 4.8m, and informational range behavior. The two focused files pass 164/164 tests; the full serial suite passes 843/843 across 54 files. `npx tsc -b`, `npm run build`, `npm run validate:sources`, `npm run audit:prerequisites` (162 entries, no unresolved references/cycles), `npm run audit:mod-effect-coverage` (697 profile entries / 600 mods / 493 with parsed effects / zero empty weapon pools), focused ESLint, and CRLF-aware diff check pass. PR [#218](https://github.com/Appl3Tree/Tenno-Hub/pull/218) merged as `24dd64ee50f09dd8b234eb3621226248c889c81c`, and Pages run [#298](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/44950169535) succeeded. IAB caught the “Phantasma Beam ramp” label; PR [#219](https://github.com/Appl3Tree/Tenno-Hub/pull/219) changes it to “Attack damage ramp,” merged as `dfb259401b4ecc9987aabdaca96047ccc40294e4`, and Pages run [#299](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/44950936696) succeeded. Hosted IAB on `version=dfb2594` confirms the generic label with no Phantasma-specific label. At 390×844, the source note wraps without clipping or overlap; at 1280×900, the planner and math trace render without clipping. The Larkspur Atmosphere profile shows 180 direct damage, 2.5s reload, and the 40m informational range/direct-target boundary. Objective-matched Underframe comparison for these new profiles remains open.

## D3-ATTACK-MODEL-CHARGED-INITIAL-WINDUP-001 — initial charge in finite attack sequences (released, 2026-11-21)

### Behavior

- Finite direct-sequence TTK, Expected TTK encounters, and fixed-window DPS now accept a source-backed initial attack delay. The delay is the selected mode's charge duration from an uncharged start, using the active modded charge time. The first attack is scheduled at that delay; subsequent events keep the existing selected-mode cadence, so the initial windup is not counted twice.
- Bow quick attacks remain at zero initial delay. Charged and perfect-charged bow modes use their respective charge times; Fire Rate shortens charge, while Reload Speed only changes the post-shot delay. Standard charged triggers use Fire Rate and Charge Rate for charging, with only Fire Rate changing the post-charge interval. Ammo-driven charged attacks use the selected attack's ammo cost and fixed ammo charge rate.
- The `Expected TTK` / fixed-window explanation and the Mod Builder Math Trace disclose the assumed uncharged start and initial delay. Per-hit and Burst damage output remain damage/rate views; they do not add an encounter-start penalty.
- Mausolon Archwing and Atmosphere remain separate selected profiles with independent charge and range mechanics. At PR #222 release, both 300m rows were informational and falloff stayed Archwing-specific. Follow-up D3-MOD-MAUSOLON-RANGE-CAP-001 now enforces Atmosphere Auto and both charged Laser caps while retaining Archwing Auto's unresolved conflict. The charged Mausolon attack remains unavailable to Auto Optimize because its five-primary-kill alt-fire gate and per-use recharge history are not represented. Larkspur charged Alt-Fire is now single-target scoreable under current mod pools; its Knockdown control and priming history remain outside the damage score.
- The finite sequence starts with no stored charge. A pre-charged starting state is not configurable. Multi-target coverage, spatial falloff across other targets, and special kill-gated charge buildup remain outside this change.

### Sources and validation

The timing rule follows the current Wiki [Fire Rate](https://wiki.warframe.com/w/Fire_Rate) description of charged attack cadence and [Shell Rush](https://wiki.warframe.com/w/Shell_Rush) Charge Rate. Profile-specific examples remain documented in the [Larkspur](https://wiki.warframe.com/w/Larkspur), [Larkspur Prime](https://wiki.warframe.com/w/Larkspur_Prime), and [Mausolon](https://wiki.warframe.com/w/Mausolon) source review above.

Focused regressions pass 7/7 across `targetDamage.test.ts`, `damageCalc.test.ts`, and `buildOptimizer.test.ts`, covering initial event timing, an event at the exclusive window boundary, Nataruk quick/charged/perfect charge, Fire Rate versus Reload Speed, generic charge, Shell Rush, and optimizer scoring/explanation. The 6-second synthetic charge against a 100-health target reaches the first hit/TTK at 6 seconds and scores zero during `[0,5s)`; an event exactly at the half-second window endpoint is excluded. Reproduce the focused cases with `npx vitest run --maxWorkers=1 src/domain/logic/__tests__/targetDamage.test.ts src/domain/logic/__tests__/damageCalc.test.ts src/domain/logic/__tests__/buildOptimizer.test.ts -t "includes initial charge|charged startup windup|Nataruk reload time|fire-rate bonuses to bow charge|Shell Rush to charged Larkspur|Shell Rush to both Mausolon|generic charged-weapon fire-rate"`. The complete serial Vitest suite passes 845/845 tests across 54 files in 477.70s with `npx vitest run --maxWorkers=1 --reporter=verbose`. `npx tsc -b`, production build, focused ESLint, and `git diff --check` pass. PR [#222](https://github.com/Appl3Tree/Tenno-Hub/pull/222) squash-merged as `3c61e99478df04148ea3bd693bfa8b30af68cb8c`; GitHub Pages deployment [run #302](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/44955997580) succeeded. In the hosted IAB at build `3c61e99`, the Nataruk Charged Shot Full calculation trace reports: “Finite encounters assume the bow starts uncharged; its first attack follows the 1.00000s modded charge.” This verifies the rendered selected-mode assumption and Math Trace. The local Vite preview on port 82 timed out in the IAB, so hosted visual verification is the available visual evidence. This deterministic timing change does not add new randomized gameplay or optimizer-quality evidence; seeded optimizer oracles still pass as part of the suite. This is model behavior validation, not Underframe parity or live-game accuracy.

## D3-MOD-SET-STRAIN-INFECTION-001 — bounded Burst-only cyst assumption (released in PR #224; 2026-11-21)

### User decision and source boundary

The user approved saving a 0–8 active-cyst count at impact for Burst scoring. The current Burst calculation holds the selected count static internally; it does not simulate cyst changes between attack events. The current [Strain Infection Wiki page](https://wiki.warframe.com/w/Strain_Infection) lists rank values of +5%, +10%, +15%, or +20% Critical Damage per cyst. The [Strain Set page](https://wiki.warframe.com/w/Strain_Set) lists growth up to 2/4/6/8 cysts for one through four distinct set pieces, with eruptions on a 25-second cycle; the Infection page states that the full 8-cyst bonus lasts one second before reset. Intermediate cyst timing and average uptime are not established here. Do not convert the selected impact count into a sustained average or simulate a cyst/eruption timeline.

### Implemented model boundary

- Persist the user-entered cyst count at impact (0–8) with planner configuration. It is an explicit observed-state assumption; the planner does not infer cyst generation, active set composition, or the one-second maximum-cyst window.
- Apply the rank-scaled relative Critical Damage bonus to Burst scoring with Strain Infection equipped on an ordinary melee weapon. The selected count stays static within that calculation because no cyst event timeline is modeled. Exalted melee and Companion/robotic melee weapons remain unsupported.
- Exclude the cyst bonus from Scaling, melee sustained DPS, finite Expected TTK, direct finite TTK, and fixed-window `5s Avg DPS`; no average uptime or repeated-hit assumption is sourced. Explain this exclusion wherever those goals are shown or optimized.
- Keep the Strain Infection mod out of non-Burst optimizer scores when its only modeled stat would otherwise be the selected cyst assumption.

Implementation covers the catalog parser, damage calculator, optimizer, saved planner configuration, and Mod Builder presentation/export paths. Focused Strain regressions pass 5/5; the full serial suite passes 849/849 tests across 54 files. `npm run build`, source validation, mod-effect audit, focused ESLint, and `git diff --check` pass. PR [#224](https://github.com/Appl3Tree/Tenno-Hub/pull/224) squash-merged as `f72d6946d822e24e90d3c2a051024b0dd5a97f65`; Pages run [#304](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/44962692894) succeeded. Hosted IAB at `version=f72d694` verified the Broken War Normal Attack control and optimizer output: with max-rank Strain Infection, changing cysts from 0 to 8 changes Critical Damage from 2.20× to 5.73× and Burst DPS from 266 to 497; sustained DPS remains 266. Math Trace and Why This Build state +160% Critical Damage, the static count-at-impact assumption, and the finite-score exclusions. The transient build was reset and no saved builds were changed. Local port 4193 timed out and the supplied localhost site still serves stale build `2bf6faea`, so rendered verification used Pages.

## D3-MOD-MAUSOLON-RANGE-CAP-001 — profile-specific hit-range handling (released; hosted IAB verified, 2026-11-21)

### Source review and decisions

The current [Mausolon Wiki page](https://wiki.warframe.com/w/Mausolon) separates Archwing and Atmosphere profiles. Both list 300m for Auto and Charged Shot Laser. Archwing Auto also lists direct falloff from 1,400m to 2,800m, while Atmosphere Auto has no direct falloff. The [Range](https://wiki.warframe.com/w/Range) page defines Range as the maximum distance a weapon can hit and calls Archguns exceptions to the default 300m hitscan value; the [Hitscan](https://wiki.warframe.com/w/Hitscan) page says hits beyond an attack's Range stat do not register. The [Atmospheric Archgun](https://wiki.warframe.com/w/Atmospheric_Archgun) page says grounded Archguns lack damage falloff, and the Mausolon Atmosphere row is explicitly hit-scan.

The model now applies separate profile rules:

- Mausolon Atmosphere Auto treats 300m as a hard hit cap. Beyond 300m, the attack applies no damage, status, or attached Auto Radial Attack to the selected target. This follows the explicit Atmosphere hit-scan Range and general Range/Hitscan definitions; no Archwing falloff is copied to it.
- Both profiles' Charged Shot Laser rows treat their listed 300m hit-scan Range as a hard cap. Its linked Charged Shot Explosion remains attached only to a laser hit; the charged attack is still excluded from Auto Optimize because its five-kill charge/recharge history is not modeled.
- Archwing Auto preserves its 1,400–2,800m falloff and leaves 300m informational because the same source page lists both values and the broader Wiki definitions make their combination contradictory. At 301m, the planner therefore continues to score the sourced falloff profile. This is an explicit unresolved source/gameplay question, not a claim that 300m is ignored in-game.
- Larkspur ranges and the unverified target-distance assumption for all attack scores remain separate open work. An unset distance assumes full damage and does not evaluate a hard cap.

The Mod Builder labels the input “Attack distance,” explains hard and informational range treatment, shows the Mausolon profile-specific conflict, links the weapon and general rule sources, and displays an out-of-range miss in Math Trace. Auto Optimize is disabled while a configured hard cap is exceeded.

### Validation

Focused calculator/optimizer regressions pass 7/7. They verify profile-specific metadata, the exact 300m boundary, absence of damage/forced procs/linked radial damage after an Atmosphere miss, retained Archwing Auto falloff at 301m, and fixed-window scores of positive damage for Archwing vs zero for Atmosphere at 301m. `npx tsc -b`, production `npm run build`, `npm run validate:sources`, `npm run audit:mod-effect-coverage` (697 catalog profiles / 600 eligible mod records / zero empty weapon pools), focused ESLint, and CRLF-aware `git diff --check` pass. The build retains the existing Vite large-chunk warning. Full serial suite passes 849/849 tests across 54 files in 450.12s. PR [#226](https://github.com/Appl3Tree/Tenno-Hub/pull/226) squash-merged as `e3c2351312d14865f3fc71257a75d15c814e45f3`; Pages run [#306](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/44967010887) succeeded. Hosted IAB at `version=e3c2351`, 573×840, verified Atmosphere Auto at 300m and as a zero-damage/status miss at 301m with Auto Optimize disabled; Archwing Auto remained positive at 301m, and its profile-conflict explanation wrapped without horizontal overflow. The Math Trace describes the miss and linked-component exclusion. The local URL `http://localhost/Tenno-Hub/` still serves stale build `2bf6faea`. Archwing's 300m/falloff conflict and in-game cap verification remain unresolved. The captured Mausolon Atmosphere pair audit omitted distance and remains a full-damage common-model benchmark; it does not establish Underframe or gameplay parity.

## D3-MOD-LARKSPUR-RANGE-CAP-001 — standard Atmosphere Normal Attack cap (released, 2026-11-21)

### Source review and scoped behavior

The current [Larkspur Wiki page](https://wiki.warframe.com/w/Larkspur) lists 40m for Larkspur (Atmosphere) Normal Attack and its overview also describes the Atmosphere beam as limited to 40m. The row is hit-scan. Under the general [Range](https://wiki.warframe.com/w/Range) and [Hitscan](https://wiki.warframe.com/w/Hitscan) definitions, the planner now treats distances above 40m as misses for this profile's Normal Attack.

The same source describes automatic lock-on only within 20m, and chains to up to three nearby enemies within a separate 6m radius. The calculator continues to assume the selected direct target is hit and excludes lock-on acquisition, chains, and other targets. The selected attack still applies the Wiki beam ramp (20% to 100% over 0.6s, with the 0.8s idle delay and 2s decay); the new cap only zeroes an out-of-range attack.

Other profile ranges remain explicitly separate and informational: base Larkspur Archwing lists 160m while the overview describes a 320m beam and a 160m lock-on limit; Larkspur Prime Archwing lists 180m while the overview says 320m with 180m lock-on; Larkspur Prime Atmosphere lists 50m in its table but 40m in its overview, and that page remains under active revision. No cap is inferred for these conflicting profiles. Direct in-game behavior and objective-matched Underframe comparisons remain open.

### Validation

Focused catalog/calculator regressions pass 167/167 across `weaponCatalog.test.ts` and `damageCalc.test.ts`. They check all four selectable profiles, exact listed-distance boundaries, the 40m standard Atmosphere miss, zero modeled damage/procs beyond the cap, and informational behavior for the other three profiles. The serial suite passes 849/849 tests across 54 files. `npx tsc -b`, production build, source validation, prerequisite audit (162 entries; no unresolved references/cycles), mod-effect audit (697 profiles / 600 eligible mods / 494 parsed effects / 68 review candidates / zero empty weapon pools), focused ESLint, and CRLF-aware `git diff --check` pass. The build retains the existing Vite large-chunk warning. PR [#228](https://github.com/Appl3Tree/Tenno-Hub/pull/228) squash-merged as `b21e6d6d271786b38198df1367022e99174900ec`; Pages run [#308](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/44970630445) succeeded. Hosted IAB at `version=b21e6d6`, 390×844, verified that 40m remains in range and 41m produces a zero-damage/status miss with Auto Optimize disabled; Math Trace explains the miss, and the source note wraps without clipping or horizontal overflow. No Underframe saved build was edited. Direct in-game verification and objective-matched Underframe comparisons remain open.

## D3-MOD-BEAST-CLAW-STATUS-001 — status modifiers and healing boundary (released; hosted IAB verified, 2026-11-22)

The [Beast Claws Mods page](https://wiki.warframe.com/w/Beast_Claws_Mods) classifies Magnetic Strike, Immunity Resistance, and Bloodthirst as Beast Claw mods. The current [Magnetic Strike page](https://wiki.warframe.com/w/Magnetic_Strike) lists 25/50/75/100% chance to add a Magnetic proc when an Impact proc is inflicted and explicitly says Bell Ringer's Impact procs qualify. The planner already parses those four ranks. Its expected-proc calculation multiplies every expected Impact proc by this rank chance, including Bell Ringer's forced one-to-four Impact applications per melee hit; it does not claim to produce a realized random proc history.

The [Immunity Resistance page](https://wiki.warframe.com/w/Immunity_Resistance) and current [Status Damage page](https://wiki.warframe.com/w/Status_Damage) identify it as a source of Status Damage. The generated mod rank table lists +12.5/25/37.5/50% Status Damage; the parser already maps these values to its status-damage multiplier. Regressions now check every rank against Slash DoT while asserting the direct hit remains unchanged. No extra damage is attributed to the healing effect.

The [Bloodthirst page](https://wiki.warframe.com/w/Bloodthirst) describes companion health stolen per hit per active Slash stack; official Module:Mods/data gives 100 health at max rank, and the generated rank text lists 25/50/75/100 health per hit per stack. The generic damage-keyword screen previously treated the word “Slash” as an unparsed damage effect and labeled the row as a missing damage mechanic. The builder now identifies the effect as companion healing outside the weapon damage score, links the Wiki source, and says “Unscored effect” in the picker/selected-mod label. Auto Optimize continues to skip Bloodthirst because companion healing is not a current optimization objective. Companion healing, target Slash-stack history, and any healing cap are not simulated.

Focused regressions pass 10/10 across `damageCalc.test.ts` and `buildOptimizer.test.ts`: Bell Ringer + Magnetic Strike rank interactions; all Immunity Resistance ranks; selection of Magnetic Strike against a shielded Corpus fixture; and Bloodthirst warning/source-link/optimizer exclusion. The serial suite passes 853/853 tests across 54 files. `npx tsc -b`, production build, `validate:sources`, prerequisite audit (162 entries with no unresolved references/cycles), mod-effect audit (697 profiles / 600 eligible mods / 494 parsed effects / 68 review candidates / zero empty weapon pools), focused ESLint, and `git diff --check` pass. PR [#230](https://github.com/Appl3Tree/Tenno-Hub/pull/230) squash-merged as `9ea7b2f7026289ad7c4a70a557b0140cd9290180`; Pages run [#310](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/44973745898) succeeded on retry attempt 2 after its first deploy job received an empty artifact. Hosted IAB at `version=9ea7b2f`, with Chesa Claws selected, verified the picker and selected-mod Bloodthirst descriptions, the “Unscored effect; Auto Optimize skips this mod” note, and the Wiki source link. The local preview on port 5190 returned `ERR_CONNECTION_TIMED_OUT`, and `http://localhost/Tenno-Hub/` remains stale at build `2bf6faea`; hosted IAB is the rendered evidence. This checkpoint makes no live-game, randomized proc-history, or Underframe parity claim.

## D3-OPT-TTK-RANK-FORMA-ORACLE-001 — seeded owned-rank / Forma / Arcane Expected TTK oracle (2026-11-22; bounded)

Reproduce with:

```sh
npx vitest run --maxWorkers=1 src/domain/logic/__tests__/buildOptimizer.test.ts -t "seeded rank-limited joint mod, Arcane, and one-Forma Expected TTK optima"
```

The deterministic LCG seed is `20261125`. Four fixtures sample one supported attack and three compatible damage mods from each full pool: Braton Prime / Grineer (65,000 Health / 2,400 Armor / Realistic), Lex Prime / shielded Corpus (36,000 Health + 44,000 Shields / Initial), Cedo / Grineer (140,000 Health / 1,800 Armor / Realistic), and Broken War / Infested (95,000 Health / 300 Armor / Fully Stacked). Each candidate is screened at every rank that can be sampled (rank 0 through a random owned cap of 1–3) so a partially modeled rank cannot enter the oracle. Candidate subsets use two slots, uncatalyzed rank-10 capacity, weapon-default polarities, and a zero- or one-Forma budget; every modeled compatible Arcane rank is rescored for each legal ranked loadout. The exact Expected TTK evaluator independently ranks each scored configuration, and the test checks the optimizer score, legal capacity, Forma budget, and owned-rank caps.

All four optimizer outputs match the exhaustive finite score in the seeded sampled pools. The focused run passes 1/1 in 135.45s test time (138.64s total process after the type-only fix). Focused ESLint and `git diff --check` pass. The TypeScript test project still exits with 57 diagnostics across the repository; none point into the new oracle block. The full serial suite was not rerun after this test-only addition; it passed 853/853 tests across 54 files immediately before the new oracle was added. PR [#232](https://github.com/Appl3Tree/Tenno-Hub/pull/232) merged as `d0c1ae4db73ce068867bfcccd2b06fe81213f455`; the follow-up type correction PR [#233](https://github.com/Appl3Tree/Tenno-Hub/pull/233) merged as `d5b56c8733d4985a3d877e0543dfde3683cb4a92`. Pages runs [#312](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/44975605547) and [#313](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/44975958599) succeeded. This verifies the hybrid optimizer against a bounded exact pool under realistic-style constraints; it is not full-catalog/rank/FORMA optimality, native Underframe parity, stochastic per-target history, or live-game accuracy.

## D3-OPT-EXPECTED-TTK-RANK-FORMA-LARGE-POOL-001 — seeded five-mod, three-slot rank/FORMA oracle (2026-11-22; bounded)

Reproduce with:

```sh
npx vitest run src/domain/logic/__tests__/buildOptimizer.test.ts --testNamePattern "matches a seeded five-mod, three-slot rank-limited Expected TTK oracle across weapon classes"
```

The deterministic LCG seed is `20261128`. Four fixtures draw one supported attack and five compatible, scoreable damage mods from each weapon's full pool: Braton Prime / Grineer / 70,000 Health / 2,400 Armor / Realistic; Lex Prime / shielded Corpus / 36,000 Health + 44,000 Shields / Initial; Cedo / Grineer / 140,000 Health / 1,800 Armor / Realistic; and Broken War / Infested / 95,000 Health / 300 Armor / Fully Stacked. Each mod is capped at a seeded owned rank from R1–R3, and the oracle scores every rank from R0 through that cap. It enumerates legal ordered subsets through three slots, uncatalyzed rank-10 capacity, weapon-default polarities, and alternating zero-/one-Forma budgets. The Arcane slot is deliberately empty in this combined rank/Forma pass; separate seeded tests cover joint Arcane ranks at smaller ranked pools and larger max-rank pools.

For every fixture, the optimizer matches the exact sampled-pool Expected TTK ranking, time-to-kill, and DPS. Returned builds remain capacity-valid, within the Forma budget, and below each owned-rank cap; the test also asserts that each fixture admits a legal three-mod loadout. The focused Vitest test passes 1/1 in 110.57s test time (115.53s total process). Focused ESLint and `git diff --check` pass. `npx tsc -p tsconfig.test.json --noEmit` still exits 2 on the repository's existing 57 test-project diagnostics; none point into the new test block. The full optimizer file and serial suite were not rerun after this test-only change, and no production build or deployment applies.

This is exact only within four seeded five-mod pools. It is not full-catalog or global quality evidence, does not combine the rank/FORMA constraints with Arcane search in this pass, and does not establish Underframe objective or simulator parity, stochastic proc histories, or live-game performance.


PR #240 was squash-merged as caaa7d805cb334f57a22bd7ddb408345777042ff. This adds a deterministic test only; no application bundle or Pages deployment applies.

## D3-OPT-RANK-LIMITED-FOUR-SLOT-DUAL-OBJECTIVE-ORACLE-001 — seeded four-mod owned-rank four-slot oracle (2026-11-22; bounded)

Reproduce with:

```sh
npx vitest run src/domain/logic/__tests__/buildOptimizer.test.ts -t "seeded four-mod, four-slot owned-rank" --reporter=dot --configLoader runner
```

The deterministic LCG seed is `20261149`. Four fixtures draw one supported attack and four compatible, fully scoreable damage mods from each full pool: Braton Prime / Grineer / 82,000 Health / 2,700 Armor / Realistic; Lex Prime / shielded Corpus / 42,000 Health + 58,000 Shields / Initial; Cedo / Grineer / 155,000 Health / 2,100 Armor / Realistic; and Broken War / Infested / 108,000 Health / 300 Armor / Fully Stacked. Each mod has a seeded owned-rank cap from R1–R3; the exact oracle evaluates every rank from R0 through the cap and every legal ordered subset through four slots. Builds use rank-30 uncatalyzed capacity, weapon-default polarities, alternating zero-/one-Forma limits, and no Arcane. Expected TTK uses each fixture's listed target; the `[0,5s)` score uses a separate 1,000,000-Health target (plus 1,000,000 Shields for Corpus) to avoid target defeat clipping.

All four optimizer outputs match the independently scored sampled-pool winner for both Expected TTK and five-second Avg DPS, including TTK/DPS or total-window-damage values. Returned lists remain legal for capacity, Forma, and owned ranks. The focused Vitest test passes 1/1 in 192.86s test time (196.26s total process); `npx tsc -p tsconfig.test.json --noEmit --pretty false --tsBuildInfoFile "$env:TEMP\tenno-hub-underframe-owned-rank.tsbuildinfo"`, focused ESLint, and `git diff --check` pass. The full suite was not rerun after this test-only change; no application build or deployment applies.

This adds four-slot rank-limited evidence alongside the separate five-slot R1 and four-slot max-rank oracles. It remains exact only within four seeded four-mod pools; it does not establish full-catalog/global quality, joint Arcane search, Underframe native objective/simulator parity, stochastic proc histories, or gameplay accuracy.

PR [#283](https://github.com/Appl3Tree/Tenno-Hub/pull/283) squash-merged as `9fd335942d577b8ba1e25b98635e1449bc83cff2`. GitHub reported no status check contexts. This test/docs-only merge has no application build or deployment.

## D3-OPT-EXPECTED-TTK-SIX-MOD-FOUR-SLOT-ORACLE-001 — seeded six-mod, four-slot max-rank Expected TTK oracle (2026-11-22; bounded)

Reproduce with:

```sh
npx vitest run src/domain/logic/__tests__/buildOptimizer.test.ts -t "seeded six-mod, four-slot max-rank Expected TTK oracle"
```

The deterministic LCG seed is `20261129`. Four fixtures draw one supported attack and six fully scoreable, compatible damage mods from the full pool for Braton Prime / Grineer (82,000 Health / 2,700 Armor / Realistic), Lex Prime / shielded Corpus (42,000 Health + 58,000 Shields / Initial), Cedo / Grineer (155,000 Health / 2,100 Armor / Realistic), and Broken War / Infested (108,000 Health / 300 Armor / Fully Stacked). Every candidate is evaluated at maximum rank. The oracle enumerates legal ordered subsets through four slots, with Catalyst capacity, weapon-default polarities, and alternating zero-/one-Forma budgets; no Arcane is optimized in this pass.

For each fixture, the optimizer matches the independent exact sampled-pool Expected TTK ranking, time-to-kill, and DPS. Its result is capacity-valid, within the Forma budget, and max rank. The focused Vitest run passes 1/1 in 10.42s test time (13.80s total process); focused ESLint and `git diff --check` pass. `npx tsc -p tsconfig.test.json --noEmit` still exits 2 on 57 existing repository diagnostics, none in the new test block. The full optimizer file and serial suite were not rerun after this test-only change; no production build or deployment applies.

This is an exact oracle only inside four seeded six-mod pools. It expands max-rank sampled-pool search from five mods/three slots to six mods/four slots. It does not cover full-catalog/global optimality, rank search in the same pass, joint Arcane search, Underframe's native objective/simulator, stochastic proc histories, or live-game performance.

PR [#248](https://github.com/Appl3Tree/Tenno-Hub/pull/248) was squash-merged as `403d6093942b6fab46369d38168c6b21a447f563`. This test/docs-only change has no app deployment.

## D3-OPT-FIXED-WINDOW-SIX-MOD-FOUR-SLOT-ORACLE-001 — seeded six-mod, four-slot max-rank 5s Avg DPS oracle (2026-11-22; bounded)

Reproduce with:

```sh
npx vitest run src/domain/logic/__tests__/buildOptimizer.test.ts -t "seeded six-mod, four-slot max-rank 5s Avg DPS oracle"
```

The deterministic LCG seed is `20261130`. Four fixtures draw one supported attack and six fully scoreable, compatible damage mods from the full pool for Braton Prime / Grineer (1,000,000 Health / 2,700 Armor / Realistic), Lex Prime / shielded Corpus (1,000,000 Health + 1,000,000 Shields / Initial), Cedo / Grineer (1,000,000 Health / 2,100 Armor / Realistic), and Broken War / Infested (1,000,000 Health / 300 Armor / Fully Stacked). Candidates are evaluated at maximum rank. The oracle enumerates legal ordered subsets through four slots with Catalyst capacity, weapon-default polarities, and alternating zero-/one-Forma budgets; no Arcane is optimized. The large health pools keep the 5s window below target defeat.

All four optimizer outputs match the exact sampled-pool 5s Avg DPS and total-window-damage winners. Returned builds are capacity-valid, within their Forma budgets, and max rank. Focused Vitest passes 1/1 in 0.99s test time (4.23s total process); focused ESLint and `git diff --check` pass. `npx tsc -p tsconfig.test.json --noEmit` exits 2 on 57 existing repository diagnostics, none in the new test block. The full optimizer file and serial suite were not rerun after this test-only change; no production build or deployment applies.

This exact check spans four seeded six-mod pools, not each weapon's full catalog. It adds the 5s Avg DPS objective at four slots with a limited Forma budget; it does not combine rank choice or Arcane optimization in this pass, establish global quality, reproduce Underframe's native simulator, model stochastic proc histories, or validate live gameplay.

PR [#250](https://github.com/Appl3Tree/Tenno-Hub/pull/250) was squash-merged as `cad9e7190c7ac97e075cb280ba9e5de327c5fcd7`. This test/docs-only change has no app deployment.

## D3-ATTACK-MODEL-LARKSPUR-KNOCKDOWN-BOUNDARY-001 — charged single-target score boundary (2026-11-22; released)

The current [Larkspur](https://wiki.warframe.com/w/Larkspur) source describes a forced Knockdown on charged Alt-Fire. Current [Condition Overload](https://wiki.warframe.com/w/Condition_Overload) and [Galvanized Aptitude](https://wiki.warframe.com/w/Galvanized_Aptitude) pages say Knockdown contributes to unique status-count damage for later hits when the enemy accepts the effect; target conditions that prevent Knockdown also prevent this contribution. These pages do not provide a general encounter expiry model. The current catalog returns 38 compatible Arch-Gun mods for each Larkspur profile; none has a positive directDamagePerStatusBonus or conditionOverloadDamagePerStatusBonus at any rank, and none of the attacks has intrinsic per-status direct damage. The charged Alt-Fire score therefore now includes the directly hit projectile and its linked explosion while explicitly leaving Knockdown control, susceptibility/expiry, collateral, and status priming for a different weapon outside the selected-weapon damage score. Larkspur Prime's page remains marked under active revision.

Focused tests: weaponCatalog.test.ts 24/24; the targeted optimizer test 1/1 across Larkspur and Larkspur Prime in Burst and Expected TTK modes using the compatible mod pool; Larkspur damage-calculator tests 2/2. The full optimizer file passes 172/172 in 839.20s. App TypeScript/build, source validation, mod-effect coverage audit (697 profiles / 600 eligible mods / 494 parsed / 68 review candidates / zero empty pools), focused ESLint, and CRLF-aware git diff --check pass. A full-pool eight-slot Larkspur Archwing / Grineer / 100,000 Health / 3,000 Armor / Realistic / Catalyst / up to three Forma / no Arcane Expected TTK run returned a capacity-valid three-Forma build: Primed Rubedo-Lined Barrel R10, Venomous Clip R5, Hypothermic Shell R3, Contamination Casing R3, Magma Chamber R3, Automatic Trigger R5, Magnetized Cycle R3, and Primed Dual Rounds R10, scoring 2.6316s Expected TTK / 38,000 modeled DPS. The optimizer evaluated 133 candidates in 2.899s in the first capture. A separate full-pool audit with `scripts/auditExpectedTtkFullPool.ts --weapon=Larkspur --attack='Alt-Fire Projectile Impact' --state=realistic --faction=Grineer --health=100000 --armor=3000 --slots=8 --forma=3` returned the same list and score in 2.292s; it exact-scored all 191 legal one-mod neighbors, none of which improved TTK. This enables a previously blocked attack score; there is no pre-change optimizer baseline or matched Underframe result. The complete repository suite was not rerun.

This bounded single-target conclusion depends on current Arch-Gun compatible pools and attack effects. Reopen if future catalog/source evidence adds a direct per-status damage effect or if the selected-target model begins scoring cross-weapon setup; the broader target-specific Knockdown history/expiry model remains open. PR [#241](https://github.com/Appl3Tree/Tenno-Hub/pull/241) squash-merged as 28ff1ac218682877b3da9ef37802aa019827b52a, and Pages run [#321](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/44997848743) succeeded. Hosted IAB at version=28ff1ac confirms the explanatory note on Larkspur Archwing and Larkspur Prime Archwing; the 390×844 check found no horizontal overflow. The local localhost build remains stale at 2bf6faea. There is no matched Underframe result or live-game validation, and the full repository suite was not rerun.

## Featured Arch-Gun and Beast Companion search boundary (2026-11-22)

Read-only IAB inspection covered 5 of 11 public Featured Arch-Gun builds: Mausolon, Arbucep, Kuva Ayanga, Cortege, and Dual Decurions. Their displayed mod lists were respectively -19/60, -48/60, -21/60, -28/60, and -31/60 capacity, all at zero Forma. The Mausolon Stats view exposed modded weapon statistics but no objective DPS/TTK result in the inspected public view.

The public Beast Companion filter returned three featured pages; Pharaoh Predasite Mecha and Huras were inspected. Both companion configurations showed -18/60 capacity, and their claw builds showed -24/60, all at zero Forma. The visible Stats/Target Dummy view exposed no usable objective-scored result in the pages inspected.

This search produced no legal, on-page objective-scored comparison fixture. Build Details and Copy & Edit/Test controls were left untouched; no saved build was edited. The matched Underframe corpus remains open. These counts describe the inspected sample, not every Featured Build page.

## Mausolon Archwing Auto range-source recheck (2026-11-22)

The current [Mausolon](https://wiki.warframe.com/w/Mausolon) page lists Auto as hit-scan with a 300m Range and a separate 1,400–2,800m falloff profile. The general [Range](https://wiki.warframe.com/w/Range) page names Archguns as exceptions to the default 300m hit-scan range, while [Damage Falloff](https://wiki.warframe.com/w/Damage_Falloff) states a universal 300m hit-scan shot limit except for Sniper Rifles and does not give Archguns a corresponding exception. These Wiki statements do not resolve whether Mausolon Archwing Auto can register hits between 300m and 2,800m.

The existing profile-specific model remains in place: Mausolon Atmosphere Auto enforces 300m; Archwing Auto uses its sourced falloff and displays the conflicting 300m maximum as informational. This source review does not establish game behavior, so direct gameplay verification remains open. No app scoring change was made.

## D3-OPT-EIGHT-MOD-FIVE-SLOT-ORACLE-001 — seeded eight-mod, five-slot max-rank dual-objective oracle (2026-11-22; bounded)

Reproduce with:

```sh
npx vitest run --maxWorkers=1 src/domain/logic/__tests__/buildOptimizer.test.ts -t "seeded eight-mod, five-slot max-rank Expected TTK and 5s DPS oracles" --reporter=dot --configLoader runner
```

The deterministic LCG seed is `20261133`. For each of four profiles—Braton Prime / Grineer, Lex Prime / shielded Corpus, Cedo / Grineer, and Broken War / Infested—the test draws a supported attack and eight compatible, fully scoreable damage mods from the full weapon pool. It enumerates legal ordered loadouts through five slots using a Catalyst, weapon-default polarities, max-rank mods, and alternating zero/one-Forma budgets. Expected TTK is scored against the existing 82,000-Health / 2,700-Armor Braton, 42,000-Health + 58,000-Shield Lex, 155,000-Health / 2,100-Armor Cedo, and 108,000-Health / 300-Armor Broken War targets. The same sampled mods and attack are independently scored for uncapped `[0,5s)` Avg DPS against a one-million-Health target, with one million Shields for Corpus.

All four optimizer results match the exact sampled-pool winner for both objectives and remain capacity-valid, max-rank, and within the Forma limit. Focused Vitest passes 1/1 in 218.09s. `npx tsc -p tsconfig.test.json --noEmit --pretty false`, focused ESLint, and `git diff --check` pass. The full suite, app build, and deployment were not run; GitHub reported no workflow runs.

This expands the sampled pool from seven to eight mods while retaining five slots and both objectives. It is exact only within these four seeded pools; it does not establish full-catalog/global optimality, joint rank/Arcane search at this pool size, Underframe parity, or gameplay accuracy.

PR [#262](https://github.com/Appl3Tree/Tenno-Hub/pull/262) squash-merged as `01b5accd026efd50308d9c5a771ffb1b9d0359b6`. This test-only change has no app deployment.
## D3-OPT-SEVEN-MOD-FIVE-SLOT-ORACLE-001 — seeded seven-mod, five-slot exact dual-objective oracle (2026-11-22; bounded)

Reproduce with:

```sh
npx vitest run src/domain/logic/__tests__/buildOptimizer.test.ts -t "seeded seven-mod, five-slot max-rank Expected TTK and 5s DPS oracles" --reporter=dot --configLoader runner
```

The deterministic LCG seed is `20261132`. For each of four weapon classes—Braton Prime / Grineer, Lex Prime / shielded Corpus, Cedo / Grineer, and Broken War / Infested—the test draws a supported attack and seven fully modeled, compatible max-rank damage mods from the full weapon pool. It enumerates legal ordered subsets through five slots with a Catalyst, weapon-default polarities, and alternating zero/one-Forma budgets. Every accepted build is exact-scored for finite Expected TTK using the existing 82,000-Health Braton, 42,000-Health + 58,000-Shield Lex, 155,000-Health Cedo, and 108,000-Health Broken War target fixtures. The same sampled candidates and attack are independently scored for `[0,5s)` Avg DPS against an uncapped one-million-Health target; Corpus also has one million Shields. All four optimizer results match both objective winners, remain capacity-valid and max-rank, use no more than their Forma budget, and admit a legal five-mod build. The exact enumeration considers at most 3,620 ordered subset prefixes per fixture before incompatibility, placement, and capacity checks.

Focused Vitest passes 1/1 in 158.36s test time. `npx tsc -p tsconfig.test.json --noEmit --pretty false`, focused ESLint, and `git diff --check` pass. The default Vite config bundler failed before test startup because it could not write its temp bundle under the shared `node_modules` path; the supported runner config loader avoids that write. No application source, full suite, or production build changed.

This is exact only inside four seeded seven-mod pools. It expands both tested objectives from six sampled mods/four slots to seven/five; it does not establish full-catalog/global optimality, joint rank/Arcane optimization at this pool size, Underframe's private simulator, or live-game accuracy.

PR [#255](https://github.com/Appl3Tree/Tenno-Hub/pull/255) squash-merged this test/documentation change as `b820526ca016fb4ea4d61f660fbf63ed157bac50`. GitHub reported no status checks or PR-triggered workflow runs; no application deployment applies.

## D3-OPT-RANK-LIMITED-SIX-MOD-THREE-SLOT-DUAL-OBJECTIVE-ORACLE-001 — seeded six-mod owned-rank Expected TTK and fixed-window oracle (2026-11-22 / 2026-11-23; bounded)

Reproduce with:

```sh
npx vitest run src/domain/logic/__tests__/buildOptimizer.test.ts -t "seeded six-mod, three-slot rank-limited Expected TTK and five-second DPS oracle" --reporter=dot --configLoader runner
```

Seed `20261137` draws six fully modeled, pairwise-compatible mods with owned rank caps from R1–R3 and a supported attack from each of four fixtures: Braton Prime / Grineer / 70,000 Health / 2,400 Armor / Realistic; Lex Prime / shielded Corpus / 36,000 Health + 44,000 Shields / Initial; Cedo / Grineer / 140,000 Health / 1,800 Armor / Realistic; and Broken War / Infested / 95,000 Health / 300 Armor / Fully Stacked. The oracle independently evaluates every legal ordered subset through three slots, every rank tuple through each owned cap, and zero/one-Forma placements with uncatalyzed rank-10 capacity, default polarities, and no Arcane. It compares both finite Expected TTK and uncapped `[0,5s)` Avg DPS against the optimizer, including time, DPS, and total window damage, and asserts capacity, Forma, owned-rank, and surviving-target legality. The optimizer matches the exact sampled-pool winner for both objectives in all four fixtures.

The original Expected TTK-only run passed 1/1 in 108.97s. The expanded two-objective regression passes 1/1 in 132.72s. `npx tsc -p tsconfig.test.json --noEmit --incremental false --pretty false`, focused ESLint, and `git diff --check` pass. The repository suite was not rerun; this is test/docs-only and has no application build or deployment. The original Expected TTK coverage is in PR [#268](https://github.com/Appl3Tree/Tenno-Hub/pull/268); the dual-objective extension was released in PR [#323](https://github.com/Appl3Tree/Tenno-Hub/pull/323), squash merge `46d5c34a479ee11f5ce41b587ebd02ed047912b3`. This adds fixed-window scoring to that same seeded sample; it does not establish full-catalog/global optimality, joint Arcane search, Underframe parity, or gameplay accuracy.

## D3-MECH-WEAKPOINT-TRIGGER-CONDITIONALS-001 — target-aware weak-point hit triggers (merged; later deployed in Pages run #397)

Source: the current [Pain Points Wiki page](https://wiki.warframe.com/w/Pain_Points) lists +60% Weak Point Damage per stack at max rank on Primary Fire weak-point hits, lasting 5 seconds, up to 10 stacks. It says all stacks expire together when the latest stack expires. The page was checked in the in-app browser. It does not specify a discrete hit distribution, first-hit ordering, or how multiple projectiles striking the same weakpoint frame are counted.

The calculator now derives qualifying event rate from the target profile's head-weakpoint flag, configured head-hit share, unconditional-modified fire rate, and expected projectile count. Conditional fire-rate and multishot bonuses are deliberately excluded from that event rate to avoid a circular trigger estimate. Realistic arrivals are an independent Poisson approximation. Pain Points' expected active count at a random point in a long-running, single-target sequence is `E[min(Poisson(rate × 5s), 10)]`; this matches the Wiki's shared 5-second expiry timer under the stated arrival assumption. Only Primary Fire qualifies in Realistic, and area coverage is not scored. With a target lacking a modeled head weakpoint or a zero head-hit share, Realistic grants no stacks. Initial assumes zero stacks; Fully Stacked and Custom intentionally inject their selected stack scenario without replaying trigger history, including on an Alt-Fire row, and the explanation labels that as a scenario override.

Weak-point hit and kill conditional effects are removed from finite Expected TTK and `[0,5s)` scoring until the event simulator records their trigger history. Realistic weak-point-kill uptime still uses a head-hit/kill-rate approximation and is not source-validated; do not treat it as a finite kill timeline. The model also does not simulate non-head weakpoints, first-shot/initial-stack ordering, pellet/spread correlation, target movement, projectile travel, multi-target hit distribution, or area coverage. This is bounded common-model scoring, not Underframe parity or live-game validation.

Focused Pain Points/parser/optimizer/calculator regressions passed 3/3 before the explanation-mode refinement; the focused optimizer/explanation regression passes 1/1 after the refinement, including Realistic, Initial, Fully Stacked, Custom, target gates, Primary Fire/Alt-Fire, and finite-score exclusion. The complete `damageCalc.test.ts` passes 152/152. App and node TypeScript checks, `npm run validate:sources`, `npm run audit:prerequisites` (162 entries; no unresolved references/cycles), and `npm run audit:mod-effect-coverage` (697 profiles / 600 mod records / 495 parsed max-rank effects / 105 with none / 69 review candidates / zero empty weapon pools) pass. Focused ESLint and CRLF-aware diff check pass. `npm run build` cannot write the shared `node_modules/.tmp` build-info file (`EPERM`); direct app/node typechecks pass, and `npx vite build --configLoader runner --outDir dist-weakpoint-20261122` builds 987 modules successfully in 9.97s with the repository's existing large-chunk warning.

In-app-browser review of the preceding copy-only revision showed Athodai against the named Lancer with a 100% assumed head-hit share: adding max-rank Pain Points changed displayed Burst from 2,058 to 8,233. This was a temporary unsaved build. The final mode-specific explanation text correction passed its focused unit test, app typecheck, lint, and production bundle; that revised copy was not separately rendered. PR [#280](https://github.com/Appl3Tree/Tenno-Hub/pull/280) was squash-merged as `70a73ffcd4ef3fe125d395cbc34012340151b59d`. GitHub reported no PR checks/status contexts or PR-triggered workflows, so the Pages deployment was not independently verified. Full optimizer/repository suites, a matched Underframe comparison, hosted review, and live-game validation remain open.

## D3-OPT-WINDOWDPS-SEED-CORPUS-GRINEER-001 — additional seeded Grineer fixed-window neighborhood (2026-11-23; bounded)

Reproduce with `npx tsx scripts/auditFixedWindowDpsCorpus.ts --seed=20261150 --runs=1`. The runner combines the same eight fixed control fixtures with one Mulberry32 draw from each explosive-primary, Archgun, companion-weapon, and heavy-melee stratum. Seed `20261150` selected Kuva Ogris / Rocket Explosion, Corvas Prime / Charged Shot, Helstrum / Explosion, and Gram Prime / Heavy Slam Attack.

All twelve cases use Grineer / 2,000,000 Health / 3,000 Armor / zero Shields and Overguard / Realistic state / `[0,5s)` / eight slots / Catalyst / MR30 / up to three Forma, without Exilus or Arcane optimization. The 2m target survives every window, so scores are below the 400,000 DPS health ceiling. Every returned build passed the Tenno-Hub capacity and Forma checks. Each optimizer baseline was compared with every exact legal one-mod addition, removal, or replacement at max rank.

| Fixture | Selection | Tenno-Hub `[0,5s)` DPS | Exact legal one-mod neighbors | Improving neighbor |
| --- | --- | ---: | ---: | --- |
| Braton Prime / Normal Attack | Fixed control | 30,707.94 | 226 | None |
| Cedo / Normal Attack | Fixed control | 29,769.16 | 367 | None |
| Laetum / Normal Attack | Fixed control | 56,869.97 | 286 | None |
| Soma Prime / Fully Spooled | Fixed control | 45,602.16 | 414 | None |
| Broken War / Normal Attack | Fixed control | 5,071.25 | 387 | None |
| Kuva Nukor / Normal Attack | Fixed control | 61,237.29 | 436 | None |
| Nataruk / Perfect Shot | Fixed control | 97,782.77 | 403 | None |
| Torid / Grenade Impact | Fixed control | 10,876.37 | 295 | None |
| Kuva Ogris / Rocket Explosion | Seeded explosive primary | 42,749.00 | 450 | None |
| Corvas Prime / Charged Shot | Seeded Archgun | 134,573.95 | 191 | None |
| Helstrum / Explosion | Seeded companion weapon | 277.20 | 280 | None |
| Gram Prime / Heavy Slam Attack | Seeded heavy melee | 38,451.54 | 353 | None |

The run scored 4,088 legal neighbors total, with no improving move. It used one optimizer run per fixture, so it does not measure repeated-run variance. The fixed anchors are harness controls; the four seeded rows are the incremental stratum sample. The small seeded pools and one-mod neighborhoods do not establish full-catalog or global optimality. These results validate only the deterministic Tenno-Hub model under this synthetic Grineer target; Underframe's website objective, conditional sampling, private engine, and live-game behavior remain unresolved.

## D3-OPT-WINDOWDPS-SEED-PAIR-SAMPLE-GRINEER-001 — seeded two-mod sample for the Grineer corpus (2026-11-23; bounded)

Reproduce with `npx tsx scripts/auditFixedWindowDpsPairSample.ts --seed=20261150 --samples=1024 --faction=Grineer --health=2000000 --armor=3000`. This uses the same eight fixed controls and four seeded strata picks listed in the preceding Grineer one-mod audit. For each fixture, the runner derives its own deterministic seed and samples 1,024 legal max-rank two-out/two-in replacements without replacement from the eligible full-catalog pair tuples. Each candidate is exactly scored with the deterministic `[0,5s)` evaluator and the same capacity/FORMA constraints.

| Fixture | Raw tuples examined to accept 1,024 legal pairs | Legal pairs scored | Sampled improvement |
| --- | ---: | ---: | --- |
| Braton Prime / Normal Attack | 2,802 | 1,024 | None |
| Cedo / Normal Attack | 1,646 | 1,024 | None |
| Laetum / Normal Attack | 2,246 | 1,024 | None |
| Soma Prime / Fully Spooled | 1,519 | 1,024 | None |
| Broken War / Normal Attack | 1,622 | 1,024 | None |
| Kuva Nukor / Normal Attack | 1,433 | 1,024 | None |
| Nataruk / Perfect Shot | 1,604 | 1,024 | None |
| Torid / Grenade Impact | 1,715 | 1,024 | None |
| Kuva Ogris / Rocket Explosion | 1,426 | 1,024 | None |
| Corvas Prime / Charged Shot | 1,970 | 1,024 | None |
| Helstrum / Explosion | 2,147 | 1,024 | None |
| Gram Prime / Heavy Slam Attack | 1,621 | 1,024 | None |
| **Total** | **21,751** | **12,288** | **None** |

All optimizer baselines are legal, use at most three Forma, and remain below the 2m target-health cap. This was one optimizer run per fixture; repeated-run variance was not measured. The 12,288 accepted pairs cover only a sampled portion of the legal two-mod space (the per-fixture raw tuple universes range from 13,020 to 51,240), so zero sampled improvements do not establish an exhaustive pair-local optimum. The fixed-window objective and Underframe private engine/conditional mixture remain distinct; this does not show Underframe or live-game parity.

## D3-OPT-WINDOWDPS-EXHAUSTIVE-PAIR-BRATON-CORVAS-001 — exhaustive sampled-fixture pair neighborhoods (2026-11-23; bounded)

Both runs request 100,000 accepted pairs, which exceeds each fixture's complete raw tuple universe; the runner therefore examines every raw tuple and exact-scores every legal max-rank two-out/two-in replacement. Use `--worker` so only the specified fixture runs.

| Fixture | Command seed | Raw tuple universe / examined | Legal pairs exact-scored | Baseline DPS | Best pair DPS | Improvement |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Braton Prime / Normal Attack | 2,674,696,919 | 46,284 / 46,284 | 16,966 | 30,707.94 | 29,227.89 | None |
| Corvas Prime / Charged Shot | 1,808,719,306 | 13,020 / 13,020 | 6,786 | 134,573.95 | 104,951.53 | None |

Reproduce Braton Prime with `npx tsx scripts/auditFixedWindowDpsPairSample.ts --worker --weapon="Braton Prime" --attack="Normal Attack" --samples=100000 --seed=2674696919 --faction=Grineer --health=2000000 --armor=3000`; reproduce Corvas Prime with `npx tsx scripts/auditFixedWindowDpsPairSample.ts --worker --weapon="Corvas Prime" --attack="Charged Shot" --samples=100000 --seed=1808719306 --faction=Grineer --health=2000000 --armor=3000`.

The two legal baselines remain below the 2m Health ceiling and satisfy the eight-slot / Catalyst / three-Forma budget. No compatible Arcane, owned-rank, Forma-search, or three-plus-mod alternatives were included in these neighborhoods. This closes only these two fixed-model two-mod neighborhoods; it is not Underframe parity, a global optimizer proof, or gameplay validation.

## D3-OPT-WINDOWDPS-EXHAUSTIVE-PAIR-SEEDED-STRATA-001 — exhaustive companion and heavy-melee pair neighborhoods (2026-11-23; bounded)

The remaining seeded companion and heavy-melee fixtures from `D3-OPT-WINDOWDPS-SEED-CORPUS-GRINEER-001` were scored with the same Grineer / 2,000,000 Health / 3,000 Armor / zero Shields and Overguard / Realistic / `[0,5s)` / eight slots / Catalyst / MR30 / up to three Forma scenario. The requested 100,000 legal pairs exceeds each raw universe, so the worker enumerates every raw tuple and exact-scores every legal max-rank two-out/two-in replacement.

| Fixture | Command seed | Raw tuple universe / examined | Legal pairs exact-scored | Baseline DPS | Best pair DPS | Improvement |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Gram Prime / Heavy Slam Attack | 1,808,719,306 | 44,688 / 44,688 | 28,248 | 38,451.54 | 35,027.94 | None |
| Helstrum / Explosion | 3,449,250,833 | 46,284 / 46,284 | 21,881 | 277.20 | 276.79 | None |

Reproduce Gram Prime with `npx tsx scripts/auditFixedWindowDpsPairSample.ts --worker --weapon="Gram Prime" --attack="Heavy Slam Attack" --samples=100000 --seed=1808719306 --faction=Grineer --health=2000000 --armor=3000`; reproduce Helstrum with `npx tsx scripts/auditFixedWindowDpsPairSample.ts --worker --weapon=Helstrum --attack=Explosion --samples=100000 --seed=3449250833 --faction=Grineer --health=2000000 --armor=3000`.

Both optimizer baselines are capacity/FORMA legal and the targets survive the window. Together with the Corvas Prime / Charged Shot exact neighborhood above, these results cover three of the four seeded weapon strata; the explosive-primary stratum is documented in the following section. The separate Braton Prime audit is a fixed control. None of these neighborhoods includes rank or Forma search, Arcane combinations, three-plus-mod changes, or a Tenno-Hub-to-Underframe/gameplay comparison; they are not global optimizer evidence.

## D3-OPT-WINDOWDPS-EXHAUSTIVE-PAIR-SEEDED-EXPLOSIVE-001 — exhaustive Kuva Ogris pair neighborhood (2026-11-23; bounded)

The seeded explosive-primary fixture from `D3-OPT-WINDOWDPS-SEED-CORPUS-GRINEER-001` was scored at Grineer / 2,000,000 Health / 3,000 Armor / zero Shields and Overguard / Realistic / `[0,5s)` / eight slots / Catalyst / MR30 / up to three Forma. Requesting 100,000 legal pairs exceeds the 51,240 raw tuples, so the worker examined the entire universe and exact-scored all 36,163 legal max-rank two-out/two-in replacements.

The Kuva Ogris / Rocket Explosion optimizer baseline scores 42,749.00 DPS (213,744.99 damage in five seconds) at 77/80 capacity with zero Forma. The best legal pair scores 41,071.49 DPS; no pair improves the optimizer baseline, and the target survives the window.

Reproduce with `npx tsx scripts/auditFixedWindowDpsPairSample.ts --worker --weapon="Kuva Ogris" --attack="Rocket Explosion" --samples=100000 --seed=2435346591 --faction=Grineer --health=2000000 --armor=3000`.

Together with the Corvas Prime, Gram Prime, and Helstrum results above, all four seeded weapon-stratum picks now have exhaustive max-rank two-mod neighborhoods. Braton Prime is a separate fixed control. This is bounded Tenno-Hub model evidence only, without Arcane/rank/FORMA search, Underframe parity, global optimizer, or gameplay claims.

## D3-OPT-WINDOWDPS-FACTION-PAIR-SAMPLE-001 — seeded shielded-Corpus and unarmored-Infested pair samples (2026-11-23; bounded)

Both runs use the same eight fixed controls plus one seeded explosive-primary, Archgun, companion-weapon, and heavy-melee pick. Each fixture samples 1,024 legal max-rank two-out/two-in replacements without replacement and exact-scores accepted pairs under Realistic state, `[0,5s)`, eight slots, Catalyst, MR30, up to three Forma, no Exilus, and no Arcane optimization.

The shielded-Corpus run uses `npx tsx scripts/auditFixedWindowDpsPairSample.ts --seed=20261151 --samples=1024 --faction=Corpus --health=2000000 --shields=2000000 --armor=0`.

| Fixture | Raw tuples examined for 1,024 legal pairs | Improvements |
| --- | ---: | --- |
| Braton Prime / Normal Attack | 2,794 | None |
| Cedo / Normal Attack | 1,698 | None |
| Laetum / Normal Attack | 2,275 | None |
| Soma Prime / Fully Spooled | 1,805 | None |
| Broken War / Normal Attack | 1,653 | None |
| Kuva Nukor / Normal Attack | 1,563 | None |
| Nataruk / Perfect Shot | 1,573 | None |
| Torid / Grenade Impact | 2,727 | None |
| Acceltra Prime / Rocket Explosion (seeded) | 1,691 | None |
| Mausolon (Archwing) / Auto (seeded, 250m) | 2,440 | None |
| Verglas Prime / Normal Attack (seeded) | 1,909 | None |
| Arca Titron / Heavy Slam Attack (seeded) | 1,488 | None |
| **Total** | **23,616** | **None** |

The target pool is 2,000,000 Health + 2,000,000 Shields / zero Armor and Overguard. A focused worker replay of the Mausolon (Archwing) fixture at 250m confirms a legal 59/60, three-Forma baseline at 795,564.84 DPS / 3,977,824.21 applied damage; it survives the window by about 22,176 damage. This row is close to the clipping boundary, so do not infer survival for every other Corpus baseline from this check alone.

The unarmored-Infested run uses `npx tsx scripts/auditFixedWindowDpsPairSample.ts --seed=20261152 --samples=1024 --faction=Infested --health=10000000 --shields=0 --armor=0`.

| Fixture | Raw tuples examined for 1,024 legal pairs | Improvements |
| --- | ---: | --- |
| Braton Prime / Normal Attack | 1,609 | None |
| Cedo / Normal Attack | 1,667 | None |
| Laetum / Normal Attack | 2,170 | None |
| Soma Prime / Fully Spooled | 1,763 | None |
| Broken War / Normal Attack | 1,536 | None |
| Kuva Nukor / Normal Attack | 1,442 | None |
| Nataruk / Perfect Shot | 1,560 | None |
| Torid / Grenade Impact | 2,739 | None |
| Acceltra Prime / Rocket Explosion (seeded) | 2,020 | None |
| Mausolon (Archwing) / Auto (seeded, 250m) | 2,410 | None |
| Verglas Prime / Normal Attack (seeded) | 2,214 | None |
| Arca Titron / Heavy Slam Attack (seeded) | 1,566 | None |
| **Total** | **22,696** | **None** |

The Infested target has 10,000,000 Health / zero Shields, Armor, and Overguard. The highest optimizer baseline is Mausolon (Archwing) at 945,066.68 DPS, or 4,725,333.38 applied damage; all 12 targets survive this window. Across the two factions, 24,576 legal pairs were sampled from 46,312 raw proposals with no improving sampled pair. This does not establish exhaustive pair optimality, global quality, Underframe parity, or gameplay accuracy.

The first 1,024-pair Corpus run emitted a stale inherited `assumptions.faction: Grineer` field from the Grineer corpus definition, even though the root target profile and all worker arguments were Corpus. The report builder now overwrites `assumptions.faction` and `assumptions.target` from the pair-run arguments. ESLint, node-project TypeScript, and diff check pass; a 1-pair-per-fixture Corpus smoke reports Corpus / 2,000,000 Health + 2,000,000 Shields / zero Armor. The scoring run itself was unchanged; its worker commands already received the requested Corpus target.

## D3-OPT-UNDERFRAME-FIXED-WINDOW-DISTANCE-002 — explicit distance in captured fixed-window comparisons (2026-11-22; bounded)

`scripts/compareUnderframeFixedWindowDps.ts` now accepts `--distance=<meters>` and applies that physical distance to both target-distance conditionals and the selected attack's sourced falloff/range. A fixture can also retain a captured distance and its evidence note; a CLI value overrides it. The helper rejects a selected attack with a sourced falloff or hit-range rule when neither source provides a distance. It reports the selected profile's falloff/range and distance source. When the source-backed profile predicts a hard-range miss, it records the captured-list zero and skips optimization instead of presenting an arbitrary all-zero optimizer result.

The Mausolon Atmosphere Auto capture now stores the visible Underframe distance slider at 1,400m. The recorded native page is inferred as Atmosphere from its 180 Auto / 72 radial stats; it has no explicit profile selector. At Grineer / 2,000,000 Health / 3,000 Armor / 1,400m, Underframe Standard Calculate DPS returned 25,504 DPS in one read with the target alive. The Tenno-Hub Atmosphere profile enforces its sourced 300m hard cap, so the same recorded distance yields zero modeled damage and the optimizer is skipped. This reproduces the existing source/profile conflict; it does not establish Underframe's actual Mausolon profile, scoring semantics, or gameplay behavior.

An explicit in-range `--distance=250` override smoke shows the captured list at 8,546.40 modeled DPS / 42,732.00 damage in `[0,5s)` and the Tenno-Hub optimizer at 315,041.23 DPS / 1,575,206.13 damage, legal at 59/60 capacity with three Forma and 261 candidates. This repeats the model-local fallback score from the earlier Atmosphere audit; Underframe's slider cannot select 250m, so there is no native same-distance result to compare.

Validation: `npx eslint scripts/compareUnderframeFixedWindowDps.ts`, `npx tsc -p tsconfig.node.json --noEmit --pretty false --incremental false`, fixture JSON parse, and `git diff --check` pass. Targeted 1,400m and 250m runner smokes pass. The full suite and app build were not run because only the comparison helper/capture and documentation changed; no saved Underframe build or Tenno-Hub build was modified.
## D3-MECH-SIMULOR-ORB-HISTORY-BOUNDARY-001 — Simulor and Synoid Simulor scoring boundary (2026-11-23; released)

The current [Simulor Wiki page](https://wiki.warframe.com/w/Simulor) says launched orbs deal no damage on their own; damage comes from merging orbs and later detonating the resulting state. Orb explosions can be manually triggered or occur after their listed 20-second lifetime. The [Synoid Simulor page](https://wiki.warframe.com/w/Synoid_Simulor) also lists a four-orb fully stacked singularity with damage over time. Those rows require the number, merge state, timing, and persistence of deployed orbs. The calculator models one selected attack row at a time and has no event history for these states.

Every catalogued Simulor and Synoid Simulor attack row now exposes a source-linked limitation and is excluded from damage scoring and Auto Optimize. This includes Orb Launch, Orb Merging Damage, Orb Explosion, and Synoid's Fully Stacked Orb Singularity. The weapon/component statistics remain available for reference; no damage, finite TTK, or fixed-window DPS claim is produced. This closes a false-score risk by making the unsupported history visible rather than treating a launcher row as a standalone hit.

Validation: the focused optimizer regression passes 1/1 (covering every row, source link, selected-row limitation propagation, Burst rejection, and finite Expected TTK rejection); app/test TypeScript, `npx tsx scripts/validateSources.cli.ts`, and focused ESLint pass; a 987-module Vite production build succeeds to temporary output; CRLF-aware `git diff --check` passes. The full repository suite was not rerun. PR [#298](https://github.com/Appl3Tree/Tenno-Hub/pull/298) squash-merged as `4095a86f10e57cf5b9e0ee511c0e4d67bbc1382a`. GitHub reports no PR-triggered workflow runs, so Pages deployment is unverified. The integrated browser's supplied localhost is stale at `version=2bf6faea`, and a current-source Vite preview on port 5178 timed out; current-source visual verification is open. No Underframe build was modified, and this is not gameplay or Underframe validation.

Penta's bounded immediate single-grenade sequence is recorded below following the user's scope decision. Simulor and Synoid Simulor remain reference-only because their merge and detonation state requires multi-orb history.

## D3-MECH-PENTA-SINGLE-GRENADE-SEQUENCE-001 — immediate single-grenade impact plus detonation (2026-11-23; released)

The user approved an immediate single-target impact-plus-detonation sequence for Burst and finite Expected TTK, with grenade flight, preloaded multi-grenade bursts, and AoE coverage excluded. The current [Penta Wiki page](https://wiki.warframe.com/w/Penta) says grenades have no arming delay and can be detonated instantly with Secondary Fire. It lists Grenade Impact and Grenade Detonation as separate damage events; [Trigger Type](https://wiki.warframe.com/w/Trigger_Type) identifies Active triggers as deployable shots manually detonated with Alternate Fire. The single-target model assumes one grenade hits the selected target and is manually detonated immediately at impact; it omits flight time, any stored multi-grenade volley, and all other targets in the blast radius.

All three catalogued weapon profiles use a linked impact-to-detonation event at zero modeled delay. Penta and Carmine Penta link 75 Impact + 350 Blast, with radial falloff from 100% at 0m to 50% at 4m. Secura Penta links 75 Impact + 300 Blast, with radial falloff from 100% at 0m to 40% at 6m. These values come from the variant pages: [Carmine Penta](https://wiki.warframe.com/w/Carmine_Penta) and [Secura Penta](https://wiki.warframe.com/w/Secura_Penta). The linked event uses the directly struck target at the explosion center, so the single-target score represents center damage. The standalone Grenade Detonation row remains reference-only and directs the user to select Grenade Impact; it must not be optimized as an independent primary attack.

The catalog regression checks all three profile identities, trigger type, source attack values, linked event, zero-delay assumption, boundary note, and variant falloff. Calculator tests verify that the linked component damage flows into one impact event. The optimizer regression confirms Burst remains available, finite Expected TTK is lower with the linked detonation than with impact alone for a 1,000-Health unarmored target, and the standalone component cannot be optimized independently. The Penta-focused run passes 3/3 across the catalog, calculator, and optimizer files; app/test TypeScript, source validation, focused ESLint, temporary 987-module production build, and CRLF-aware diff check pass. The full repository suite was not rerun. Existing incomplete-effect handling continues to flag Napalm Grenades' explosion conversion/fire patch and Tether Grenades' special detonation behavior; Secura Penta's innate Sequence proc is also not included. PR [#298](https://github.com/Appl3Tree/Tenno-Hub/pull/298) squash-merged as `4095a86f10e57cf5b9e0ee511c0e4d67bbc1382a`. GitHub reports no PR-triggered workflow runs, so Pages deployment is unverified. The supplied localhost remains stale at `version=2bf6faea`, and a current-source Vite preview on port 5178 timed out in the integrated browser, so current-source rendering remains open. This is a user-approved bounded model, not gameplay or Underframe validation.

## D3-MECH-AEGRIT-SINGLE-MINE-SEQUENCE-001 — bounded direct-hit plus remote detonation (2026-11-23; released)

The current [Aegrit Wiki page](https://wiki.warframe.com/w/Aegrit) lists a 9-damage Direct Hit and a separate 797 Blast Detonation, 9m radius, and 100%→30% radial falloff. It says mines stick to surfaces including enemies and can be remotely detonated; up to four may be active together. The bounded single-target model assumes one bomb directly hits and sticks to the selected target, then is manually detonated immediately. It links Direct Hit to one Detonation against that target, applies the component's sourced falloff at the blast center, and excludes projectile flight, stored/multiple charges, and other targets in the radius. The standalone Detonation row directs selection to Direct Hit.

The [Alternate Fire Wiki page](https://wiki.warframe.com/w/Alternate_Fire) says Aegrit's detonation causes a guaranteed proc but does not identify the damage type; the Aegrit attack table/CSV lists no forced procs. No additional forced status is modeled, and the row's score-boundary note exposes this source conflict. This prevents treating an unspecified proc as a known damage effect; if the current Wiki resolves the type, revisit scoring and optimizer behavior.

The catalog regression verifies component identity, damage, radius/falloff, source links, score disclosure, and the reference-only component row. Calculator coverage verifies the linked one-hit profile and centered falloff. The optimizer regression confirms Burst and finite Expected TTK are available for the bounded Direct Hit sequence, improves TTK over the direct hit alone against an unarmored 1,000-Health target, and rejects independent Detonation scoring. The focused Aegrit run passes 3/3 across the catalog, calculator, and optimizer files; app/test TypeScript, source validation, focused ESLint, and a 987-module production Vite build to temporary output pass. Plain `git diff --check` flags the existing CRLF style in `weaponCatalog.ts`; the repository's CRLF-aware `git -c core.whitespace=cr-at-eol diff --check` passes. Full suite was not rerun. Current-source rendering remains unverified; the supplied localhost is stale. PR [#300](https://github.com/Appl3Tree/Tenno-Hub/pull/300) squash-merged as `234312105872090d4b715b8e0dd0b6737d6e7c46`. GitHub reported no status checks or PR-triggered workflows. This is a disclosed bounded model, not gameplay or Underframe validation. Reopen on evidence that direct hits fail to attach mines, detonation timing differs materially, the forced proc is identified, or another target's area coverage is required.

## D3-MECH-KULSTAR-TRIGGER-SEQUENCE-001 — direct-hit rocket and bomblet boundary (2026-11-23; released in PR #301)

The current [Kulstar Wiki page](https://wiki.warframe.com/w/Kulstar) classifies its primary fire as Semi-Auto. The upstream catalog feed labels the weapon `Active`, which incorrectly describes a manually detonated payload and can misstate the trigger cadence; the catalog now applies a weapon-level verified trigger override so the weapon and attack rows resolve to Semi-Auto. The source lists a 200 Impact Rocket Impact, a 300 Blast Rocket Explosion with 3.9m radius and 100%→60% falloff, and three bomblets released from the primary explosion in a loose arc. Multishot affects rocket count, not the fixed three child bomblets.

The bounded single-target model links one immediately centered Rocket Explosion to a Rocket Impact that directly hits the selected target. It assumes zero delay between impact and explosion and excludes projectile flight, manual mid-flight detonation, and all bomblets because target overlap cannot be inferred from the loose spread. The forced Knockdown on Rocket Impact and any status-conditioned follow-up are disclosed but not credited. Standalone Rocket Explosion and both Cluster Bomb rows are reference-only with source-linked guidance to select Rocket Impact.

Catalog tests verify the trigger correction, component damage, linked event, radial falloff, fixed bomblet count, locked child multishot, and reference-only boundaries. Calculator tests verify one centered linked blast and that Multishot does not alter the child-bomblet count. Optimizer tests confirm Burst and finite Expected TTK for the bounded sequence and reject the standalone blast/cluster rows. The focused Kulstar run passes 3/3 across catalog, calculator, and optimizer files. App/test TypeScript, source validation, focused ESLint, a 987-module production Vite build to temporary output, and CRLF-aware diff check pass. The full repository suite was not rerun. PR [#301](https://github.com/Appl3Tree/Tenno-Hub/pull/301) squash-merged as `4d1a1109b50d521acac23a97e3243b1a461d720f`. GitHub reported no status checks or PR-triggered workflows; current-source visual verification and deployment remain open. Reopen if source evidence changes the trigger or blast-on-direct-hit behavior, or establishes a reliable single-target bomblet hit rule.

## D3-MECH-THROWN-MINE-SINGLE-CHARGE-001 — Castanas family and Talons detonation profiles (2026-11-23; released in PR #302)

The current Wiki pages for [Castanas](https://wiki.warframe.com/w/Castanas), [Sancti Castanas](https://wiki.warframe.com/w/Sancti_Castanas), and [Talons](https://wiki.warframe.com/w/Talons) list separate Mid-Flight and Embedded Detonation attacks. Embedded Detonation occurs after a mine sticks to a surface or enemy and is manually triggered with Alternate Fire; the two rows are alternative modes for one thrown charge, not additive damage events. The catalog applies 100%→60% falloff over 3.6m to both Castanas profiles and 100%→50% over 4m to Talons. Embedded detonation restores the source-listed guaranteed Electricity proc for both Castanas variants and Puncture for Talons; Talons' Ragdoll control is disclosed but not simulated.

The bounded model keeps both attack rows selectable and scores each as one charge centered on the selected single target, using the Wiki-listed attack cadence. It does not sum Mid-Flight and Embedded damage. Multishot is locked to one mine because source pages say extra charges spread widely and cannot be assumed to hit the same target. Projectile travel, manual detonation intervals, preloaded stacks of up to six Castanas or eight Talons, and other blast targets are excluded. Sancti Castanas' affinity-triggered Purity radial damage and health effects are also omitted because the planner has no affinity or multi-target timeline.

Catalog regressions verify attack identities, damage/status values, falloff, forced procs, locked multishot, and boundary notes. Calculator coverage checks centered and midpoint falloff for both alternative rows and verifies multishot remains one. Optimizer coverage confirms both rows remain available to Burst and finite Expected TTK, including Sancti with its Purity disclosure. The focused run passes 3/3 across catalog, calculator, and optimizer files. App/test TypeScript, source validation, focused ESLint, a 987-module production Vite build to temporary output, and CRLF-aware diff check pass. The full suite was not run. PR [#302](https://github.com/Appl3Tree/Tenno-Hub/pull/302) squash-merged as `07fa3eb9891ce7c96b0b32e4ae05c28c9ef2fa0c`; GitHub reported no status checks or PR-triggered workflows. Current-source visual verification and deployment remain open. Reopen if source evidence changes a row's event identity, proc/falloff, multishot spread, or detonation cadence.

The current catalog inventory scan finds nine profiles (21 attack rows) with `Active` triggers. All are covered by this bounded review or a source-backed reference-only boundary: Aegrit; Penta, Carmine Penta, and Secura Penta; Castanas; Sancti Castanas; Simulor; Synoid Simulor; and Talons. Kulstar's feed label was corrected to Semi-Auto in PR #301, so it is no longer part of the Active-trigger inventory.

## D3-MECH-TRIGGER-CADENCE-AUDIT-001 — Zylok Incarnon attack trigger correction (2026-11-23; released)

The current [Zylok](https://wiki.warframe.com/w/Zylok) and [Zylok Prime](https://wiki.warframe.com/w/Zylok_Prime) pages list Incarnon Form as Charge, with a 0.60s charge time and 1/s fire rate. The weapon-comparison [CSV](https://wiki.warframe.com/w/Weapon_Comparison/CSV) also labels the direct Incarnon Form profile Charge. Both direct attack rows had inherited Duplex from the weapon feed, so the calculator used the wrong trigger cadence despite having the charge time. The catalog now overrides those two direct rows to Charge. Their separately listed Incarnon Form Radial Attack rows remain Duplex.

Catalog regressions verify each direct row's trigger and charge time and ensure its radial row stays Duplex. Calculator regressions verify the 0.6s first-shot delay and the charge-cycle effective fire rate for both weapons. Focused Zylok regressions pass 3/3; the full affected catalog and calculator files pass 191/191. App/test TypeScript, source validation, focused ESLint, a 987-module production Vite build to temporary output, and CRLF-aware diff check pass. PR [#303](https://github.com/Appl3Tree/Tenno-Hub/pull/303) squash-merged as `eb973563229de1019710f93896d637d14393e956`; GitHub reported no status checks or PR-triggered workflows. The full repository suite was not rerun, and current-source visual verification remains open because the supplied localhost serves stale `version=2bf6faea` and the temporary Vite preview timed out. This corrects two attack rows; it does not establish broad Auto/Semi/Duplex/Held cadence coverage or Underframe/gameplay parity. Reopen if current source data changes either direct trigger, charge time, or radial-row trigger.

## D3-MECH-CHARGE-TRIGGER-GATES-002 — source-backed charged attack cadence and score boundaries (2026-11-23; released in PR [#305](https://github.com/Appl3Tree/Tenno-Hub/pull/305), squash merge `41f074e91e5b4bbfaf45a51de4e4c0cc9aaa7496`)

The current [Higasa](https://wiki.warframe.com/w/Higasa), [Ambassador](https://wiki.warframe.com/w/Ambassador), [Tenet Plinx](https://wiki.warframe.com/w/Tenet_Plinx), and [EFV-5 Jupiter](https://wiki.warframe.com/w/EFV-5_Jupiter) pages expose charged attack rows whose generated profiles inherited their weapon's primary trigger. The catalog now maps Higasa Charged Shot, both Ambassador charged rows, both Tenet Plinx Alt-Fire rows, and EFV-5 Buckshot to the planner's Charge cadence. Uncharged primary rows are unchanged.

Higasa's Charged Shot has a 1s release but requires a full gauge earned through primary-fire kills or blocking. The planner does not track that gauge or setup history, so the row is reference-only. Ambassador requires 16 rounds for its charged shot and takes 2.6s to switch firing modes; the Wiki exposes 600-damage Charge and 800-damage Charged AoE rows but the planner does not bind them into one unambiguous event. Both rows remain reference-only to avoid omitting or duplicating damage. Tenet Plinx's 0.8s charge is corrected, but its Alt-Fire requires and consumes a full magazine, multiplies damage by magazine size, then explodes after a further 0.8s. Both the direct and AoE rows remain reference-only until magazine gating/scaling and delayed linked-hit cadence are modeled.

EFV-5 Buckshot carries its 1s charge, 11 pellets, 15 ammo cost, guaranteed Corrosive proc, and 5–10m falloff to a 0.79% minimum, extended by Projectile Speed. Its 24°–42° spread makes pellet hits depend on target size and overlap; the experimental estimate below requires target radius and distance. The mod [Overpressured Rounds](https://wiki.warframe.com/w/Overpressured_Rounds) buffs the next Buckshot's spread/falloff after a Rifle kill and restores magazine after Buckshot kills. Its spread value remains unknown and Auto Optimize excludes the mod; PR #346 adds the selected rank's falloff bonus to the user-entered one-shot Burst snapshot without modeling kill or attack history.

Catalog tests cover the four source-backed triggers and boundaries. The full weapon-catalog and damage-calculator files pass 198/198 tests; the focused optimizer test passes 2/2. App/test TypeScript, source validation, focused ESLint, a 987-module temporary production Vite build, and CRLF-aware diff check pass. PR #305 is merged on `main`; the full repository suite was not run. The current-source Vite preview at port 5180 timed out in the in-app browser, and the supplied localhost still serves stale `version=2bf6faea`, so rendered UI verification remains open. Underframe comparison and gameplay validation remain open. This is a bounded data/cadence correction; it does not close the optimizer corpus or live-game accuracy goals. Reopen the reference-only rows when the corresponding gauge, mode-event, magazine, or pellet-overlap mechanics are modeled or source evidence changes.

## D3-MOD-EFV-OVERPRESSURED-ROUNDS-001 — manual Burst snapshot and remaining attack-history boundary (updated by PR #346)

The [Overpressured Rounds Wiki page](https://wiki.warframe.com/w/Overpressured_Rounds) shows six rank lines: Falloff Distance bonuses of +20/+40/+60/+80/+100/+120%, Spread Decrease as `?`, and Magazine Restore of 25/30/35/40/45/50% of current magazine. A Rifle kill buffs only the next Buckshot, and a Buckshot kill restores magazine. The [EFV-5 Jupiter page](https://wiki.warframe.com/w/EFV-5_Jupiter) lists Buckshot as an 11-pellet, 1s charged hit-scan attack with 24°–42° spread, 15-ammo cost, forced Corrosive, and 5–10m falloff. The Wiki's [Accuracy page](https://wiki.warframe.com/w/Accuracy) describes shotgun pellets as random trajectories within the spread cone, with at least one pellet close to the reticle center; it does not give an exact distribution or target-hit geometry.

The experimental target-overlap estimate adds the spread cone to EFV-5 Buckshot and exposes an editable effective target radius alongside the attack-distance input. It assumes one idealized reticle-center pellet and independent uniform solid-angle sampling for each remaining pellet. It calculates expected hits at 24° and 42° and uses their midpoint (33°) for manual single-target damage, status, Burst, finite TTK, and five-second window estimates when no unsupported spread modifier is equipped. Multishot is applied before the expected-hit estimate. Endpoint values are displayed as bounds; no sampled pellet simulation is implied. At test radius 0.5m and distance 10m with 11 pellets, the result is about 1.077 nominal expected hits, bounded by about 1.049–1.144 under the listed spread endpoints. These are outputs of this approximation, not observed gameplay results.

The estimate requires both radius and distance. Accuracy-affecting effects and unsupported spread changes disable it. Area coverage, pellet correlations, exact hitbox geometry, and game calibration remain unverified. Spread Decrease and Magazine Restore remain unscored. PR #346 applies the selected rank's Falloff Distance bonus to both Buckshot falloff endpoints for this manual one-shot Burst snapshot only. The UI saves and restores target radius with planner settings. The picker and stat explanation label the estimate as experimental and single-target.

The original estimate implementation passed 208/208 calculator/catalog tests plus the optimizer exclusion regression. It was released in PR #317 and hosted IAB verified the no-mod estimate; see the dated implementation checkpoint below. Full optimizer/repository suites and gameplay calibration were not run. The user reports localhost is available, but this session has no IAB interaction or screenshot capability; current-source visual review remains open.

### Manual user-entered spread snapshot (2026-11-23; released in PR #335, Pages run #415 succeeded)

Because the Wiki still gives no numeric Spread Decrease and the planner has no cross-mode event history, the selected scope is a manual user-entered effective post-Rifle-kill spread minimum and maximum for the EFV-5 Buckshot single-target estimate. This is an explicit assumption, not an inferred augment value. With the `Burst` goal selected, those angles replace the sourced 24°–42° cone for the scored attack event; the user supplies both endpoints and the existing estimator retains its one-idealized-center-pellet plus uniform solid-angle approximation. The prior Rifle kill, one-shot buff consumption, repeat-fire cone timeline, and attack ordering are not simulated.

The current UI path requires the EFV-5 Jupiter, Buckshot, Overpressured Rounds selected, the `Burst` goal, valid minimum/maximum spread bounds, target radius, and attack distance. The manual range is saved/restored with planner configuration. Selecting another goal strips the assumption. Finite Expected TTK / target encounter and five-second Avg DPS are marked unavailable; sustained and DoT DPS are unavailable; Auto Optimize still excludes the mod. JSON/share output reports separate sustained, DoT, and finite-score availability, while the Saved Builds comparison marks its scores unavailable for this pellet model because it does not replay the target-geometry inputs. Area coverage remains unscored. The sourced rank Falloff Distance affects only this one Burst event; Magazine Restore remains unscored. This does not imply gameplay calibration or a sourced spread value.

Focused regressions verify input normalization, the user-entered cone's effect on manual Burst expected hits, and stripping the snapshot from finite encounter scoring. A filtered optimizer regression verifies that Auto Optimize still skips Overpressured Rounds. Calculator/catalog tests pass 212/212; the optimizer exclusion regression passes 1/1. App/test TypeScript, focused ESLint, source validation, a 987-module temporary production Vite build, and CRLF-aware diff check pass; Vite reports the repository's existing large-chunk warning. PR [#335](https://github.com/Appl3Tree/Tenno-Hub/pull/335) squash-merged as `56433e1cef723d1523f4ae35808c35ab43d866e4`; Pages run [#415](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45198526629) succeeded. No current-source visual review was possible in this session because IAB interaction/screenshot tooling is unavailable; do not use Brave. No Underframe parity or gameplay validation applies.

`D3-MOD-EFV-OVERPRESSURED-ROUNDS-001` remains open for a sourced Spread Decrease value, Rifle-kill/Buckshot/ammo event history, Magazine Restore scoring, target/pellet calibration, area coverage, Auto Optimize support, and current-source in-app visual review. PR #346 resolves the user's Falloff Distance question: the selected rank bonus now applies to the entered target distance in the same one-shot Burst snapshot. Recheck primary sources when updated and use controlled game evidence only when available.

### Source-accuracy correction (2026-11-23; catalog copy only)

The earlier limitation note conflated the Wiki's average spread (33°) with its spread range, describing 33°–42°. Current source review confirms 24° minimum / 42° maximum; the Wiki's Accuracy page says shotgun pellets randomize inside the cone and at least one pellet lands near the reticle center. The catalog note now gives the correct range and links the EFV-5 attack source in the picker. The focused catalog test passes 37/37 using `npx vitest run --configLoader runner src/domain/__tests__/weaponCatalog.test.ts`; app/test TypeScript, focused ESLint, and CRLF-aware `git diff --check` pass. Ordinary Vitest config loading hit `EPERM` writing shared `node_modules/.vite-temp`, so the runner config loader was used. Exact per-pellet distribution, target geometry, Overpressured's spread amount, and mixed-mode/ammo history remain unmodeled. The manual Burst snapshot and rank falloff follow-up are recorded below; Auto Optimize remains excluded. No app build, Underframe comparison, or gameplay validation applies.

### Source accuracy and approved estimate scope (2026-11-23)

The earlier note confused the Wiki's 33° average with the spread range. The catalog now correctly records 24° minimum / 42° maximum. The source says that pellets are randomized inside the spread cone and that at least one lands near the reticle center; it does not establish that a pellet hits the exact aim point, specify angular sampling, or define target hit geometry. The user approved an explicitly bounded manual estimate under these limits.

The implementation adds a separate `WeaponAttackPelletSpreadCone` source field and threads it into the selected weapon profile. `estimatePelletHits()` converts the editable target radius and attack distance into an apparent angular target radius, computes the ratio of target to spread-cone solid angle, and applies that probability to pellets after one idealized guaranteed center hit. It reports low/nominal/high expected-hit counts at 42°/33°/24°. These formulas are an implementation assumption and have not been calibrated to the game. The assumed target is a centered circular cross-section; the field is an effective radius, not a sourced Warframe enemy hitbox measurement.

The estimate flows into expected multishot for manual single-target damage and status scoring and therefore changes the related manual Burst, finite TTK, and fixed-window outputs when Overpressured Rounds is not selected. The midpoint is the active score; endpoint values are display bounds rather than full score intervals. A selected accuracy-changing mod/effect or unsupported unparsed rank text mentioning accuracy/spread fails closed. Overpressured Rounds is eligible only for the later user-entered one-shot Burst snapshot documented below; Auto Optimize remains unavailable. Both radius and attack distance are saved/restored. The original attack model limitation remains in place.

Validation and release: npx vitest run --configLoader runner src/domain/logic/__tests__/damageCalc.test.ts src/domain/__tests__/weaponCatalog.test.ts passes 208/208; npx vitest run --configLoader runner src/domain/logic/__tests__/buildOptimizer.test.ts -t "keeps Overpressured Rounds unscored" passes 1/1 (198 skipped). App, test, and node TypeScript, npm run validate:sources, and focused ESLint pass. npx vite build --configLoader runner --outDir "$env:TEMP\TennoHub-EFV5-Pellet-Build" --emptyOutDir bundles 987 modules successfully in 10.78s, with existing large-chunk warnings. No full optimizer or repository suite was run. Local current-source preview port 5173 returned ERR_CONNECTION_TIMED_OUT; hosted IAB after deployment succeeds. PR [#317](https://github.com/Appl3Tree/Tenno-Hub/pull/317) squash-merged as 7faacf89ec7bf022e041af6593dce894c73535ee; Pages run [#397](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45151075987) succeeded. At version=7faacf8, the in-app browser verified the Buckshot note, distance/radius inputs, and 10m / 0.5m estimate of 1.08 expected pellet hits (1.05–1.14 at the spread endpoints); Auto Optimize is disabled. This confirms the rendered manual flow only; persistence was not tested and no saved build changed. No Underframe/live-game comparison applies.

### Open Overpressured Rounds requirements

The raw Overpressured Rounds rank lines remain unparsed and the mod remains excluded from Auto Optimize. The selected rank's Falloff Distance bonus now affects both Buckshot falloff endpoints in the user's one-shot manual Burst snapshot, per PR #346; kill-based Magazine Restore still does not contribute to scores. The [current Overpressured Rounds Wiki table](https://wiki.warframe.com/w/Overpressured_Rounds) still reports `?` for Spread Decrease at every rank; the [official Update 43.5 notes](https://www.warframe.com/tr/patch-notes/psn/43-5-0) describe the effect only as “decrease Spread.” The general [Accuracy page](https://wiki.warframe.com/w/Accuracy) explains spread as shot deviation but does not map this augment to a numeric EFV-5 cone change. No rank value or conversion is supportable. The manual, user-supplied cone enables the experimental Buckshot estimate for Burst scoring only; the prior kill and one-shot trigger/consumption are not simulated. Full attack-history scoring still requires a cross-mode event timeline for Rifle kills and the next Buckshot, Buckshot-kill magazine restoration, and representative game measurements for hit overlap.

## D3-OPT-RANK-LIMITED-FIVE-MOD-FOUR-SLOT-DUAL-OBJECTIVE-ORACLE-001 — seeded five-mod four-slot owned-rank oracle (2026-11-23; released)

Seed `20261151` draws five fully modeled, mutually compatible damage mods and a supported attack from each Braton Prime / Grineer, Lex Prime / shielded Corpus, Cedo / Grineer, and Broken War / Infested pool. Each sampled mod is capped at an owned rank from R1–R2. The exhaustive oracle evaluates legal ordered subsets/rank tuples through four slots with rank-30 uncatalyzed capacity, default weapon polarities, alternating zero/one Forma limits, no Arcane, and both finite Expected TTK and fixed `[0,5s)` Avg DPS. The fixed-window targets are raised to one million Health (and one million Shields for Corpus), and all stay above the target-defeat ceiling.

All four optimizer outputs match their exact sampled-pool Expected TTK and five-second Avg DPS winners while remaining capacity-, Forma-, and owned-rank legal. The focused test passes 1/1 in 235.74s. Test-project TypeScript, focused ESLint, and `git diff --check` pass. PR [#309](https://github.com/Appl3Tree/Tenno-Hub/pull/309) squash-merged as `e80992f58e29ca6b35b9ef5ae14d72ddb936d1fb`; GitHub reported no status checks or PR-triggered workflow runs. This test-only change adds no application code, app build, full optimizer/repository suite, or deployment. It is a broader rank-limited candidate pool at four slots, not full-catalog/global optimizer quality, Underframe parity, or gameplay validation. No improving neighbor or global quality claim is made.

## D3-MECH-HELD-FIRE-QUANTA-BOUNDARY-001 — held-beam ramp and event-row audit (released in PR #313, 2026-11-23)

### Held-fire ramp coverage

The current [Fire Rate Wiki page](https://wiki.warframe.com/w/Fire_Rate) describes Held fire as continuous contact damage rather than discrete trigger pulls. The catalog now applies the general direct-beam rule of 20% starting damage, a 0.6s ramp to full damage, a 0.8s wait after losing contact, then a 2s decay. Source-backed weapon overrides cover Amprex (30%), Atomos (35%), Convectrix (60% primary / 80% alternate), Cycron and Tenet Cycron (30%), Nukor and Kuva Nukor (30%), Embolist (45%), Flux Rifle and Gammacor (25%), Synoid Gammacor (30%), the Quanta family beam (30%), Phage (70%), Cortege (33%), Phantasma (15%), and Larkspur (20%). Basmu uses its separately sourced 20% start and 0.5s ramp. The damage ramp changes damage over time; it does not infer Status Chance, range, aim changes, chain geometry, or extra targets. Generic Held rows use the standard default only when they represent direct continuous damage. Component events do not inherit a weapon's top-level beam ramp.

Current-catalog audit result: 51 Held attack rows, 48 with a modeled sourced ramp, three with an explicit timing/model limitation, and zero unhandled rows. This is a finite snapshot of the present catalog, not a claim that every Wiki weapon has been reviewed. Onos's Incarnon beam-to-release sequence remains reference-only because Radiation tick progression and the 50-round Heat release are not represented. Cortege's grenade impact/radial rows remain reference-only because their projectile spread, target overlap, and flame overlap are not modeled. Basmu's beam now carries the correct Held trigger and one ammo per damage tick; no beam-chain, range, or multi-target behavior is inferred.

The related trigger sweep corrected sourced Held labels for Basmu, Boar / Boar Prime Incarnon, Furis / MK1-Furis Incarnon, Panthera / Panthera Prime Alt-Fire, and the listed Quanta components. It also corrected the event rows for Enkaus, Onos, Atomos / Gammacor Incarnon grenade attacks, and Phantasma charged alternate-fire components, so the held-beam rate cannot leak into non-beam events. Source review used the weapon pages linked by the affected catalog overrides and the Fire Rate page's trigger definitions.

### Auto-Spool inventory

The same current-snapshot audit found 23 Auto-Spool attack rows (the Wiki's 22 weapons expand to separate attack rows where damage components are split). Nineteen have sourced cadence or per-shot sequence support; the remaining four have explicit finite-timing boundaries: standard Kohm, Aksomati Prime, Deth Machine Rifle, and Deth Machine Rifle Prime. No Auto-Spool row is silently unhandled. Standard Kohm remains outside finite timing because its page does not give a complete starting-rate/per-shot cadence. The earlier Kohmak-family interpolation remains an approximation between sourced ammo-cost endpoints; intermediate costs are not newly claimed as exact. Coda Bubonico uses its own Auto-profile cadence and is not included in this Auto-Spool inventory. These counts are a catalog coverage audit, not proof of exact in-game timing for every covered sequence.

### Quanta single-target sequence

[Quanta](https://wiki.warframe.com/w/Quanta), [Quanta Vandal](https://wiki.warframe.com/w/Quanta_Vandal), and [Tenet Quanta](https://wiki.warframe.com/w/Tenet_Quanta) now expose the contact-cube component as Semi and score one cube's direct contact plus its linked 0.5m contact explosion immediately against the same selected target. This is the user's approved bounded immediate-hit sequence. It excludes projectile flight, cubes that park and detonate after nine seconds, additional cube trajectories, other blast targets, and the separate 6m blast caused by shooting an already-deployed cube. Standalone Cube Explosion rows and the deployed-cube player-shot row are reference-only; the latter has no linked-weapon/deployed-cube state in the planner. Linking the 0.5m contact component to direct contact is an explicit single-target event assumption; area coverage is not scored.

### Catabolyst reload-grenade boundary

[Catabolyst](https://wiki.warframe.com/w/Catabolyst) and [Coda Catabolyst](https://wiki.warframe.com/w/Coda_Catabolyst) reload impact/explosion events are now explicitly Special-trigger, reference-only components. They depend on a manual reload, remaining magazine, empty-magazine damage state, and reload timing, none of which is simulated. Coda's three spread grenades also lack a validated single-target overlap model. These rows are excluded from damage scoring and Auto Optimize. Their regular direct Held beam remains eligible for the general beam ramp.

### Validation and remaining limits

The full affected `weaponCatalog.test.ts` and `damageCalc.test.ts` files pass 204/204; focused optimizer regressions for the sourced Held ramp and Quanta direct-hit sequence pass 2/2. App and test TypeScript, `npm run validate:sources`, focused ESLint over the five changed source/test files, a 987-module temporary-output production Vite build, and CRLF-aware `git diff --check` pass. The full repository and optimizer suites were not run. PR [#313](https://github.com/Appl3Tree/Tenno-Hub/pull/313) squash-merged as `cba425da79656142d41b5246b0e273c781dd5481`; GitHub reported no status checks or PR-triggered workflow runs. Pages deployment is unverified. The in-app browser still shows `version=2bf6faea`, so current-source visual review remains open. This is sourced catalog modeling, not native Underframe parity or live-game validation.

## D3-MECH-CYNGAS-DUAL-PROFILE-BURST-CADENCE-001 — separate Archwing and Atmosphere profiles (PR #311, 2026-11-23)

The current [Cyngas Wiki page](https://wiki.warframe.com/w/Cyngas) lists Archwing Auto-Burst and Atmosphere Burst as distinct profiles. Both have three projectiles per burst, a 0.06s intra-burst delay, a 6.67/s burst-cycle Fire Rate, 20% Critical Chance, 2.2× Critical Multiplier, and 30% Status Chance. Archwing deals 120 physical damage per projectile, uses a projectile, has 30 rounds and 1.25s reload plus a separately listed 0.25s Reload Delay, and falls from full damage at 1,500m to 20% at 3,000m. Atmosphere deals 240 physical damage per projectile, uses hitscan, has 30 rounds and 1.20s reload, and lists a 300m maximum Range plus 1.5m Punch Through. [Fire Rate](https://wiki.warframe.com/w/Fire_Rate) defines effective burst rate as `burst count / (1 / burst-cycle rate + (burst count − 1) × burst delay)`, which gives 11.1142 projectile hits/s before reload for the sourced profile.

The catalog now exposes `Cyngas (Archwing)` and `Cyngas (Atmosphere)` using the same Archgun mod family. Archwing retains the Auto-Burst label and applies Wiki falloff; no 300m hit cap is inferred for this projectile profile. Atmosphere restores regular Burst and enforces the listed 300m hitscan cap. The burst helper and finite encounter timing recognize both trigger labels. A finite Expected TTK regression makes two projectiles decisive and confirms the second hit arrives at 0.06s for each profile.

The bounded score assumes every projectile hits one selected target. Archwing projectile travel time, target leading, accuracy/misses, recoil, and the separately listed 0.25s reload delay are not simulated. Atmosphere punch-through hits on additional enemies, reserve-ammo depletion, Archgun Deployer cooldown, and multi-target coverage are excluded. This is a sourced calculator model, not live-game validation or Underframe parity.

Focused Vitest passes 3/3 across catalog, calculator, and optimizer regressions; the affected catalog/calculator files pass 200/200 and filtered optimizer regressions pass 12/12. App/test TypeScript, `npm run validate:sources`, focused ESLint, a 987-module production Vite build to temporary output, and CRLF-aware diff check pass. The full repository suite and full optimizer suite were not run. PR [#311](https://github.com/Appl3Tree/Tenno-Hub/pull/311) squash-merged as `20fa64181388ccdfad57c83d03b6b49847d080d1`; GitHub reported no checks or workflow runs on the PR head or merge commit, so Pages deployment remains unverified. The supplied localhost serves stale `version=2bf6faea`; a current-source Vite dev server on port 5182 timed out from IAB over both `127.0.0.1` and `localhost`, so current-source rendering remains unverified. Sources: [Cyngas](https://wiki.warframe.com/w/Cyngas), [Fire Rate](https://wiki.warframe.com/w/Fire_Rate), [Range](https://wiki.warframe.com/w/Range), [Damage Falloff](https://wiki.warframe.com/w/Damage_Falloff), and [Projectile Speed](https://wiki.warframe.com/w/Projectile_Speed).

## D3-MECH-EFV5-MINIMUM-AMMO-GATE-001 — Buckshot loaded-ammo floor (merged; deployed in Pages run #400)

The [Alternate Fire Wiki](https://wiki.warframe.com/w/Alternate_Fire) states that EFV-5 Jupiter Buckshot consumes 15 rounds and does not function with fewer than 15 rounds in the magazine. The [EFV-5 page](https://wiki.warframe.com/w/EFV-5_Jupiter) lists a 65-round magazine and notes that Primary Crux can reduce per-release ammo consumption from 15 to 6. The source does not clarify whether that efficiency change also lowers the trigger floor.

`WeaponAttack.ammoGate` now carries the source-linked 15-round minimum separately from `ammoCostPerShot`. For a gate-bearing profile, magazine attacks are counted by the amount consumed per release and the loaded-ammo floor: `floor((magazine - max(minimum loaded ammo, effective ammo cost)) / effective ammo cost) + 1`, when the magazine can satisfy both requirements; otherwise the count is zero. Effective ammo cost applies the planner's ammo-efficiency assumption. The planner currently keeps the sourced 15-round floor fixed as efficiency changes consumption; the Primary Crux/gate interaction therefore remains an explicit unverified assumption.

For Buckshot, the base 65-round magazine provides four releases, leaving five rounds below the trigger floor. A 14-round capacity cannot fire, even with 75% modeled efficiency. The UI and Math Trace show the requirement, current magazine, and resulting count; below the floor, Burst/sustained DPS and finite target scoring produce no damage. The Buckshot pellet estimate remains experimental and Auto Optimize remains unavailable. This change does not score Overpressured Rounds or resolve pellet distribution/gameplay accuracy.

Focused `weaponCatalog.test.ts` and `damageCalc.test.ts` pass 209/209, covering selected-row gate propagation, four base releases, a magazine-capacity increase to 85 for five releases, 60% efficiency for nine releases, 75% efficiency for fourteen releases, and zero shots/DPS/window damage below the gate. The existing Overpressured optimizer exclusion test passes 1/1 (198 skipped). App and test TypeScript, `npm run validate:sources`, focused ESLint across changed code/tests, CRLF-aware `git diff --check`, and a 987-module production Vite build to temporary output pass. Default Vitest config bundling hit `EPERM` writing shared `node_modules/.vite-temp`; `--configLoader runner` passed. The build reports the repository's existing large-chunk warning.

Validation and release: focused `weaponCatalog.test.ts` and `damageCalc.test.ts` pass 209/209; the existing Overpressured optimizer exclusion passes 1/1 (198 skipped). App and test TypeScript, `npm run validate:sources`, focused ESLint, CRLF-aware `git diff --check`, and a 987-module production Vite build to temporary output pass. Default Vitest config bundling hit `EPERM` writing shared `node_modules/.vite-temp`; `--configLoader runner` passed. The build reports the repository's existing large-chunk warning. PR [#319](https://github.com/Appl3Tree/Tenno-Hub/pull/319) squash-merged as `d70cfeab9bf0bdc747b30b5183063fd30b49ee72`. Pages run [#399](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45157011519) built and uploaded its artifact on both attempts, but `deploy-pages@v4` reported zero artifacts on both; GitHub later listed two `github-pages` artifacts for that workflow run. Deployment and current-source visual verification remain open; localhost still serves version `2bf6faea`. Primary Crux gate behavior, full optimizer/repository suites, and gameplay accuracy remain unverified. No Underframe comparison, saved-build edit, or live-game claim applies.
## D3-MECH-EFV5-REFERENCE-SCORE-DISPLAY-001 — suppress scores for a reference-only attack (released in PR #321; 2026-11-23)

Hosted IAB review of the successful EFV-5 minimum-ammo deployment (`version=bf44b17`) confirmed the 15-round loaded-ammo floor and four releases from a 65-round magazine. It also found that, when the user had not entered target distance and radius, the attack note correctly said scoring was unavailable while Burst DPS (1,526) and Sustained DPS (982) still appeared as if they were valid scores.

`ModBuilder.tsx` labels the no-radius/model-limited state consistently: Burst, sustained, and DoT DPS are unavailable; direct attack values, damage types, status effects, DoT components, Math Trace arithmetic, and share-image values are explicitly marked reference-only; and score availability plus the model-limitation source is carried in copied JSON. Saved-build comparisons use the selected attack row and suppress its unavailable DPS. The bounded single-target pellet estimate can display a scored value once its required inputs are present; Auto Optimize remains unavailable.

App TypeScript and focused ESLint pass, as does `git diff --check`. A temporary production Vite build passes with 987 transformed modules and the repository's existing large-chunk warning. PR [#321](https://github.com/Appl3Tree/Tenno-Hub/pull/321) squash-merged as `44b6de3db4532b739759a92276828ae400d068c1`; Pages run [#401](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45163746468) succeeded. Hosted IAB at `version=44b6de3` verified that blank Buckshot target inputs produce unavailable Burst/Sustained/DoT DPS with reference-only component labels. Entering 10m distance and 0.5m radius shows the experimental 1.08 expected hits with 1.05–1.14 spread-endpoint bounds and keeps Auto Optimize disabled. Clearing both inputs restores reference-only display. The UI test did not reach the below-15 zero-fire state; its calculator regression remains the evidence for that branch. No saved build was changed. This UI correction does not calibrate pellet distribution or establish Underframe/gameplay parity.
## Post-merge deployment reconciliation — 2026-11-23

Pages run [#397](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45151075987) succeeded for `version=7faacf8` and includes the already-merged source changes from PRs #280, #281, #298, #300–305, #311, and #313. Their deployment is verified; weapon/mod-specific hosted UI review remains open unless a section below records it. Pages runs #400 and #401 later deployed the EFV-5 ammo-gate and score-display changes. Older entries may retain deployment status as it was recorded at merge time.

## D3-OPT-RANK-LIMITED-SIX-MOD-FOUR-SLOT-R1-DUAL-OBJECTIVE-ORACLE-001 — seeded owned-rank oracle (2026-11-23; released in PR #326)

Seed `20261153` draws six fully modeled, pairwise-compatible damage mods and one supported attack in each Braton Prime / Grineer, Lex Prime / Corpus, Cedo / Grineer, and Broken War / Infested fixture. Each sampled mod has an owned cap of R1, and the oracle evaluates every legal ordered subset and rank tuple through four slots. The fixtures use rank-30 uncatalyzed capacity, weapon-default polarities, no Arcane or Exilus search, and alternating zero-/one-Forma budgets. It independently scores finite Expected TTK and an uncapped `[0,5s)` Avg DPS window; the window target is raised to 1,000,000 Health (plus 1,000,000 Shields for Corpus) and is asserted to survive. All four optimizer outputs match both sampled-pool winners and their expected TTK/time/DPS or window DPS/total damage, while respecting capacity, Forma, and owned-rank limits.

The focused test passes 1/1 in 391.40s (`npx vitest run --configLoader runner src/domain/logic/__tests__/buildOptimizer.test.ts -t "seeded six-mod, four-slot R1-owned" --maxWorkers=1 --reporter=dot`); 199 unrelated tests are skipped by the filter. `npx tsc -p tsconfig.test.json --noEmit --incremental false --pretty false`, focused ESLint on `buildOptimizer.test.ts`, and `git diff --check` pass. The full optimizer/repository suites were not rerun; no production code, build, or deployment changed. PR [#326](https://github.com/Appl3Tree/Tenno-Hub/pull/326) squash-merged as `c4c230c4b326ed184a2f2a43abc0a47f1a5c3a62`. This bridges the existing six-mod / three-slot R1–R3 and five-mod / four-slot R1–R2 samples, but it remains bounded sampled-pool evidence rather than global optimizer quality, Underframe parity, or gameplay accuracy.

## D3-OPT-RANK-LIMITED-SIX-MOD-FIVE-SLOT-R1-DUAL-OBJECTIVE-ORACLE-001 — seeded five-slot follow-up (2026-11-23; bounded)

The six-mod R1-owned oracle now retains the existing four-slot controls and adds five-slot search over the same four weapon/faction contexts. Seed `20261153` uses deterministic LCG sampling to select one supported attack and six fully modeled, mutually compatible mods for each case. It samples a fresh attack/mod pool for each slot depth. The target and state profiles are Braton Prime / Grineer / Realistic / 82,000 Health / 2,700 Armor; Lex Prime / Corpus / Initial / 42,000 Health + 58,000 Shields; Cedo / Grineer / Realistic / 155,000 Health / 2,100 Armor; and Broken War / Infested / Fully Stacked / 108,000 Health / 300 Armor. Every selected mod is capped at owned rank 1; capacity is uncatalyzed at weapon rank 30, default polarities are used, and the Forma budget alternates between zero and one. Arcane and Exilus optimization are disabled.

The exhaustive oracle enumerates all legal subsets and rank-0/R1 choices up to the slot limit, then independently scores finite Expected TTK and the fixed `[0,5s)` window. The window target is raised to 1,000,000 Health and, for Corpus, 1,000,000 Shields. It asserts the target survives that window. To remove redundant orderings, order-independent mods are canonicalized by unique name while every relative order of mods with direct or conditional primary-element contributions is retained; this matches the slot assigner's damage-order semantics. The eight cases exact-score 9,640 legal ranked assignments: 4,380 at four slots and 5,260 at five slots.

| Five-slot case | Six sampled R1 mods | Legal ranked assignments | Forma budget | Expected TTK | 5s Avg DPS / damage |
| --- | --- | ---: | ---: | ---: | ---: |
| Braton Prime / Incarnon Form | Amalgam Serration, Primed Bane of Grineer, Fanged Fusillade, Vile Precision, Vital Sense, Primed Fast Hands | 665 | 0 | 146.3941s | 339.4917 / 1,697.46 |
| Lex Prime / Normal Attack | Magnum Force, Anemic Agility, Pistol Gambit, Bore, Pressurized Magazine, Scorch | 1,965 | 1 | 64.4426s | 914.1788 / 4,570.89 |
| Cedo / Alt-Fire Glaive | Accelerated Blast, Primed Blunderbuss, Vigilante Fervor, Tactical Pump, Galvanized Hell, Shotgun Savvy | 665 | 0 | Not reached within the finite encounter model | 30.4839 / 152.42 |
| Broken War / Heavy Slam Attack | Sundering Strike, Shocking Touch, Condition Overload, Primed Pressure Point, Lasting Sting, Melee Prowess | 1,965 | 1 | 99.0000s | 1,013.4062 / 5,067.03 |

The optimizer's finite TTK result and five-second Avg DPS/damage match the exhaustive sampled-pool winner in every case, and both objective results obey rank, capacity, and Forma limits. The focused test passes 1/1 in 81.06s (206 unrelated optimizer tests skipped). Reproduce the reported case table with:

```powershell
$env:TENNO_HUB_ORACLE_REPORT = '1'
npx vitest run --configLoader runner --reporter=verbose --silent=false src/domain/logic/__tests__/buildOptimizer.test.ts -t "seeded six-mod, four- and five-slot"
```

The test-project TypeScript check and focused ESLint pass; CRLF-aware `git diff --check` passes. The full optimizer/repository suites were not run. Test source and documentation only changed; there is no application build or deployment. This is finite sampled-pool evidence and does not prove full-catalog, global, Underframe, or gameplay accuracy.

## D3-MECH-TONKOR-IMPACT-SEQUENCE-001 / D3-MOD-PRECISION-STRIKE-DIRECT-HIT-001 / Overpressured Rounds Falloff follow-up (2026-11-23; released in PR #346)

This follow-up reconciles the user-approved event assumptions against the source-backed calculator model. The [Tonkor Wiki page](https://wiki.warframe.com/w/Tonkor) lists a 7m, 100%→30% explosion falloff and conflicting standard arming-distance text (6m in one update note, 7.5m in its overview/passive description). Per the user's decision, the direct-impact sequence uses a conservative 7.5m entered-distance gate. The [Kuva Tonkor page](https://wiki.warframe.com/w/Kuva_Tonkor) lists the same 7m / 30%-minimum blast and says Kuva Tonkor grenades explode on impact without the minimum arming distance. Selecting Grenade Impact scores one direct hit and one centered explosion against that target; the radial component is at 0m offset from its impact center. Standalone Grenade Explosion rows are reference-only. Projectile flight, missed shots, blast overlap on other targets, and area coverage are excluded. For standard Tonkor, missing distance or distance below 7.5m leaves only the direct-hit damage in the score.

The [Precision Strike Wiki page](https://wiki.warframe.com/w/Precision_Strike) lists 37/75/110/150% Reload Speed for five seconds after a direct grenade hit, says the buff can refresh, and gives reload time as base reload divided by (1 + Reload Speed). The calculator leaves the first shot on base reload; a modeled direct-hit event activates or refreshes the buff and subsequent reloads use the faster reload while it is active. The selected Tonkor attack implies the weapon is held. Its timeline assumes the modeled attacks hit and does not represent switching away, incapacitated-target exclusions, or general external projectile/ability triggers. Burst remains unchanged because a one-hit burst starts before the first qualifying reload. Explosion-only rows do not activate the buff.

The user approved applying Overpressured Rounds' sourced rank Falloff Distance to the editable post-kill cone snapshot. The [Overpressured Rounds Wiki page](https://wiki.warframe.com/w/Overpressured_Rounds) lists +20/+40/+60/+80/+100/+120% Falloff Distance, while Spread Decrease remains `?` at every rank. When the EFV-5 Jupiter Buckshot manual Burst snapshot has valid target radius, distance, and user-entered effective spread bounds, the selected rank multiplies both sourced Buckshot falloff endpoints by 1 + the rank bonus (at R5, 5–10m becomes 11–22m). The numeric spread remains user supplied; this represents one assumed post-kill shot and does not simulate the Rifle kill, trigger consumption, repeat fire, or Buckshot-kill magazine restoration. Finite TTK, five-second Avg DPS, sustained/DoT DPS, area coverage, and Auto Optimize remain unavailable for this augment. Spread Decrease and pellet geometry remain unverified.

Validation and release: all 330 tests in `damageCalc.test.ts`, `targetDamage.test.ts`, and `weaponCatalog.test.ts` pass; filtered Precision Strike / Overpressured / Tonkor optimizer regressions pass 2/2 (206 unrelated optimizer tests skipped). App and test TypeScript, focused ESLint, `npm run validate:sources`, CRLF-aware diff check, and a temporary production Vite build (987 modules) pass. The mod-effect coverage audit reports 498/600 builder-eligible records with parsed damage/performance effects and 68 conservative unmatched-line candidates; this keyword audit is not full mechanics coverage. No full repository or optimizer suite was run. PR [#346](https://github.com/Appl3Tree/Tenno-Hub/pull/346) squash-merged as `eca3fdff84a39cbac758a63ad32974aff1865d14`; Pages run [#426](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45233252586) succeeded. The localhost HTTP request timed out and in-app browser interaction/screenshot controls are unavailable, so current-source rendered verification is not claimed. No Underframe parity or gameplay accuracy follows from these model tests.

## D3-MOD-AUDIT-TRIAGE-001 — conservative mod-effect coverage review (in progress, 2026-11-24)

Reproduced with `npm run audit:mod-effect-coverage`: 698 weapon profiles yield 600 unique builder-eligible mod records, 511 records with parsed damage/performance effects, 89 records with no parsed effect at max rank, and 73 with unmatched stat lines (40 partial, 33 full). No weapon pool lacks a parsed damage effect. These 73 are candidates from a keyword screen, not 73 confirmed missing implementations; some are context-dependent warnings, linked-equipment behavior, utility, or multi-event mechanics. The added Sentient Incision candidate is a context-free warning: target-aware planner paths score supported faction/Overguard contexts, while generic callers without target context fail closed.

First-pass code/source triage identifies Primary Acuity, Pistol Acuity, and Pain Points as target-context-sensitive weak-point effects; their weak-point bonuses still depend on a selected profile that marks the head as a weak point. PR #385 adds the Acuity rank-text Multishot lock to scoring, so static, conditional, negative, next-magazine, and extra-projectile Multishot changes are ignored while either mod is selected. Amalgam Argonak Metal Auger’s external Dagger armor strip remains excluded per the user's linked-weapon decision. Other candidates include cross-weapon stat transfer, companion healing, holstered reload, on-death area effects, and burst or ammo event sequences. Tennokai's opportunity history is now represented by the separately recorded bounded event model; its remaining status, timing, target-history, and player-side limits are explicit there. The other candidates still require their corresponding equipment, utility, area, or event-history model before they can enter optimization.

Combat Reload was the first candidate implemented from this triage and released in PR [#348](https://github.com/Appl3Tree/Tenno-Hub/pull/348), squash merge `7e1477497c3e8dd1b469375adbb09c1fe1b5b87b`; Pages run [#428](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45240976347) succeeded. Sentient Incision followed in PR [#349](https://github.com/Appl3Tree/Tenno-Hub/pull/349), squash merge `622d95ff213d4ef9d4335495beefee1273d60d19`; Pages run [#429](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45251259969) succeeded. See their focused records below.

Reopening criteria: revise candidate classifications when the current Wiki or official update notes change, when linked-weapon or utility objectives are added, or when controlled in-game evidence supplies the missing event probability/timing. Continue candidate-by-candidate triage; do not equate this keyword report with complete mod coverage.

### Finishing Touch — unsupported finisher events (2026-11-27)

The [Finishing Touch Wiki page](https://wiki.warframe.com/w/Finishing_Touch) describes a rank-scaled Finisher Damage bonus for Stealth, Counterattack, and Ground Finisher attacks. The planner's selectable weapon attack rows do not represent those event types. `getUnmodeledDamageEffectLines` now adds a mod-specific explanation and current Wiki link while preserving the catalog's raw rank text; the generic optimizer gate continues to exclude the unparsed damage effect for every rank. A focused regression checks the source URL, explanation across all ranks, and Auto Optimize exclusion on Broken War. It passes 1/1 (253 unrelated optimizer tests skipped), with test-project TypeScript, focused ESLint, and `git diff --check` passing. No scoring behavior or audit totals changed, and the full suite/current-source rendered review were not completed. This is a classified audit candidate, not a finisher-damage implementation; revisit when finisher events are represented and their attack/target multipliers can be resolved.

### Holstered magazine reload — weapon-switch boundary (2026-11-27)

The [reload reference](https://wiki.warframe.com/w/Reload) lists Tactical Reload, Lock And Load, and Eject Magazine as restoring up to 20% of their compatible weapon's magazine per second while holstered. The generated rank text exposes +5/+10/+15/+20% per second at R0–R3. The builder now preserves that raw text and adds a per-mod Wiki link plus an explanation that the planner does not simulate switching, holstered time, or magazine-refill history. Auto Optimize remains blocked for these effects. A focused regression covers all four ranks of all three mods on Lato, Arca Plasmor, and Braton; it passes 1/1 (254 unrelated optimizer tests skipped). Along with the Finishing Touch exclusion test, focused optimizer regressions pass 2/2. Test-project TypeScript, focused ESLint, `npm run validate:sources`, the mod-effect audit, `git diff --check`, and the 994-module production build pass. The audit remains at 525/600 parsed records, 75 without parsed effects, and 73 conservative candidates (54 partial / 19 fully unparsed). No scoring change or audit-count change occurred. Revisit when a weapon-switch/refill timeline can represent the mod's contribution to sustained damage without assuming unavailable holstered time.

Sentient Incision was the second source-backed candidate. The [Wiki page](https://wiki.warframe.com/w/Sentient_Incision) gives a rank-scaled adaptive element table by target faction and active Overguard, says the bonus does not combine with other damage types, excludes Slam attacks, and documents that the added element does not scale its corresponding status DoT. Its implementation, bounded scoring rules, release, and limits are recorded in `D3-MOD-SENTIENT-INCISION-ADAPTIVE-ELEMENT-001` below.

## D3-MOD-COMBAT-RELOAD-SNAPSHOT-001 — active-buff snapshot (2026-11-23)

For Tigris, Tigris Prime, and Sancti Tigris, the mod parser now records Combat Reload's six rank values, `+20/+40/+60/+80/+100/+120%` Reload Speed for 3 seconds, behind the Wiki's condition that five pellets are headshots. Reload speed continues through the shared damage-stat calculation and base-reload formula.

The planner's configured headshot share describes direct hits, not individual pellets or how many land on the head. Realistic therefore keeps this five-pellet trigger inactive even at 100% direct-hit headshot share. As approved by the user, Custom/Fully Stacked can stand for one manually active-buff snapshot and applies the selected rank's Reload Speed to displayed reload time. The planner does not simulate expiry/refresh timing for that snapshot. A source-linked unmodeled-mechanics note keeps the mod out of Auto Optimize, including when the manual snapshot is active.

The calculator regression covers all three weapon profiles and all six parsed values, source/warning metadata, Realistic inactivity, and Custom snapshot reload-time arithmetic. The optimizer regression confirms Auto Optimize skips Combat Reload. Both focused tests pass 1/1; app and test TypeScript, focused ESLint, `npm run validate:sources`, and a temporary production Vite build pass (987 modules; existing large-chunk warning). The refreshed audit reports 499/600 eligible records with parsed effects and 68 conservative candidates (23 partial, 45 full). PR #348 squash-merged as `7e1477497c3e8dd1b469375adbb09c1fe1b5b87b`; Pages run #428 succeeded. No full test suite or current-source rendered review was run; pellet-trigger probability and live-game behavior remain unverified.

## D3-MOD-SENTIENT-INCISION-ADAPTIVE-ELEMENT-001 — bounded target-adaptive damage (released, 2026-11-23)

The current [Sentient Incision Wiki page](https://wiki.warframe.com/w/Sentient_Incision) lists six Venato/Venato Prime ranks (+20% through +120% additional damage matching the target's weakness), with an explicit rule that the bonus does not combine with other damage types. Its table maps Infested to Heat, Anarchs to Electricity, Narmer to Toxin, Grineer/Kuva Grineer/Zariman/Scaldra to Corrosive, Corpus/Corpus Amalgam/Techrot to Magnetic, Orokin to Viral, Sentients/The Murmur to Radiation, and Infested Deimos to Gas. An active Overguard pool overrides the faction mapping and selects Corrosive; the string `Overguard` alone is not treated as a faction. Slam attacks are unaffected, and the augment's elemental damage does not scale that type's status DoT.

Implementation: `modCatalog.ts` parses every rank. `sentientIncision.ts` resolves the selected faction/active-Overguard element. `damageCalc.ts` adds `base damage after ordinary damage bonuses × augment rank` to that element **after** primary-element combination and leaves it outside the Damage 3.0 base/DoT seed scale. The added channel participates in direct damage and status weighting but does not scale the corresponding DoT seed. Slam rows receive no bonus. Mod Builder and optimizer explanations name the selected channel and disclose the seed exception. Context-free callers and unsupported targets fail closed; Auto Optimize admits the augment only when a supported faction/Overguard context resolves its type, and excludes Slam rows.

Scoring boundary: Burst uses a snapshot of the selected target's starting state. If the target starts with Overguard, the Burst snapshot uses Corrosive. Because the element changes after Overguard breaks and no event history updates the channel yet, sustained DPS, finite Expected TTK, five-second Avg DPS, and non-Burst Auto Optimize are blocked while Overguard is active. Burst scoring is also unavailable when no supported faction/active-Overguard context resolves the element. The model does not score area coverage or claim gameplay calibration.

Regressions cover all listed faction mappings, active Overguard override, all six parser ranks on both compatible weapons, the non-combining channel alongside normal elemental combination, unchanged base/DoT seed scale, Slam exclusion, optimizer inclusion for resolved faction Burst, context-free/unsupported-target exclusion, and Overguard Burst versus finite-goal blocking. Saved-build comparisons and attack summaries keep the supported Burst snapshot visible while marking sustained/DoT and status-timeline estimates unavailable when the augment's element changes at Overguard break. `damageCalc.test.ts` plus `sentientIncision.test.ts` pass 194/194; focused Sentient/optimizer coverage passes 19/19 (384 unrelated cases skipped). App/test TypeScript, focused ESLint, source validation, the mod-effect audit, CRLF-aware diff check, and a temporary Vite production build (988 modules; existing large-chunk advisory) pass. The audit reports 500/600 parsed records and 68 candidates (24 partial / 44 fully unparsed), including the context-free warning. PR #349 squash-merged as `622d95ff213d4ef9d4335495beefee1273d60d19`; Pages run #429 succeeded. The public homepage returned HTTP 200, but no rendered visual review was completed because the provided localhost endpoint timed out and the integrated browser had no interaction/screenshot control. No full repository or optimizer suite, live-game accuracy, or Underframe parity was established. Reopen if current Wiki/official notes or reproducible game tests contradict the mapping or isolated damage/DoT interaction, or if the target simulator gains adaptive Overguard event transitions.
## Documentation release checkpoint — PR #369 / Pages run #448 (2026-11-24)

Docs-only PR [#369](https://github.com/Appl3Tree/Tenno-Hub/pull/369) merged as `e5d71d20072fd3b45fdac26f759168cd356e0aca`; Pages run [#448](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45330096982) completed successfully. This checkpoint records the preceding docs PR #368 / run #447 and the in-app browser's queued/no-render result. No application source or scoring behavior changed. The ordered Relentless Combination Slash/Bleed tick and combo-gain model remains deployed by PR #363 / run #442.

## D3-MOD-AUDIT-TRIAGE-001 — Relentless Combination warning context (2026-11-24)

Docs-only PR [#370](https://github.com/Appl3Tree/Tenno-Hub/pull/370) merged as `04db9cb6ea767076c619420ff9a01e62e3b6e971`, and Pages run [#449](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45331225122) succeeded. Warning clarification PR [#371](https://github.com/Appl3Tree/Tenno-Hub/pull/371) merged as `05f2b3da359970e8f141ea17deec74333218fb63`, and Pages run [#450](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45332884418) succeeded. Docs checkpoint PR [#372](https://github.com/Appl3Tree/Tenno-Hub/pull/372) merged as `f3d6ea6891e2279f6ffae75e9d85a05f6d553fd1`; Pages run [#451](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45333548443) succeeded. The in-app browser queued the localhost request without rendering content, so current-source visual review is still open. The coverage audit called Relentless Combination's shared `Combo Count Chance` stat a generic random per-hit combo gain in context-free output. The dedicated `Tennokai Cycle DPS` timeline instead consumes this stat as rank-scaled chance per Slash application and Bleed tick, while standard weapon-scoring goals show a specific warning that this event history is excluded. `getUnmodeledDamageEffectLines` now suppresses the redundant generic warning for this mod and retains the explicit objective boundary. No scoring math changed.

The focused `buildOptimizer.test.ts` warning regression passes 1/1 (3.51s test body; 221 skipped). Test-project TypeScript, focused ESLint, `npm run audit:mod-effect-coverage`, and `git diff --check` pass. The audit remains at 698 weapon profiles / 600 eligible mod records / 508 parsed / 92 with no parsed effect / 73 candidate records (37 partial / 36 fully unparsed) / zero empty weapon pools. The audit is a conservative keyword screen, and candidate records can be partially supported under selected objective context. No full repository/optimizer suite or production build was run because this warning-only change does not alter scoring.

## D3-OPT-TENNOKAI-RELENTLESS-FOUR-SLOT-R0-R2-ORACLE-001 — seeded exact-pool extension (2026-11-24)

Seed `20261164` extends the Relentless Combination Tennokai sample to four slots with owned-rank caps through R1–R2. It reuses four weapon/faction strata: Broken War / Grineer, Gram Prime / Corpus, Lesion / Infested, and Nikana Prime / Grineer. Each five-mod pool includes Master's Edge and Relentless Combination plus three shuffled candidates from Condition's Perfection, Opportunity's Reach, Organ Shatter, and Fury; cadence varies from 4–20 regular hits between Heavy Attacks. The exact oracle scores compatible legal subsets and rank tuples through four slots at rank-30 Catalyst capacity, default weapon polarities, and no Forma. All four optimizer outputs match the sampled-pool maxima, satisfy capacity and owned-rank checks, and each exact pool contains more than 40 legal candidates.

The focused `buildOptimizer.test.ts` case passes 1/1 (138.49s test body; 142.04s total; 222 unrelated tests skipped) using `npx vitest --configLoader runner run src/domain/logic/__tests__/buildOptimizer.test.ts -t "matches seeded four-slot R0–R2 exact Tennokai winners with Relentless Combination"`. Test-project TypeScript, focused ESLint, the mod-effect coverage audit, and `git diff --check` pass. The audit reports 698 profiles / 600 eligible records / 508 parsed / 92 without parsed effects / 73 conservative candidates (37 partial / 36 fully unparsed) / zero empty weapon pools. PR [#373](https://github.com/Appl3Tree/Tenno-Hub/pull/373) squash-merged as `bf7e73672303342ce610b4f26b333c6a1a1396d9`; Pages run [#452](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45337375789) completed with a deploy failure. Build and artifact upload succeeded, as did the pre-deploy public REST guard, but `deploy-pages@v4`'s internal ArtifactService lookup returned zero. The public run-artifact endpoint lists one non-expired `github-pages` artifact, 30,711,260 bytes. Because this release changes tests/docs only, no application code needed deployment. The run was not rerun because earlier retries created duplicate artifacts. This is bounded sampled-pool evidence for Tennokai Cycle DPS, not full-catalog or global optimality, Underframe parity, or gameplay validation. No scoring code changed; the focused warning clarification was previously released in PR #371 / run #450. Full repository/optimizer suites and current-source rendered review remain open.

## D3-OPT-TENNOKAI-RELENTLESS-FIVE-SLOT-R0-R2-ORACLE-001 — seeded exact-pool extension (released in PR #376 / run #455, 2026-11-24)

Seed `20261165` extends the same four melee/faction strata to five slots: Broken War / Grineer, Gram Prime / Corpus, Lesion / Infested, and Nikana Prime / Grineer. Each randomized five-mod pool always includes Master's Edge and Relentless Combination plus three shuffled candidates from Condition's Perfection, Opportunity's Reach, Organ Shatter, and Fury. Owned rank caps vary through R1–R2, and the normal-hit cadence varies from 4–20 before each Heavy Attack. The oracle exhaustively scores compatible legal subsets and rank tuples through five slots using rank-30 Catalyst capacity, default weapon polarities, and no Forma. All four optimizer scores match their sampled-pool maxima; every fixture has more than 100 legal assignments and the returned builds satisfy capacity and owned-rank limits.

The isolated `buildOptimizer.test.ts` case passes 1/1 (287.40s test body; 290.91s total; 223 unrelated tests skipped) with `npx vitest run --configLoader runner src/domain/logic/__tests__/buildOptimizer.test.ts -t "matches seeded five-slot R0–R2 exact Tennokai winners across four melee targets"`. `npx tsc --noEmit -p tsconfig.test.json`, focused ESLint, the mod-effect coverage audit, and CRLF-aware `git diff --check` pass. The current audit reports 698 profiles / 600 eligible mod records / 508 parsed / 92 without parsed effects / 73 conservative candidates (37 partial / 36 fully unparsed) / zero empty weapon pools. PR [#376](https://github.com/Appl3Tree/Tenno-Hub/pull/376) squash-merged as `6375eaaa7117235207953317bb9cb33fd9034939`; Pages run [#455](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45345684689) succeeded. This test/docs-only release expands bounded Tennokai Cycle DPS sample coverage; it does not establish full-catalog/global optimality, Underframe parity, or gameplay validation.

## D3-OPS-PAGES-ARTIFACTSERVICE-SETTLE-001 — public REST / internal artifact-index race (validated in PR #374 / runs #453–#454, 2026-11-24)

Pages run [#452](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45337375789) provides fresh evidence that the earlier REST metadata poll does not guarantee that `deploy-pages@v4` can see the uploaded artifact. The build and upload completed; the guard saw exactly one live `github-pages` artifact, but the deploy action immediately failed with “No artifacts named `github-pages`.” GitHub's public artifact endpoint currently lists exactly one non-expired artifact (30,711,260 bytes, ID `14894363980`). Do not rerun #452: prior retries have created duplicate artifacts, and this run changed no application source.

Source review confirms `actions/deploy-pages@v4` calls the artifact toolkit's `DefaultArtifactClient.listArtifacts()`, which uses the internal Twirp ArtifactService. The current repository guard uses the public Actions REST endpoint, so the two indexes can become visible at different times ([deploy-pages API client](https://github.com/actions/deploy-pages/blob/v4/src/internal/api-client.js), [toolkit artifact listing](https://github.com/actions/toolkit/blob/main/packages/artifact/src/internal/find/list-artifacts.ts)).

PR [#374](https://github.com/Appl3Tree/Tenno-Hub/pull/374) changes the guard to wait for three consecutive public REST observations of exactly one non-expired `github-pages` artifact, with five seconds between observations; zero results reset the count, duplicates fail immediately, and 15 checks bound the wait to 70 seconds. In Pages run [#453](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45340869004), all three checks returned one artifact, the deploy action found one artifact, and deployment succeeded. A second fresh run, [#454](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45342120634), followed docs-only PR [#375](https://github.com/Appl3Tree/Tenno-Hub/pull/375) and repeated the same three-check / one-artifact success. These two runs validate the delay but do not query or guarantee the internal index on future runs. The issue is closed for this observed incident and should reopen if the mismatch recurs; do not rerun failed runs with existing artifacts.

## Full-suite retry completed (2026-11-24)

`npx vitest run --configLoader runner --pool=threads --maxWorkers=2 --bail=1 --reporter=dot` passed 57/57 test files and 1,002/1,002 tests in 6,110.46s. This validates the exact-preserving optimizer preview-reuse candidate and measured test timeout adjustments on that source snapshot. Critical Precision and Unseen Dread snapshot changes were implemented afterward, so the full suite does not validate those newer changes.

## D3-MOD-CRITICAL-PRECISION-UNSEEN-DREAD-SNAPSHOTS-001 — bounded Burst model

Current Wiki sources list Critical Precision's six rank values as +2.5/+4/+5.5/+7/+8.5/+10% base Critical Chance per prior headshot projectile, with the augment bonus capped at +500% and additive with similar base Critical Chance mods ([Critical Precision](https://wiki.warframe.com/w/Critical_Precision)). Unseen Dread's six ranks add +50/+75/+100/+125/+150/+175% Critical Damage while invisible; the augment can use invisibility from any source, and it activates after one strike hits at least three enemies ([Unseen Dread](https://wiki.warframe.com/w/Unseen_Dread)).

The user approved bounded Burst snapshots. Critical Precision exposes an editable 0–200 prior-headshot-projectile count for direct Tiberon Burst and Tiberon Prime's named Burst row only. The calculator adds the rank-scaled bonus to the base Critical Chance modifier bucket, capped at +500%, and Burst Auto Optimize considers the augment only while the snapshot is positive. Missed-burst decay and shot history are not simulated. Unseen Dread exposes an active-invisibility assumption for direct Dread Burst only; its bonus adds to Critical Damage and Burst Auto Optimize considers it only while the assumption is active. The three-enemy trigger and five-second invisibility history are not simulated. Both snapshots save and restore with the planner build and appear in the calculator explanation.

Sustained DPS is recomputed after removing active Burst-only snapshots. Direct finite sequences and expected encounters strip them; fixed-window and non-Burst optimizer scoring remove or reject them. Area coverage, Critical Precision missed-burst decay, Unseen Dread trigger timing, and Unseen Dread duration/history remain unmodeled. This is not gameplay calibration or Underframe parity.

After these source changes, `damageCalc.test.ts` passes 186/186, including rank parsing, snapshot math, supported-row gating, snapshot-free sustained/finite scoring, and normalization. The filtered Critical Precision/Unseen Dread optimizer scope passes 2/2. App/test TypeScript, focused ESLint, source validation, mod-effect coverage audit (698 weapons; 510/600 eligible records parsed; 90 without parsed effects; 73 conservative candidates: 39 partial / 34 fully unparsed), a 989-module temporary-output Vite production build, and `git diff --check` pass. The complete repository suite passed before these snapshot changes and was not rerun afterward. Rendered current-source review, live-game accuracy, and Underframe parity remain open.

## D3-MOD-CRITICAL-PRECISION-UNSEEN-DREAD-SNAPSHOTS-001 — deployment reconciliation (2026-11-24)

PR [#378](https://github.com/Appl3Tree/Tenno-Hub/pull/378) squash-merged as `3c2e225116cfd61883c1b30e8e33cca36c083f9a`. Pages run [#457](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45445244235) passed Build, Upload Pages artifact, the three-check artifact-index settle step, and Deploy to GitHub Pages. This confirms deployment of the merged source. The localhost request from the workspace still timed out, so rendered current-source review remains open. No live-game accuracy or Underframe parity is claimed.

## Docs checkpoint reconciliation (2026-11-24)

Docs-only PR [#379](https://github.com/Appl3Tree/Tenno-Hub/pull/379) recorded PR #378 and Pages run #457, then Pages run [#458](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45446284739) succeeded for that docs checkpoint. PR #379 changed no application source; snapshot deployment remains the result of run #457.

## D3-MOD-CRITICAL-MUTATION-BURST-SNAPSHOT-001 — implementation and validation (2026-11-24)

The [Critical Mutation Wiki page](https://wiki.warframe.com/w/Critical_Mutation) lists six ranks that add +5/+10/+15/+20/+25/+30% Critical Chance and Critical Damage per kill, up to +300% each, and lose the same increment when its reload grenade hits fewer than three enemies. Catabolyst and Coda Catabolyst each expose a direct `Primary` attack row and separate reload-grenade rows ([Catabolyst](https://wiki.warframe.com/w/Catabolyst), [Coda Catabolyst](https://wiki.warframe.com/w/Coda_Catabolyst)).

The user approved a bounded prior-kill snapshot. The planner exposes an editable 0–60 prior-kill count and applies the selected augment rank's per-kill value to base Critical Chance and Critical Damage, capped at +300% for each. It scores the snapshot only for Burst on the direct Catabolyst/Coda Catabolyst `Primary` row; the snapshot is held fixed through the Burst. Burst Auto Optimize can consider the augment only when this supported row is selected and the snapshot is positive. The value saves/restores with the planner config and appears in the score explanation.

Kill-stack history is not simulated: neither kills during the scored event nor grenade-hit reductions update the snapshot. Reload grenade rows, finite TTK, five-second DPS, sustained/Scaling, fixed-window, and other non-Burst scoring do not receive this effect. This is a bounded single-target scoring assumption, not a dynamic encounter timeline, live-game calibration, or Underframe parity.

After this change, `damageCalc.test.ts` passes 187/187, including rank parsing, rank-scaled crit math, row/goal gating, snapshot normalization, and snapshot-free non-Burst paths. The filtered Critical Mutation optimizer regression passes 1/1 and confirms the augment is eligible only for a positive supported Burst snapshot. App/test TypeScript, focused ESLint, source validation, a 989-module temporary-output Vite production build, and `git diff --check` pass. The mod-effect audit reports 698 weapon profiles, 511/600 eligible records parsed, 89 without parsed effects, 73 conservative candidates (40 partial / 33 fully unparsed), and zero weapon pools without a parsed damage effect. The full repository suite was last run before the Critical Precision, Unseen Dread, and Critical Mutation snapshots; no full-suite result is claimed for these changes. Current-source visual review remains open because the in-app browser queued localhost without rendered content.

## D3-MOD-CRITICAL-MUTATION-BURST-SNAPSHOT-001 — deployment reconciliation (2026-11-24)

PR #381 squash-merged as `1b6a872837077c6d0813061b0cd08073f0dd0323`. Pages run [#460](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45457577374) succeeded through build, artifact upload, the artifact-index settling step, and deployment. This confirms deployment of the merged snapshot source. Current-source rendered review remains open because the in-app browser queued localhost without returning rendered content; no live-game calibration or Underframe parity is claimed.


## D3-MOD-AMALGAM-RIPKAS-TRUE-STEEL-LINKED-EQUIPMENT-001 — scoped linked-effect handling (2026-11-24)

The [Amalgam Ripkas True Steel Wiki page](https://wiki.warframe.com/w/Amalgam_Ripkas_True_Steel) identifies the mod as Ripkas-exclusive and lists its native Critical Chance bonus alongside Reload Speed for Shotguns and Gore Chance. Its maximum rank gives +187% Critical Chance, +20% Shotgun Reload Speed, and +100% Gore Chance. The planner parses the native Ripkas Critical Chance; the coverage audit also flags Shotgun Reload Speed because it applies to separate equipment.

The planner has no linked Ripkas/Shotgun equipment model. For Ripkas scoring, the Mod Builder retains a source-linked disclosure that the parsed Critical Chance can affect Ripkas, while Shotgun Reload Speed belongs to separate equipment and Gore Chance is utility only. The optimizer suppresses only those linked-equipment and utility warning lines for this selected Ripkas profile, so they do not block the native Critical Chance effect. No Shotgun stat is transferred and no gore or loot utility is scored.

The focused optimizer regression verifies that Amalgam Ripkas True Steel is selected for Ripkas Burst from its native Critical Chance while the warning still reports +20% Shotgun Reload Speed, separate Shotgun equipment, utility-only Gore Chance, and the Wiki source. It passes 1/1. App/test TypeScript, focused ESLint, source validation, and diff check pass. The mod-effect audit remains 511/600 parsed with 73 conservative candidates (40 partial / 33 fully unparsed); this mod remains partial because the separate Shotgun effect is intentionally not modeled. The full repository suite was not rerun. Current-source rendered review, live-game accuracy, and Underframe parity remain open. PR #383 squash-merged as 6aab015d25669627750ddb68913159f0df1ea204 and Pages run #462 succeeded.

## D3-MOD-AMALGAM-RIPKAS-TRUE-STEEL-LINKED-EQUIPMENT-001 — deployment reconciliation (2026-11-24)

PR #383 squash-merged as 6aab015d25669627750ddb68913159f0df1ea204. Pages run [#462](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45463382323) succeeded through build, artifact upload, the artifact-index settling step, and deployment. This confirms deployment of the scoped Ripkas effect handling. Current-source rendered review remains open because the localhost request timed out and the in-app browser queued without returning rendered content; no live-game calibration or Underframe parity is claimed.

## D3-MOD-ACUITY-MULTISHOT-LOCK-001 — source-listed Multishot restriction (deployed, 2026-11-24)

The generated rank text for both [Primary Acuity](https://wiki.warframe.com/w/Primary_Acuity) and [Pistol Acuity](https://wiki.warframe.com/w/Pistol_Acuity) says “Multishot cannot be modified.” The parser now recognizes that phrase from item descriptions or rank stats and marks every rank with `multishotLocked`.

`calculateBuild` combines that mod effect with the existing selected-attack Multishot lock. When either lock is active, the selected attack retains its configured weapon Multishot, while static and conditional positive/negative Multishot bonuses, next-magazine Multishot, and extra-projectile damage bonuses are ignored. Acuity's weak-point damage and Critical Chance remain scored under the existing selected-target assumptions. The Mod Builder's existing rank text displays the restriction; no separate explanation row was added.

The full `damageCalc.test.ts` file passes 188/188, including Primary Acuity / Braton Prime and Pistol Acuity / Lex Prime rank coverage, static positive and negative changes, conditional and next-magazine Multishot, extra-projectile damage, and the existing selected-attack lock. The optimizer regression passes 1/1: Split Chamber increases score alone but adds no score when paired with Primary Acuity on a configured weak point. App and test TypeScript checks pass with `tsc --noEmit --incremental false`; focused ESLint, `npm run validate:sources`, the mod-effect coverage audit (698 profiles / 600 eligible records / 511 parsed / 89 without parsed effects / 73 candidates: 40 partial and 33 fully unparsed / zero empty weapon pools), a temporary 989-module Vite production build, and `git diff --check` pass. The full repository suite was not rerun.

PR [#385](https://github.com/Appl3Tree/Tenno-Hub/pull/385) squash-merged as `b32aacff301eb68194e69a23742c8bf0e5217dc2`; Pages run [#464](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45471023477) succeeded through Build, Upload Pages artifact, artifact-index settling, and Deploy. Current-source rendered review, in-game validation, and Underframe parity remain open. Reopen if a current Wiki/official source changes the lock's scope or a supported weapon profile requires a distinct Multishot rule.


## D3-MOD-STRAIN-FEVER-BURST-SNAPSHOT-001 — rank-corrected per-cyst Damage (deployed, 2026-11-24)

The [Strain Fever Wiki page](https://wiki.warframe.com/w/Strain_Fever) lists +10/+20/+30/+40% Damage per cyst across its four ranks and notes a +240% total at eight cysts. The max-rank per-cyst value multiplied by eight gives +320%, so that note conflicts with the rank table. The [official Update 37 correction](https://www.warframe.com/en/patch-notes/switch/37-0-0) says the effect was corrected from a flat 40% Damage bonus to 40% Damage per cyst. The planner follows the rank values and official correction, treating the +240% note as stale.

The parser assigns the rank-specific additive base-Damage value to Strain Fever and removes that exact line from the unmatched-stat list. Scoring applies it only to Helminth Claws, using the shared editable 0–8 active-cyst-at-impact snapshot. The Mod Builder labels the input **Active Strain cysts at impact**, discloses that Strain Infection and Strain Fever use different stats from the same assumed cyst count, and shows source links, the damage formula, and the active assumption in build explanations and exports. Burst Auto Optimize may consider Strain Fever only for Helminth Claws with a positive cyst snapshot.

The selected count is held static within the Burst calculation. Cyst growth, erosion/eruption timing, and average uptime are not modeled. Scaling, sustained/stance-average DPS, finite TTK, Expected TTK, and 5s Avg DPS strip the cyst snapshot; Auto Optimize excludes Strain Fever for those objectives and at zero cysts. The snapshot does not infer set-piece count or prove a live-game cyst state.

Focused calculator regressions pass 3/3: rank parsing and unmatched-line removal, +160% at four cysts and +320% at eight for max-rank Strain Fever, additive stacking with Maul, non-Helminth exclusion, finite-scoring removal, and the source link. The filtered optimizer regression passes 1/1 and covers positive-snapshot Burst eligibility, zero-cyst exclusion, non-Burst exclusion, and the build explanation. App/test TypeScript, focused ESLint, source validation, the mod-effect audit, and `git diff --check` pass. The audit reports 698 weapon profiles, 512/600 eligible mods with parsed effects, 88 without parsed effects, 73 conservative candidates (41 partial / 32 fully unparsed), and zero empty weapon pools. A 989-module Vite production build passes via `npx vite build --configLoader runner --outDir .codex-temp-strain-fever-build`; the standard `npm run build` could not write TypeScript build metadata under shared `node_modules/.tmp`, so TypeScript and Vite were run separately. The full repository suite was not rerun.

PR [#387](https://github.com/Appl3Tree/Tenno-Hub/pull/387) squash-merged as `6636658bf06554df055488d4d66694b3955ab9ba`; Pages run [#466](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45482008183) succeeded through Build, Upload Pages artifact, artifact-index settling, and Deploy. Current-source rendered review remains open: the in-app browser queued localhost without rendering, and a direct shell request to `http://localhost/Tenno-Hub/` timed out. No live-game accuracy or Underframe parity is claimed.


## D3-MOD-STATIC-DISCHARGE-PROVA-CYCLE-001 — editable manual cycle estimate (deployed, 2026-11-24)

[Static Discharge](https://wiki.warframe.com/w/Static_Discharge) lists a 4m player-centered pulse, a 1-damage Electricity hit at wind-up, and separate spin-first / overhead-first patterns. Spin-first uses 24% Electricity pulses every 0.2s and an 800% follow-up; overhead-first uses 80% pulses and a 240% follow-up. [Prova](https://wiki.warframe.com/w/Prova) and [Prova Vandal](https://wiki.warframe.com/w/Prova_Vandal) list Heavy Attack totals of 768 and 1,188 with 0.7s wind-up. The catalog feed contains each Heavy Attack total but not its damage-type split, so the new direct Heavy Attack row scales the normal attack's type ratios to the sourced total.

The Mod Builder exposes a manual cycle report for Prova and Prova Vandal while Static Discharge is equipped. The user selects the starting order and an assumed first-animation duration from 0 to 5s in 0.05s steps (default 0.8s). Pulse count is `floor(duration / 0.2s)`, counting the first pulse at 0.2s. The selected rank's +30/+40/+50/+60/+70/+80% damage fraction scales the Wiki pattern coefficients. The expected pre-defense score sums two listed Heavy Attack hits, the selected pattern's pulse count and follow-up, and the literal 1 wind-up damage. This ordering, first-animation duration, first tick phase, and use of the listed Heavy Attack damage on both direct hits are explicit model assumptions because the source does not specify the full animation cycle.

The manual estimate is single-target only and assumes that target stays within 4m of the player. It does not score nearby targets, armor or resistances, target proc history or later status ticks, or animation-accurate cycle DPS. Static Discharge remains excluded from ordinary attack Burst/TTK/DPS and Auto Optimize; the separate Heavy Attack row can be selected and scored without adding the Static Discharge pulse sequence.

Focused cycle and optimizer regressions pass 6/6 across two files. App/test TypeScript, focused ESLint, source validation, and the coverage audit pass; the audit reports 698 weapon profiles, 513/600 eligible mods with parsed effects, 87 without parsed effects, 73 conservative candidates (42 partial / 31 fully unparsed), and zero empty weapon pools. The full repository suite and a local production build were not run for this feature; the deployed Pages workflow's Build step passed in run #468.

PR [#389](https://github.com/Appl3Tree/Tenno-Hub/pull/389) squash-merged as `dc9490a3226402713845994cd89bc47ade6e8d2d`; Pages run [#468](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45493419808) succeeded through Build, Upload Pages artifact, artifact-index settling, and Deploy. The in-app browser request for the local URL returned queued without a rendered snapshot, so current-source visual review remains open. No live-game accuracy or Underframe parity is claimed.

## D3-MOD-OWNED-RANK-INVENTORY-001 and D3-WEAPON-VINQUIBUS-DUAL-PROFILE-001 — released in PR #391 (2026-11-24)

The exact-rank inventory issue came from storing only a total owned count and one maximum rank. The store now records `modRankCounts[path][rank]` plus a separate unranked-copy count. `ModRankInventoryEditor` exposes per-rank add/remove controls and assignment of imported/unranked copies in the Mods page, Mod Builder's Owned Mods panel, and mod detail. The store keeps total count and distribution synchronized. Existing records without an exact distribution retain their previous meaning by treating all copies as the tracked highest rank until edited; this avoids inventing lower-rank copies for legacy users.

With Owned Only active, the optimizer receives exact rank counts. When `Allow Non-Maxed` is enabled, only ranks with positive recorded counts are legal; unknown-rank copies do not grant a usable rank. With lower-rank search off, the highest recorded owned rank remains the only choice. Build snapshots export rank counts and unranked quantity, and the Owned Only tooltip explains the rule. Regressions verify exact R0/R2 ownership cannot invent R1, unknown-only copies cannot enter a build, inventory actions maintain totals, and the legacy snapshot fallback remains stable. The inventory/helper/store tests pass 3/3 and exact-rank optimizer regressions pass 2/2.

The WFCD data contains only Vinquibus's Primary profile. The catalog adds a second `Melee` profile with a distinct unique name and `Vinquibus (Melee)` display label; the Primary entry displays `Vinquibus (Primary)`. They use their own Primary and Melee mod pools. The Melee profile uses the Wiki's Bayonet attack values, separate component attacks/falloff, Bayonet stance class, and Omni stance polarity. Shared weapon polarity/upgrades are copied to the profile. The catalog regression verifies both are independently selectable, checks Serration versus Pressure Point compatibility and sourced attack values/falloff, and confirms the passive-history boundary. It passes 1/1.

Selected validation on the branch passes inventory/store 3/3, exact Owned Only optimizer 2/2, Vinquibus catalog 1/1, capacity/polarity 6/6, Tennokai/Vile timeline 31/31, and selected combo-chance/Vile/Owned Only optimizer tests 4/4. App/test TypeScript, focused ESLint, source validation, mod-effect coverage audit, and a 993-module production build pass. Reproduce the focused checks with `npx vitest run src/domain/logic/__tests__/modInventory.test.ts src/store/__tests__/modRankInventory.test.ts`, `npx vitest run src/domain/__tests__/weaponCatalog.test.ts -t "Vinquibus as separate"`, `npx vitest run src/domain/logic/__tests__/buildOptimizer.test.ts -t "matches seeded two-slot R0–R1 exact winners with both combo chance mods|matches seeded Vile Discharge optimizer winners across four target strata|limits Owned Only rank search to copies recorded at exact ranks|does not invent a usable mod rank for owned copies with unknown rank"`, and `npx vitest run src/domain/logic/__tests__/tennokaiTimeline.test.ts src/domain/logic/__tests__/vileDischargeTimeline.test.ts src/domain/logic/__tests__/capacityCalc.test.ts`. The audit reports 699 profiles and 514/600 eligible mod records with parsed effects; its 73 unmatched candidates remain conservative review items (43 partial, 30 fully unparsed). Broad ESLint on edited legacy pages still reports baseline findings and is not claimed as clean.

PR [#391](https://github.com/Appl3Tree/Tenno-Hub/pull/391) squash-merged the source commit `e314a18ee37d4943c49abde0b46679f6ac3f0f7d` as `b583c3685c7b46d38c60fb29bc8e5baba7208681`; Pages run [#470](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45534018445) succeeded through Build, artifact upload, artifact-index settling, and Deploy. The PR had no PR-triggered workflow runs or status checks. The exact-rank inventory and Vinquibus profile changes were released in the same 13-file delta as the combo-chance and Vile Discharge changes below.

Current-source rendered review remains blocked. The in-app browser rendered the supplied localhost planner, but it served a prior build: Vinquibus returned zero results in the Melee category. The branch-specific Vite preview on port 4173 timed out. After deployment, the Pages app shell loaded but its Build Planner lazy import failed for `assets/BuildPlanner-sNBsZINI.js`; opening that asset URL returned GitHub's generic Pages outage page, and a retry showed the same error. The Pages workflow itself succeeded, so this is evidence of an asset availability problem, not a confirmed code defect. Underframe parity and live-game validation are also open.

## D3-MOD-MELEE-COMBO-COUNT-CHANCE-001 and D3-MOD-VILE-DISCHARGE-EVENT-CYCLE-001 — released in PR #391 (2026-11-24)

The source branch was based on `origin/main` `9570c7e3` and kept the original dirty worktree untouched. Its source commit `e314a18ee37d4943c49abde0b46679f6ac3f0f7d` is now squash-merged in PR #391 as `b583c3685c7b46d38c60fb29bc8e5baba7208681`; Pages run #470 succeeded. Static Discharge and Strain Fever were already present on main through PRs #387–#390.

The Tennokai timeline now sums additive Additional Combo Count Chance from qualifying regular-hit mods and uses `1 + chance` expected combo points per regular hit. Above 100%, the value is averaged as expected extra hits per qualifying event rather than sampled. Relentless Combination remains modeled through its separate Slash application/Bleed tick events. Seed `20261158` includes Quickening and True Punishment across four melee/faction strata and matched the optimizer against exhaustive legal two-slot R0–R1 rank/subset scores. The focused timeline file passes 22/22 tests; the optimizer selection passes 1/1.

The Vile Discharge timeline scores four Embolist Normal Attack charge/release cycles. It advances direct hits and expected timed DoT ticks, caps the rank-specific stored damage, then resolves a no-crit/no-status 10 Impact contact and separate 100% Toxin explosion. Stored charge follows each event's damage-type pool routing but ignores enemy armor, health-type multipliers, and debuff amplification; overkill is clipped separately to the remaining pool that each type can hit. It includes magazine reload and the rank-modified 0.4s base Alt-Fire action lock, repeated identical target profiles, configured 0–3m / 3–6m explosion neighbors, target-pool defenses, toxin shield bypass, and a bounded candidate-family search followed by exact four-cycle finalist rescoring. Seed `20261166` matched sampled optimizer winners over four target profiles. A regression with a large Impact hit and a small Shield pool verifies the stored charge waits for subsequent Health damage instead of counting damage that overkilled Shields; a separate regression verifies Toxin killing Health counts as a kill even if Shields remain. The focused Vile timeline tests pass 9/9; the Vile objective and seeded optimizer tests pass 2/2.

Vile estimates deliberately assume immediate release at the rank cap. The Wiki recommends releasing earlier to avoid charge waste; user-controlled release thresholds or timing optimization are not implemented. The model does not simulate Embolist primary-hit overlap against multiple targets, even though the Wiki describes multidipping; exact explosion falloff is also not given, so configured neighbor damage uses an area-uniform linear approximation from 100% center damage to 20% at 6m. Fulmination-modified radius, exact positions, stochastic proc histories, and dynamic enemy-state changes are not modeled. The displayed objective is a bounded cycle estimate, not finite TTK or fixed-window DPS.

On the released source branch, Vile + Tennokai timeline tests pass 31/31 and the selected optimizer regressions pass 4/4. App/test TypeScript, focused ESLint, source validation, the mod-effect coverage audit (699 profiles; 514/600 parsed records; 73 conservative candidates: 43 partial / 30 fully unparsed), and a 993-module Vite production build pass. The in-app browser's localhost result was an older build and the branch preview on port 4173 timed out. The deployed Pages app then showed the lazy-import error and generic GitHub outage response for the hashed module URL described above. No current-source visual review, Underframe parity, or live-game validation is claimed.

## D3-MOD-ENDURING-STRIKE-TENNOKAI-LIFTED-001 — implementation, deployment, and visual review (2026-11-24)

Enduring Strike parses its four rank values as +5/+10/+15/+20% Additional Combo Count Chance when attacking a Lifted enemy. Scoring is limited to Tennokai Cycle DPS and activates only when Lifted is selected as an external target status. The timeline adds the rank value to expected extra combo points on qualifying regular Normal Attack hits; random bonus combo gains are averaged. With Lifted absent, the mod contributes no combo chance. Other objectives exclude this effect, and Auto Optimize admits it only for the supported Tennokai objective/status context.

The model assumes the selected target remains Lifted for the full cycle. It does not simulate Lifted application or expiry, including generation from a Heavy Slam, and does not count combo gains on Heavy Attack events. This is a bounded target-state assumption, not a Lifted timing model.

Seed `20261167` samples Broken War / Grineer, Gram Prime / Corpus, Lesion / Infested, and Nikana Prime / Grineer. Each exact-pool fixture includes Master's Edge and Enduring Strike plus three shuffled candidates, owned rank caps through R0–R2, and a randomized 4–20 regular-hit cadence. Exhaustive legal subsets/rank tuples through three slots at rank-30 Catalyst capacity and no Forma match all four optimizer outputs; each fixture has more than 40 legal candidates. The focused timeline/optimizer filter passes 3/3 tests. App/test TypeScript, focused ESLint, `npm run validate:sources`, `npm run audit:mod-effect-coverage`, and `npm run build` pass; Vite reports 993 modules. The refreshed audit has 699 weapon profiles, 515/600 eligible mod records with parsed effects, 85 without parsed effects, and 73 conservative candidates (44 partial / 29 fully unparsed). This is sampled-pool evidence, not global optimality, Underframe parity, or gameplay validation.

PR [#393](https://github.com/Appl3Tree/Tenno-Hub/pull/393) squash-merged as `3046db03148f21293bdf2d6d1464b9cd702f7088`; Pages run [#472](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45539758590) succeeded. The in-app browser rendered the deployed build at `?version=3046db0` with the Build Planner lazy module loaded. The Enduring Strike entry and external Lifted status control were visible. The weapon picker showed separate Vinquibus Primary and Melee profiles; selecting each showed its own profile-specific explanation and build-slot configuration. No saved build was edited. This closes the current-source rendered UI review for these controls, not their live-game accuracy or Underframe parity.

The user-raised owned-rank and multi-profile issues are addressed in PR #391 / Pages run #470. Owned-mod inventory stores rank-by-rank copy counts plus unranked copies; Vinquibus has independently selectable Primary and Melee profiles with separate mod compatibility pools. The current deployment review confirmed both weapon choices are reachable. These fixes do not model linked weapon effects or Vinquibus passive history.

## D3-MOD-SWIPE-KAVAT-GROUP-SNAPSHOT-001 — rank-capped Kavat Claw group estimate (released in PR #395, 2026-11-25)

The [Swipe Wiki page](https://wiki.warframe.com/w/Swipe) lists ranks with +1/+2/+3/+4 additional enemies and +0.5/+1/+1.5/+2m Attack Range. Beast/Kavat Claws have no listed follow-through value. Per the user's choice, the planner uses the generic [Claws follow-through value](https://wiki.warframe.com/w/Blocking#Follow_Through) of 0.8 as a disclosed proxy; it does not present this as a verified Kavat-specific value.

The Mod Builder exposes and saves an editable count from 0 to 4 for additional same-profile enemies actually hit per Swipe strike. Burst and Scaling scores add the primary score multiplied by the successive-target factor `0.8 + 0.8² + …`, stopping at the lesser of the entered count and the selected Swipe rank's target cap. The count assumes those enemies are within the rank's added reach. The build explanation reports the entered count, rank cap, reach assumption, proxy, and resulting primary-target-equivalent count. When no supported count is entered, the effect warning causes Auto Optimize to skip Swipe; other objectives also skip it.

This is a bounded group score estimate. Target spacing, attack geometry, target selection, Kavat movement, and per-target damage differences are not simulated. The primary target's stat panel, finite TTK, and 5s Avg DPS are unchanged and stay single-target. The 0.8 value is a generic-Claws proxy pending Kavat-specific evidence; no live-game measurement is claimed.

The focused Swipe optimizer tests pass 2/2, including rank caps, no-count/unsupported-goal gates, Burst and Scaling eligibility, unchanged finite/fixed-window scores, rank parser coverage, and explanations. Seed `20261168` checks four sampled two-slot candidate pools: Smeeta / Grineer with one and four entered additional targets, Adarza / Corpus with two, and Vasca / Infested with three. For each, exhaustive legal ordered subsets and R0–R2 owned rank tuples match the optimizer for Burst and Scaling. The full `weaponCatalog.test.ts` file passes 40/40. App and test TypeScript, focused ESLint, `npm run validate:sources`, and `npm run audit:mod-effect-coverage` pass; the refreshed audit reports 699 weapon profiles, 516/600 records with parsed effects, and 73 conservative candidates (45 partially parsed / 28 fully unparsed). `npx vite build --configLoader runner --outDir .codex-temp-swipe-build` passes with 993 modules and the existing large-chunk warning. The full repository suite was not rerun.

PR [#395](https://github.com/Appl3Tree/Tenno-Hub/pull/395) squash-merged as `7b5606a9919af6e89d39f5a064abb627e688524d`; Pages run [#474](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45635375525) succeeded through build, artifact upload, index settling, and deploy. The supplied localhost path refused the in-app browser. The deployed Pages version `7b5606a` rendered Build Planner; I selected Adarza Claws, added Swipe, set the saved additional-target count to 2, and confirmed the Burst score assumptions displayed `+2 Swipe group targets`. This completes rendered current-source review. Underframe parity, live-game accuracy, and Kavat-specific follow-through remain unverified.

## D3-MOD-GUARDIAN-DERISION-BLOCK-COMBO-SNAPSHOT-001 — rendered review and docs reconciliation (2026-11-25)

PR #397 deployed the Guardian Derision block assumption in Pages run #476. Docs-only PR #398 merged as `2ece721212bc67c41dd6309f128d0fef585856be`; Pages run #477 succeeded. The Codex in-app browser rendered `https://appl3tree.github.io/Tenno-Hub/?version=805a6f5`. With Guardian Derision and Condition's Perfection selected on Broken War, Tennokai Cycle DPS Options showed the accessible “Successful enemy hits or projectiles blocked per Tennokai cycle” control and its explanation. Setting the value to 3 visibly updated the control. The Owned Mods panel exposed a separate owned checkbox and an expandable “Owned copies by rank” editor with R0–R5 add/remove controls. The weapon picker listed Vinquibus Primary and Melee; selecting Melee showed its Bayonet profile and an attack-scope explanation. No owned-mod values or saved builds were changed.

This closes rendered UI review for the Guardian block assumption and confirms the previously released exact-rank and Vinquibus controls on the latest deployment. It does not verify incoming-attack probabilities, rank inventory import/export parity, live-game behavior, or Underframe score parity. No application source changed in the docs reconciliation.

## D3-MOD-AUDIT-TRIAGE-COMBO-WARNING-001 — released in PR #400 / Pages run #479 (2026-11-25)

The audit previously framed Quickening / True Punishment's Additional Combo Count Chance as unmodeled random gains even though the Tennokai Cycle DPS timeline uses the expected value of those gains per qualifying regular hit. The mod-effect notes now say this is a supported Tennokai context and clarify that other objectives do not apply this event history. When a specific unsupported objective is selected, the warning still says Auto Optimize skips the mod; Tennokai Cycle DPS has no exclusion warning. This corrects context/explanation text only and changes no scoring calculation.

The audit introduction now makes clear that it is a context-free keyword screen: candidate rows may be partial, utility-related, or supported only under selected objectives and assumptions, and optimizer gates depend on that context. The current audit reports 699 weapon profiles, 600 eligible records, 517 parsed, 83 with no parsed effect, and 73 conservative candidates (46 partial / 27 fully unparsed). These remain triage candidates, not 73 confirmed missing implementations.

The focused `buildOptimizer.test.ts` regression passes 1/1, including context-free and selected-goal warning text for Quickening and True Punishment. App/test TypeScript, focused ESLint, `npm run audit:mod-effect-coverage`, and CRLF-aware diff check pass. `npx vite build --configLoader runner --outDir .codex-temp-audit-warning-build` builds 993 modules successfully with the existing large-chunk warning. The full repository suite was not rerun. Wiki reference: [Melee Combo](https://wiki.warframe.com/w/Combo_Counter). [PR #400](https://github.com/Appl3Tree/Tenno-Hub/pull/400) merged as `526320a027d4efdbeb05bb5f6373c2e24b8884fd`; Pages run #479 succeeded. Its current-source app shell rendered, but the optimizer worker failed and the local endpoint timed out, so planner interaction remains visually unresolved.

## Current-main catalog correction — Harrowing Spire Neutral combo (released in PR #418, 2026-11-26)

The `meleeStanceCombos` table had 58 Neutral entries while the current weapon catalog also exposed Harrowing Spire for the Bayonet profile. The current [Warframe Wiki Stance comparison](https://wiki.warframe.com/w/Stance#Comparison) lists its Neutral combo `Rennen` at 2.1 seconds, +7 combo points, 700% total damage, and 0% Slash-proc multiplier. PR [#418](https://github.com/Appl3Tree/Tenno-Hub/pull/418) adds the source-backed row, changes the coverage count to 59, refreshes the verification date, and adds an exact-value regression. Focused catalog tests pass 2/2; focused ESLint, TypeScript, and the 994-module production build pass (with the existing large-chunk warning).

PR #418 squash-merged as `f9edf99bfe8855c152b96922f95f4513b16bce3f`; Pages run [#497](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45941520462) succeeded. The IAB rendered the deployed `f9edf99` Build Planner with Vinquibus (Melee) and Harrowing Spire selected. The estimate showed 7.00× direct, 0.00× forced Slash, an approximate 2.10s combo, and 1,631 stance-average DPS. No build was saved. The stance picker discloses that its separate rare effect is unmodeled. This verifies the displayed calculation and selection path; it does not validate real animation timing, Underframe parity, or gameplay accuracy.

The full serial suite was started before the correction and its pre-fix loaded test reported the missing Harrowing Spire row; it was still running when this checkpoint was written. It is not post-change full-suite validation.

## D3-MOD-SWIPE-EXPLANATION-CONTEXT-001 — leave-one-out warning context (released in PR #420 / Pages run #499)

Swipe's Kavat Claw group estimate remains the bounded model released in PR #395: Burst and Scaling use an explicitly entered 0–4 target count, capped by Swipe rank, with the user-approved generic Claws 0.8 follow-through proxy. This follow-up does not alter that score.

Current Pages review found that a supported Burst build scored Swipe but its leave-one-out contribution text also said `Not scored`. The explanation warning audit did not receive the configured nearby-target count. PR #420 forwards that count to the audit only for Kavat weapon profiles. Its regression verifies the supported Burst row has the score comparison without the false warning while finite Expected TTK retains the correct unscored-effect warning.

The focused Swipe explanation and seeded optimizer tests pass 2/2 (247 unrelated tests skipped). App/test TypeScript, focused ESLint, `npm run validate:sources`, and a 994-module Vite production build pass; the full repository suite was not rerun. GitHub reported no individual PR checks; Pages run #499 succeeded.

IAB review of deployed `?version=8926ab6` selected Smeeta Claws / Swipe R3 and four same-profile targets. Burst Auto Optimize kept Swipe and Why This Build showed 23,189.7 group score / about 3.36 primary-target equivalents without `Not scored`. Expected TTK displayed the group exclusion, and Auto Optimize removed Swipe. No build was saved. Target geometry remains assumed; the 0.8 value remains a generic Claws proxy. Underframe parity, global optimizer quality, full-suite validation, and live-game accuracy remain open.


## D3-MOD-THERMAGNETIC-SHELLS-BOUNDED-BURST-001 — rank-correct Detron group estimate (released in PR #422 / Pages run #501)

### Source and scope

The current Thermagnetic Shells Wiki rank table gives R0–R3 radius values of 1.5/3/4.5/6m alongside 20/40/60/80 Magnetic damage and 10/20/30/40% of the triggering enemy's Max Health as Blast. This corrects the 2026-11-22 note, which read the generated description's max-rank 6m value as constant across ranks. Hotfix 44.1.3 blocks Elemental Ammo status effects from recursively retriggering the listed on-death explosions; the model does not infer broader chains.

The bounded group estimate is available only for Detron, Mara Detron, and Tenet Detron Normal Attack Burst. It adds one explosion when the expected direct event kills a fresh health-only primary and the user configures at least one neighbor whose representative mean distance is within the selected rank radius. It uses linear 100%–0% falloff at that mean distance, assumes line of sight and same-profile neighbor defenses, uses starting Health as the Max Health proxy, and divides custom Steel Path Health by 2.5. Auto Optimize may select Thermagnetic Shells only in this supported context. This is a group Burst estimate, not finite TTK or 5s Avg DPS.

Neighbor positions and damage variation are compressed into a single mean-distance value; neighbors are not depleted, and their deaths cannot trigger further explosions. Shields/Overguard, status effects, Scaling, finite TTK, and 5s Avg DPS remain outside the model.

### Validation

The focused rank/context, scoring-scope, and seeded optimizer tests pass 4/4 (440 unrelated tests skipped). Seed 20261175 matches exhaustive two-slot owned-rank winners across four randomized Detron-family/faction/Steel Path/health/neighbor-distance/ownership-rank scenarios. Focused ESLint for the seven edited application/test files, npm run validate:sources, app/test TypeScript, and npm run build pass; Vite transformed 994 modules with the existing large-chunk warning. The full repository suite was not run.

PR [#422](https://github.com/Appl3Tree/Tenno-Hub/pull/422) merged as `23ce223227e7a4610c7fb166e04cda122b32d9f2`; Pages run [#501](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/45987206646) succeeded. Deployed IAB review on `version=b41a9ce` selected Detron, configured two neighbors at 0.75m mean distance and a 1-Health target with no Shields/Overguard/Armor, and added Thermagnetic Shells R3. The slot displayed `Modeled group estimate` and the Burst explanation named the selected attack, target, and neighbor context. The temporary mod and target values were reset without saving a build. This rendered check does not establish Underframe parity, global optimizer optimality, full-suite correctness, or live-game behavior.

## D3-UI-BUILD-REASONING-ZERO-BASELINE-001 — required objective mod explanation (2026-11-27)

A read-only in-app view showed `Vile Discharge +0.0%` and “No direct effect” in Why This Build, although removing Vile Discharge leaves the selected cycle objective unsupported at zero score. The leave-one-out percent used zero as its denominator.

Build reasoning now represents undefined mod and Arcane percentage gains as null. The UI renders `N/A` when the baseline score is zero and displays `Required` for Vile Discharge when removing it makes a positive cycle score unsupported. The row and winning-edge summary explain the objective gate. Damage scoring and candidate selection are unchanged.

The focused Vile optimizer/explanation test passes 1/1 (236 skipped in the file), app/test TypeScript checks and focused ESLint pass, and a 994-module production build succeeds with the existing large-chunk warning. Local current-source IAB requests timed out; confirm the rendered explanation against the deployed build after release. This is an explanation correction only and does not establish Underframe parity or gameplay accuracy.

## D3-MOD-FLUX-OVERDRIVE-BURST-SNAPSHOT-001 — released in PR #428 / Pages run #507 (2026-11-27)

PR [#428](https://github.com/Appl3Tree/Tenno-Hub/pull/428) squash-merged as `48077e54c81f08d3aae47e7581c4d0b7012e2780`; Pages run [#507](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/46090737131) succeeded. The deployed app at `version=48077e5` was visually reviewed in the in-app browser. The current [Flux Overdrive Wiki page](https://wiki.warframe.com/w/Flux_Overdrive) provides six rank values for two components: a fixed additive Status Chance bonus (+25% to +150%) and a second oscillating bonus (+16.8% to +100.8%) described in the notes as multiplicative to other Status Chance bonuses. Its max-rank description separately says the total fluctuates from +150% to +250%, which does not reconcile directly with those detailed values. Per the user's decision, the planner follows the detailed rank table/notes and exposes the discrepancy instead of silently applying the shorter description.

The fixed rank component remains active in all supported goals. The Mod Builder saves an editable current oscillation value bounded by the equipped Flux Overdrive rank; the calculator applies it multiplicatively after other Status Chance bonuses for direct single-target Burst, and Burst Auto Optimize uses the same snapshot. Finite TTK, Scaling, sustained DPS, and 5s Avg DPS strip the oscillation snapshot and retain only the fixed rank bonus because the firing-time ramp and long-window average are not modeled. The deployed app displays the shortened selected-slot label and full snapshot explanation, including the rank cap, Burst-only scope, excluded objectives, Wiki link, and conflict between the short description and detailed values. At R5, the field accepts 0–100.8%; it was restored to 0 after verification. No build was saved.

Five focused Flux tests pass. Seed `20261177` compares Auto Optimize against exhaustive legal two-slot selections and owned rank tuples for four faction, target-defense, and snapshot scenarios using Flux Overdrive, High Voltage, Malignant Force, and Cryo Rounds. `damageCalc.test.ts` passes 197/197. Focused ESLint, `npm run validate:sources`, and `npm run audit:mod-effect-coverage` pass; the audit reports 524/600 parsed records and 73 conservative candidates (53 partial / 20 fully unparsed). App TypeScript and the 994-module Vite build pass with the existing large-chunk warning. The full repository suite was not run.

The current-source and deployed previews showed the R5 fixed bonus changing base 24% Status Chance to 60%; the 50.4% oscillating snapshot changed it to 90.2% and updated expected proc values. Burst Auto Optimize completed on the full catalog and chose other mods for this target in the current-source review. The deployed snapshot was restored to 0. No build was saved. This is one rendered calculator case and a bounded optimizer oracle, not global optimality, live-game validation, or Underframe parity. The full suite, firing-time oscillation timeline, long-objective average, live-game accuracy, Underframe parity, and broad optimizer quality remain open.
## D3-MOD-NAPALM-GRENADES-BOUNDED-SEQUENCE-001 — bounded scoring and conservative optimizer gate (2026-11-28)

The [Napalm Grenades Wiki page](https://wiki.warframe.com/w/Napalm_Grenades) says Penta, Carmine Penta, and Secura Penta convert their damage to pure Heat with about a 73% total increase. Its concrete Secura example is 325 Heat direct impact plus 325 Heat area damage from an unmodified 375-damage event pair. The page also describes a separate 100 Heat direct-hit proc and an entry-triggered fire patch that applies Heat status rather than direct damage; the patch lasts about five seconds. It does not fully specify the separate proc's damage calculation or the patch's trigger/timing/radius behavior.

The calculator now represents one selected Penta `Grenade Impact` as the user's approved immediate single-target impact-plus-detonation sequence. Each component receives half of the event-pair base total scaled by `650 / 375` and converted to Heat; this reproduces Secura Penta's sourced 325 + 325 values. Applying that ratio to Penta and Carmine Penta is an explicit inference from the Wiki's approximate total-damage increase and equal Secura split. Napalm Grenades' rank-specific additive Final Status Chance remains active. The selected-mod warning explains the inference and omitted effects, links the Wiki, and keeps the mod out of Auto Optimize until the separate direct proc and fire-patch status event are modeled. AoE coverage remains excluded; the existing standalone detonation row remains reference-only.

The dedicated calculator test passes for all three weapon profiles, verifies pure Heat and the paired 325 + 325 Secura result, and checks the linked event. The existing parser/status regression confirms all six Final Status Chance ranks and the source-linked limitation. Focused Penta optimizer coverage passes 2/2; Napalm itself remains excluded from both Burst and Expected TTK Auto Optimize. The full `damageCalc.test.ts` passes 203/203; test-project TypeScript, focused ESLint, `npm run validate:sources`, mod-effect audit, `git diff --check`, and the 994-module production build pass. The audit remains at 699 profiles, 526/600 parsed mod records, and 73 candidates (55 partial / 18 fully unsupported).

PR [#435](https://github.com/Appl3Tree/Tenno-Hub/pull/435) squash-merged as `9c8167253d0c62a6e10aab0892fae64a41af3af2`; Pages run [#514](https://github.com/Appl3Tree/Tenno-Hub/actions/runs/46124997142) succeeded. The deployed IAB review of `?version=9c81672` selected Secura Penta / Grenade Impact with Napalm Grenades R5. It showed 325 Heat, and the Full Calculation Trace listed one linked Grenade Detonation at +0.000s on the attached target. The selected-mod card linked the Wiki, stated the proportional Penta/Carmine inference, and disclosed the excluded separate direct proc and entry-triggered fire patch; the card also labeled the mod ineligible for Auto Optimize. Running the optimizer replaced Napalm Grenades with eligible mods. No build was saved. The local Vite preview timed out in IAB, so only the deployed build received rendered review. This is a deployed UI and bounded-model check, not gameplay or Underframe validation. The separate direct proc, fire-patch event, and area coverage remain unmodeled, and the repository-wide suite remains open.

## D3-MOD-AVENGING-TRUTH-RAW-BURST-SNAPSHOT-001 — implementation and deployment reconciliation (2026-11-28)
