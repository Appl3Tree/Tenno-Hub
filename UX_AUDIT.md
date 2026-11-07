# Tenno Hub UX Audit

Scope: document the initial UX findings, the implementation completed in response, and the final local browser/release review. No progression calculations or canonical acquisition data were changed for this overhaul.

## Implementation update — 2026-11-06

The following baseline issues now have code changes in place:

- Theme preference state is shared and reactive, the stored `wft_theme_v1` key remains compatible, and the saved theme is applied before the app renders.
- Semantic tokens now cover shell, shared cards, search overlays, dialogs, inspectors, progress surfaces, and core text/status colors. The Inventory item dossier and Goals dependency-tree dialog now use those tokens instead of fixed dark gradients.
- Workspace categories now land on a default page, show the active route consistently, and use a tablet/mobile drawer with focus, Escape, scroll-lock, and safe-area handling. Route labels are oriented around player tasks.
- The collapsed sidebar retains short visible category and route labels, so location is not conveyed by icons alone. The first-visit Handbook prompt now dismisses only through its explicit actions, with dialog naming and keyboard focus management.
- Page Jump and global catalog search remain separate. The catalog inspector keeps the existing hash format and now supports browser Back/Forward history, Escape, focus trapping, and focus restoration.
- Inventory and goal-tree dialogs now expose dialog names and keyboard focus handling. Key page search fields have explicit accessible names, and the Handbook uses shared page chrome and heading levels.
- Common catalog, farming, syndicate, and Star Chart popovers now use semantic overlay surfaces. Build Planner weapon selection and Incarnon/math dialogs now use theme tokens, named dialogs, keyboard focus handling, and safe-area spacing; build calculations were not changed.
- The Dashboard reset header and Star Chart mobile node-label/keyboard-selection fixes are in place. The Build Planner light-theme review also found pale legacy accent text; compatibility colors were added and contrast-tested.
- A mobile-only React update loop on Prerequisites was found during route review. Stable empty selector fallbacks now prevent a fresh object from being returned on every Zustand snapshot. The page was reloaded and visually checked in both light and dark themes after the fix.
- Expanded QA found and fixed two keyboard-flow defects: Page Jump no longer steals focus while an inspector is closing, and the Build Planner weapon selector now has dialog/search semantics, Escape dismissal, and focus restoration.

Completion and remaining technical caveat:

- UX overhaul Phases A–F are complete. The final route, theme, viewport, workflow, and release-gate evidence is summarized below.
- The shared shell, search overlays, inspectors, and core workspace surfaces now consume semantic tokens. The light-theme Tailwind compatibility overrides still serve many page-specific classes; broader page migration remains incomplete, so those rules cannot yet be removed safely.
- The modified local Vite preview was reviewed in the in-app browser at 390px, 768px, and 1280px, in both themes. All 18 routed pages were checked at every width/theme combination: each loaded without a React error and `document.documentElement.scrollWidth` matched the viewport. This matrix is a route/overflow check; detailed visual inspection focused on representative Dashboard, Goals, Prerequisites, Inventory, Star Chart, and Build Planner surfaces.
- Workflow checks covered theme synchronization and persistence after reload; drawer workspace routing, Escape dismissal, and focus return; desktop workspace defaults; Page Jump and catalog search separation; catalog inspector search, hash history Back/Forward, Escape and focus return; Inventory detail dismissal and focus return; Build Planner weapon picker search/selection and Math dialog dismissal; and Star Chart map/list switching. No inventory state, saved build, import, or progression data was changed.
- The light Build Planner accent contrast fix has automated coverage. Manual visual review recorded the initial issues in the baseline findings below and the repaired behavior above; the browser screenshots were inspected during QA but were not saved as separate image files.
- `npm run validate:external-data` still reports the baseline WFCD raw-data defects listed below. Those source files were not changed.

Current checks after the latest code changes:

- `npm run build`: passed (`tsc -b` and production Vite build). Vite still warns about chunks over 500 kB, including the 41.9 MB main bundle.
- `npm run test`: passed — 29 files and 235 tests.
- `npx vitest run src/styles/__tests__/themeContrast.test.ts`: passed — 7 tests, including coverage for the nine newly mapped light-theme accents.
- Targeted ESLint for the changed search, Prerequisites, Build Planner, and contrast-test files: passed.
- Full `npm run lint`: failed with 933 errors and 22 warnings, down from the recorded baseline of 939 errors and 22 warnings. Most findings are repository-wide `no-explicit-any` errors.
- `npm run validate:sources`: passed. `npm run validate:external-data`: failed on the same 13 `NaN` drop chances and one missing `relicName` in unchanged WFCD raw-data files.
- `git -c core.whitespace=cr-at-eol diff --check`: passed.

