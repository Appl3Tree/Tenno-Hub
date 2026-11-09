# AlecaFrame `lastData.dat` identity audit

This audit records catalog coverage research for PR #6. It intentionally excludes every source path, item name, section-specific ownership detail, quantity, rank distribution, Riven fingerprint, and instance ID from the supplied save.

## Current local coverage

The current production matcher was rerun against the supplied file using the current `FULL_CATALOG` and the same exact-path resolver as the Imports page:

- 12 distinct item identities remain unmatched.
- 0 upgrade identities remain unmatched.
- 0 hard parser errors occurred.
- Inventory coverage is incomplete, so the import is still partial.

The importer preserves unmatched records in the local review report and does not create global catalog records from one player's save.

## Catalog sources reviewed

| Source | Identity fields and result |
| --- | --- |
| WFCD `warframe-items` | Current `uniqueName` paths and item/mod/arcane records were checked; none of the remaining item identities appears as a usable exact record. |
| Overframe item and mod exports | Path-keyed item and upgrade catalogs were checked; no remaining item path resolves there. |
| WFCD Public Export Plus snapshot and English dictionary | The pinned, curated manifests and all available relevant Public Export manifests were checked. No usable exact item record was found. One recipe record contains a matching `resultType` reference, but its parent has no localized result name or item category and is not itself the inventory identity, so it cannot establish a canonical mapping. |
| WARFRAME Wiki `Module:InternalNames` | The generated internal-name table was checked; it does not provide the remaining identities. |
| WFData `ByInternal.json` and `ByName.json` | Both lookup maps were checked; neither provides a remaining identity. The project does not declare a license for its game-data records, so it is not adopted as a source. |
| Warframe.market and its `wfm-items` repository | The API model exposes `gameRef` as an internal path with localized item data, but the current catalog lookup produced no usable matches. The repository documents a `game_ref.uniq_name` field but declares no license. Its 35 manual, untracked item records were checked locally and contained no exact game paths. The API rules also limit request rate and restrict data mirroring, so this is not a suitable bundled source. |
| WFCD `warframe-drop-data` | The repository is used by acquisition, Inventory, Relic Farming, Mods, Arcanes, and Star Chart features. Name-valued rewards join to existing records by normalized display names and aliases; drop rows do not add exact Lotus-path identity records to `FULL_CATALOG`. |
| Other clients and mirrors | Crossframe and similar trackers consume WFCD data. `browse.wf` presents the Public Export Plus data. Aericio's `warframe-exports-data` README describes its repository as a read-only mirror of Digital Extremes' Public Export, so it is not a separate identity source. |

Public Export is the upstream source behind the current path-keyed manifests and supports localized names; see the [WARFRAME Wiki Public Export reference](https://wiki.warframe.com/w/Public_Export). The mirror distinction is documented by [Aericio's repository](https://github.com/Aericio/warframe-exports-data) and [browse.wf](https://browse.wf/about). Warframe.market documents `gameRef` and localized item fields in its [data model](https://docs.warframe.market/docs/data-models/) and its restrictions in the [API rules](https://docs.warframe.market/docs/rules/overview/). The [WFM item repository](https://github.com/42bytes-team/wfm-items) documents its internal path field, but GitHub reports no repository license.

## Local game files

The machine has a local Warframe cache, and [Puxtril's Warframe Exporter](https://github.com/Puxtril/Warframe-Exporter) can read game cache files. This is a possible local research lead, not a redistributable catalog source. Digital Extremes' [Terms of Use](https://www.warframe.com/en/terms) limits use of game software to personal use and restricts copying, publishing, and distributing material derived from it. No extracted game data was added to this repository. The exporter's documentation describes reading `.cache`/`.toc` files and the Oodle dependency in the [Warframe cache format notes](https://github.com/PKBeam/Warframe-Game-File-Docs).

## Data and privacy checks

- Exact identity matching remains path-based and category-aware; display-name similarity is not used as a fallback.
- The real file is parsed locally only. Its decrypted contents, per-record paths, quantities, rank data, Riven fingerprints, and instance IDs are not stored in source, tests, generated catalogs, or this report.
- Public catalog supplements are generated only from pinned global source snapshots and never from the supplied save.
- Drop-table rewards remain acquisition data and do not become canonical item identities through import matching.
- A scan of 55 changed or added text files found no personalized Riven ID or fingerprint values. The only overlap between an unmatched path and changed source data is a global Public Export recipe `resultType` reference; the source has no standalone localized item record for it.

## Validation and release status

Validation completed for the current branch:

- `npm test`: 278 tests passed across 36 files.
- `npm run build`: passed (`tsc -b` and Vite production build); Vite emitted the existing large-chunk warning.
- `npm run validate:sources`: passed.
- Targeted ESLint for the importer, identity generators, and related tests: passed.
- Full-repository ESLint still reports 940 errors and 19 warnings, primarily existing `no-explicit-any` violations.
- `npm run validate:external-data` still reports upstream WFCD raw-data anomalies: 13 `chance="NaN"` values and one missing relic name.
- Real-file and browser workflow checks are recorded in [the importer guide](./alecaframe-import.md) and the task notes.

The 12 unmatched item identities are a deferred coverage limitation for this release. Their exact paths are intentionally omitted because they came from an account-specific sample, and no sample-derived mappings are added to static catalogs. The importer retains them in its unresolved-record report and shows partial coverage so they are not silently lost. Revisit this gap if a supported exact catalog source becomes available or the records can be verified as non-owned/non-inventory data.
