# Build Planner Optimizer Benchmark

Run date: 2026-11-14; current full-width refresh: 2026-11-13
Command: `npm run benchmark:build-planner` (the harness defaults to five runs)  
Environment: Windows x64, Node.js v22.16.0, 28 logical CPUs. This invokes the optimizer core directly in Node. It does not measure a production browser Worker.

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

Research was refreshed 2026-11-12 against the [`highs` npm package](https://www.npmjs.com/package/highs), the maintained [`highs-js` documentation](https://github.com/lovasoa/highs-js), the [1.15.4 release notes](https://github.com/lovasoa/highs-js/releases/tag/v1.15.4), and the [upstream HiGHS model specification](https://ergo-code.github.io/HiGHS/stable/). HiGHS supports LP/MILP and convex QP, but the upstream specification says its MIP model is linear and that QP support is not mixed-integer. Its browser Wasm solve calls are synchronous after asynchronous initialization and the documented build is single-threaded; non-trivial browser solves therefore belong in a Worker. Persistent models require explicit disposal. The configured environment could not resolve `registry.npmjs.org` (`ENOTFOUND`), so the runtime package could not be installed for a controlled prototype. No dependency was added.

The Build Planner's decisions and hard limits (mod/rank/slot selection, incompatibility, capacity, Forma, Exilus, arcane, and evolution choices) are discrete and many can be expressed with binary or integer variables. Its score is nonlinear, however: Damage 3.0 quantization and multiplicative modifiers combine with critical expectation, multishot, ordered elemental composition, status proc weights, pool-specific damage, reload duty cycle, and conditional effects. A plain MILP that assigns one isolated coefficient per mod would be a surrogate and can miss the interactions that matter to the actual selected objective. Exact linearization would require bounded state/interaction variables and would still need the verified damage engine to re-score candidates.

The model-shape review rejects HiGHS as a drop-in build scorer: slot, rank, compatibility, and capacity decisions are linearizable, but the actual build objective is nonlinear and order/state dependent. HiGHS could still generate a MILP shortlist whose candidates are re-scored by the shared engine, but the unavailable package prevented a runtime comparison in this environment. The current solver remains a hybrid beam search with hard feasibility checks, a fast target-pool progress proxy (not the full finite encounter), single- and small multi-mod refinement, arcane/Exilus evaluation, and capacity-aware polarity/Forma assignment. It matches bounded nine-candidate/five-slot exhaustive legal-build oracles across eleven weapon/attack scenarios and beats the pre-overhaul outputs on the six-case common-score comparison. This supports the current hybrid over the legacy implementation, but it does not prove global optimality or superiority to a HiGHS shortlist. A HiGHS integration decision remains open until exact re-scoring and browser cost can be compared on the same representative set.

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