## Highest-priority baseline findings

The table below records the state before implementation; the implementation and current verification sections above describe the repaired state.

| Priority | Evidence | Finding and root cause | Keep working |
|---|---|---|---|
| P0 | Live app, Settings and sidebar; `src/app/layout/Sidebar.tsx`, `src/pages/Settings.tsx`, `src/lib/settingsPreferences.ts` | Theme controls hold separate React state. Changing the theme in Settings updates the document but leaves the sidebar control stale. Each screen also reapplies the value read from storage on mount. | Existing `wft_theme_v1` preference and both theme controls. |
| P0 | `src/styles.css` lines 82–437 | Light mode is primarily a cascade of global Tailwind-color remaps, class-fragment selectors, generic `nav`/`aside` and form rules, plus many `!important` exceptions. Dark custom gradients/backgrounds remain in shared and page-specific components. | Existing dark palette, light preference, and legacy class compatibility during migration. |
| P1 | Live mobile navigation; `src/app/layout/Sidebar.tsx` | Workspace buttons change the visible route list without changing the current page. On mobile, selecting Progression left Dashboard displayed, making workspace selection look like navigation when it only filters links. | Every route, current-route highlighting, collapsible desktop rail, mobile drawer. |
| P1 | Live light theme, Page Jump, Catalog Search, and inspector | Search overlays and inspector retain dark surfaces in light mode; some result text becomes hard to read against remapped light surfaces. | Separate Page Jump and global catalog search, shortcuts, entity coverage, contextual result selection. |
| P1 | Live at 390px; `src/pages/Dashboard.tsx` / reset tracker section | Dashboard main content extends to 434px in a 390px viewport. The Reset Tracker header's flex row is the overflowing descendant. | Reset tracking controls and actions. |
| P1 | Live Star Chart at 390px; `src/pages/starChart/StarChartMap.tsx` | Planet labels overlap or clip on the map at phone width. The map's visible planet/node selection is not represented as keyboard-accessible controls in the accessibility tree. | Interactive map, list view, planet/node data and completion overlays. |
| P1 | Live Mods/Inventory light mode and 768px tablet | Data tables and dense catalog controls retain dark/custom backgrounds under the light theme; at tablet widths, the 320px sidebar leaves little room and table content clips or requires horizontal movement. | Virtualized comprehensive catalogs, search, filters, ownership and rank state. |
| P2 | `src/app/App.tsx` lines 116–151 | Inspector opens through hash updates using `history.replaceState`; this replaces the current entry, so browser Back does not naturally step through panel navigation. The panel close control lacks dialog semantics, Escape handling, and visible focus management in the inspected implementation. | Existing hash deep-link format, nested entity selection, in-page contextual inspection. |
| P2 | Live first-visit dashboard; `src/app/layout/Shell.tsx` | The first-visit prompt blocks the workspace; clicking the backdrop permanently marks it dismissed. That makes the first interaction ambiguous and can hide the prompt without a deliberate choice. | Handbook discovery and the option to dismiss the prompt. |
| P2 | Live collapsed sidebar; `src/app/layout/Sidebar.tsx` | At 92px, primary navigation is icon-only. Tooltips and accessible names help assistive technology, but visual page/category labels are absent. | Collapsed rail and its width preference. |

## Page and workflow review

- Source review covered route metadata, shell/sidebar/topbar, settings preferences, search palettes, workspace primitives, app-level inspector routing, styles, and all page modules. Every routed page remains represented in the route table.
- Accessibility and navigation checks covered dialog names, picker/search labels, keyboard dismissal, focus trapping/restoration, drawer focus and Escape behavior, and keyboard-accessible Star Chart selection. Theme persistence was verified across reload and both theme controls stayed synchronized.
- Diagnostics rendered in the local preview during the route matrix. Its remote deployment loading delay was part of the initial baseline observation; no current local route or overflow issue was observed.

## Baseline checks

