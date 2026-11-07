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
- Preserve all existing page actions and calculations while improving labels, layout, accessibility, and cross-page navigation.