- `npm run build`: passed (`tsc -b` and Vite production build). Vite reported large output chunks, including a main bundle above 40 MB.
- `npm run lint`: failed at baseline with 939 errors and 22 warnings, mostly existing `no-explicit-any` findings plus unused variables and regex warnings.
- `npm run test`: 23 of 24 test files passed; 213 of 214 tests passed. The `build optimizer scoring` forma-cap test timed out at 12 seconds during the concurrent baseline run.
- `npm run validate:sources`: passed.
- `npm run validate:external-data`: failed on existing source data: 13 `NaN` drop chances in `warframe-drop-data/all.slim.json` and one missing `relicName` in `warframe-drop-data/relics.json`.
- The modified local Vite preview was reached through the in-app browser for the route/theme/viewport matrix above. Detailed visual claims are limited to the explicitly named representative screens and workflows.

## Preservation checklist

- Do not change canonical IDs, item catalogs, acquisition-source accuracy, inventory/mastery state, progression calculations, goal requirements, or imports/exports.
- Preserve both search systems and their keyboard shortcuts, all routes, search-detail hashes, and useful page context.
- Preserve collapsed navigation, mobile drawer, compact-list preference, and the stored theme key.

## Content-first workspace audit — 2026-11-07

### Phase 1 — scroll and viewport baseline

The active route uses `Shell`'s `.wf-workspace` as an outer `overflow-y-auto` viewport. Inventory, Mods, and Arcanes then create a second vertical scroller around their virtualized rows. Their page sections also specify `md:min-h-[42rem]`, which forces a minimum height even when the viewport is shorter than the catalog shell.

| Route | Result viewport at 1440×900 | Result viewport at 1280×720 | Baseline issue |
|---|---:|---:|---|
| Inventory | 395px / 839px main workspace (47%) | 238px / 659px (36%), plus 29px outer overflow | Search, ownership/status/variant, categories/refinements, table controls and a second list scroller stack above results. At 390×844 the flex list expands to its full 48,750px virtual height, so all 869 visible rows render instead of a viewport window. |
| Mods | 303px / 839px (36%) | 129px / 659px (20%), plus 29px outer overflow | Similar permanent filter/control stack and nested scroll; Riven/detail overlays have their own purposeful scroll areas. |
| Arcanes | 383px / 839px (46%) | 249px / 659px (38%), plus 29px outer overflow | Similar permanent controls and nested scroll; tri-state category include/exclude filters must remain intact. |

The manual Inventory window reads only the internal list's `clientHeight` and `scrollTop` and listens to `window.resize`. Mods and Arcanes share the same assumptions in `useVirtualLedgerWindow`. This means removing the internal list height constraint without changing the virtualizer would break the measured window, and the current mobile unconstrained flex case already demonstrates that failure. The implementation will give each catalog route one explicitly sized collection scrollport, measure that element with `ResizeObserver`, and virtualize against that scrollport while retaining virtual rows and stable scroll behavior.

### Other route audit

- **Goals, Requirements/Farming, and Prerequisites:** ordinary document flow; no permanently fixed data-table control stack. Goal-tree and source popovers scroll within their own dialogs/popovers, where independent scrolling is expected. No structural change planned.
- **Syndicates/offering cards:** natural page flow with compact cards and no parallel page/list scroller. No structural change planned.
- **Star Chart:** map and node panels use explicit map viewport sizing and their own list/detail panes to preserve map interaction. This is an intentional interactive canvas rather than a virtual catalog. Keep that model.
- **Relic planner:** Goal Tracker uses natural page scrolling for relic cards and does not add a results viewport. Relic Farming intentionally keeps a bounded selector beside recommendations on desktop; this created a second vertical scroll on phones and tablets, so Phase 5 changes it to natural page flow below the desktop side-by-side breakpoint and labels the desktop scroll region for keyboard access.
- **Other bounded lists:** diagnostics, mod-builder selectors, popovers, inspectors, and dialogs use bounded scrolling for local content. Those are purposeful surfaces and are not candidates for blanket overflow removal.

### Planned architecture

Inventory, Mods, and Arcanes now use one collection scrollport for controls and results. Advanced controls are disclosed on demand and retain their state while closed. Compact filter summaries expose active constraints and allow individual removal and clearing. The collection scroller owns the result scroll offset; virtual windows observe the scrollport dimensions and position rather than assuming the list itself is the scroll element. Other routes retain the shell's normal document scrolling unless they have a purposeful interactive pane.

### Phase 2 — shared collection primitives

Added a reusable collection scroll surface, an active-filter summary that stays to one horizontal row until expanded, an accessible Filters disclosure button/panel, and a shared virtual-window hook. The hook observes the collection scrollport, content, and row anchor with `ResizeObserver`; the pure window calculation accounts for the distance from the top of the collection scrollport to the virtual rows. The implementation retains fixed-height virtual rows and resets only when callers identify a result-changing filter/sort transition. Unit coverage verifies offsets above and within the result region, viewport-height recalculation, and empty results.

The application workspace remains the scroll owner on other routes. Table headers stick within the collection viewport, while compact search/filter/sort toolbars remain reachable without retaining the full filter stack. Active filter chips identify hidden filter state and support direct removal; filter counts include result-affecting facets such as Inventory's column filters.

### Phase 3 — Inventory

Inventory now places its heading, compact search/action/sort toolbar, horizontal primary-category rail, active-filter summary, advanced filters, table heading, and rows inside one collection scroll surface. The advanced panel retains ownership and mastery controls, current-MR/source availability, tri-state Prime/Vaulted controls, category-specific refinements, Safe to Sell rules, and every column filter. The toolbar's More menu keeps bulk actions and visible-column customization available on narrow screens. Column-level filters wrap into readable widths instead of being clipped by the wide table.

The virtual window is calculated against the collection scrollport. Result-changing filters and sort changes reset to the top; opening or closing the filter panel does not. The page stays virtualized with 869 default rows and supports keyboard page navigation. On compact phone layouts, the shared root still owns vertical scrolling and the results window stays bounded instead of rendering the full catalog.

### Phase 4 — Mods and Arcanes

Mods and Arcanes now use the same shared toolbar, filter disclosure, removable active-filter summary, collection scrollport, and observer-based virtual window. Their existing category/type/polarity/special-slot include/exclude states, ownership or rank controls, Riven workflow, sort choices, detail panes, and row actions remain available. Fixed row sizing now matches the rendered row height, avoiding blank gaps or virtual-window drift.

### Phase 5 — route audit and targeted changes

- Goals, Requirements/Farming, Prerequisites, and Syndicates retain natural document flow. Their bounded areas are dialogs, node/source inspectors, or small local lists rather than competing catalog viewports.
- Relic Goal Tracker keeps natural page scrolling for its search, tier/vault controls, goal highlighting, and card results. Relic Farming retains its bounded selector only in the desktop side-by-side layout; below the `lg` breakpoint it expands in page flow, leaving the application workspace as the only vertical scroll surface. The desktop selector is a named, keyboard-focusable region.
- Star Chart map and node/detail panes retain their bounded interaction model. Diagnostics, Mod Builder selectors, and contextual dialogs/popovers retain local scrolling where each surface has its own task and controls.
- No optional Focus View was needed after the three catalog routes gained sufficient result area with filters collapsed.

### Phase 6 — responsive and interaction verification

The local app was inspected in the in-app browser in dark and light themes. Light-theme review confirmed the collapsed toolbar and expanded Inventory filters remain readable; Inventory column controls now fit their panel. Inventory, Mods, and Arcanes filter behavior was checked for active counts, removable chips, collapse/reopen value retention, category changes, sorting, clear filters, Safe to Sell, and tri-state include/exclude behavior. Page Down and End moved the collection scrollport and virtual row window together.

| Viewport | Inventory results / content viewport | Mods results / content viewport | Arcanes results / content viewport |
|---|---:|---:|---:|
| 1440×900 | 609px / 78% | 613px / 77% | 670px / 84% |
| 1366×768 | 477px / 73% | 466px / 70% | 538px / 81% |
| 1280×720 | 429px / 71% | 418px / 69% | 490px / 81% |
| 1024×768 | 462px / 71% | 466px / 71% | 538px / 82% |
| 390×844 | 455px / 67% | 459px / 67% | 531px / 78% |
| 320×568 | 179px / 44% | 183px / 45% | 255px / 63% |

The compact 320×568 viewport is the tightest case: Inventory and Mods retain a short virtual window under the application chrome, while Arcanes shows more of its shorter list. Horizontal table movement remains available where the column set exceeds the viewport. Relic Farming was also checked at 320×568 and 1280×720: the phone uses only the page's vertical scroll, and desktop retains the independently scrollable selector beside natural-flow recommendations.

Release checks: `npm test` passed (30 files, 239 tests); `npm run build` passed (`tsc -b` and Vite production build). Vite continues to report existing oversized data chunks, including the approximately 41.9 MB main bundle. `git -c core.whitespace=cr-at-eol diff --check` passed. Targeted ESLint passed for the shared collection primitives and app shell; the expanded command also included `RelicFarming.tsx` and reported its pre-existing `missionRewardsRaw as any` cast (line 13), outside this layout change.
