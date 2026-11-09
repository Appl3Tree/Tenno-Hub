# Data Workflow

Tenno Hub keeps upstream source files in `external/` and derived application
data in `src/data/_generated/`. The workflow is designed for Node.js 20 or
newer and does not require `curl` or `jq`.

## Upstream synchronization

The updater discovers the current top-level JSON inventory from each WFCD
repository's Git tree API, then downloads files pinned to that tree's commit.
This lets new category or drop-data files flow in automatically while avoiding
files that upstream has removed. Public Export Plus is synchronized from its
Git tree at a pinned commit using an explicit allowlist of path-keyed exports
and the English localization dictionary.

- `npm run update:data:check` downloads and validates all datasets, builds the
  candidate `All.json`, and reports changes without replacing workspace files.
- `npm run update:data` refreshes all datasets.
- `npm run update:data:warframe-items` refreshes only
  `external/warframe-items/raw/`.
- `npm run update:data:drop-data` refreshes only
  `external/warframe-drop-data/raw/`.
- `npm run update:data:public-export-plus` refreshes only the curated files in
  `external/warframe-public-export-plus/raw/`.

The item repository no longer distributes `All.json` as an upstream category
file. Tenno Hub generates it from all discovered category arrays plus the
required `Components.json` catalog. Component references are resolved with the
default `@wfcd/items` behavior described by WFCD:
the component catalog is indexed first, real category items override it, and
each referenced component keeps its upstream `itemCount`. Missing component
records, duplicate `uniqueName` values, malformed categories, missing required
files, and suspiciously shrinking datasets stop the update.

WFCD's `i18n.json` contains translations that Tenno Hub does not consume; it is
explicitly excluded. Gameplay descriptions and metadata are still read from the
category JSON files. The generated `All.json` is retained in the local raw
folder for existing application imports, but is never requested from upstream.

Drop-data discovery includes all top-level JSON files upstream currently
publishes. Tenno Hub's statically consumed tables are required; the upstream
`all.json` and `all.slim.json` convenience aggregates are included and
schema-checked when present, but are not required by runtime code. When
`all.json` is present, its core aggregate tables are required and every table
also present in a dedicated source file must exactly match that file. WFCD
currently omits `miscItems` from `all.json`, so that dedicated required source
remains the authoritative copy. The slim aggregate is a flattened array of
item/place/chance records.

The updater uses Node's `fetch`, retries transient HTTP failures, validates all
downloads in staging directories, and only swaps data after every requested
dataset has passed validation. A failed directory swap rolls all requested
datasets back. Repeated updates with unchanged upstream files preserve both
file content and sync metadata.

Public Export Plus discovery is intentionally allowlisted. Tenno Hub consumes
the English dictionary and item, ability-name, recipe, upgrade, arcane,
avionics, and booster-pack exports needed for exact path reconciliation. This
avoids copying unrelated mission, vendor, enemy, localization, and
presentation data. Its
path-keyed records supplement exact Lotus identities missing from WFCD and
Overframe. The generated identity catalog keeps only supported inventory
categories and resolves localized names from the English dictionary when
available. When an exported recipe has no localized result identity, its exact
recipe path is retained with a clearly marked path-derived label. Nested reward
references without a standalone item record do not become guessed catalog
identities. See
`external/warframe-public-export-plus/README.md` for the source and generator
contract.

Optional overrides:

- `WARFRAME_ITEMS_RAW_BASE=<raw-folder-url>`
- `WARFRAME_DROP_DATA_RAW_BASE=<raw-folder-url>`
- `WARFRAME_ITEMS_TREE_URL=<GitHub-tree-api-url>`
- `WARFRAME_DROP_DATA_TREE_URL=<GitHub-tree-api-url>`
- `WARFRAME_ITEMS_COMMIT_URL=<GitHub-commit-api-url>`
- `WARFRAME_DROP_DATA_COMMIT_URL=<GitHub-commit-api-url>`
- `WARFRAME_PUBLIC_EXPORT_PLUS_RAW_BASE=<raw-folder-url>`
- `WARFRAME_PUBLIC_EXPORT_PLUS_TREE_URL=<GitHub-tree-api-url>`
- `WARFRAME_PUBLIC_EXPORT_PLUS_COMMIT_URL=<GitHub-commit-api-url>`
- `GITHUB_TOKEN=<token>` for higher GitHub API rate limits

Raw-base overrides retain the legacy folder URL form and append each discovered
filename. Tree URL overrides must return a complete GitHub recursive tree
response. The separate commit endpoint supplies the immutable commit SHA used
for raw file downloads.

## Generate application data

Use `npm run generate:data` after refreshing upstream data. It first rebuilds
the complete `external/warframe-items/raw/All.json`, then regenerates lean
catalogs, Public Export Plus identity supplements, WFCD item and requirement
indexes, acquisition/source indexes, and relic indexes under
`src/data/_generated/`.
Each generated file is written to a sibling temporary file and atomically
replaced after serialization completes, so a failed write does not truncate an
existing artifact.

The legacy upgrade identity fallback is pinned to the 2018-01-20
`IhToN/warframe-item-data` snapshot. Its generator emits only exact records
absent from Overframe, WFCD, and Public Export Plus, and runs after the
maintained Public Export generator. Current catalogs take precedence at
runtime. The upstream repository includes an MIT license, but Tenno Hub does
not treat that notice as a separate license for Digital Extremes game data.
See `external/ih-ton-warframe-item-data/README.md` for provenance and update
constraints.

To regenerate only the aggregate, run:

```bash
npm run generate:warframe-items-all
```

This command requires current category files and `Components.json`. It fails on
unresolved references instead of emitting partial crafting data.

## One-step refresh

```bash
npm run refresh:data
```

This updates both raw datasets and then runs `generate:data`. To review changes
before writing, first run `npm run update:data:check`.

## Wiki blueprint data

The Lua-style wiki blueprint dump remains a separate source:

- Input: `external/wiki/blueprintsDatabase.txt`
- Command: `npm run generate:wiki-blueprints`
- Output: `src/data/_generated/wiki-blueprints.auto.json`

## Validation

After a refresh, run:

```bash
npm run validate:sources
npm run validate:external-data
npm test
npm run lint
npm run build
```

The automated tests include source-inventory discovery, required-file checks,
component aggregation and resolution, shrink detection, and rollback of failed
multi-dataset replacements. External validation also cross-checks each
normalized mission-reward relic key against the named Intact relic catalog.
The current synced item snapshot contains 26
upstream JSON categories at commit
`23804b64bc248069ce39adb9f52e9f546d8f343e`; its complete local `All.json` has
20,166 unique identities. The current drop-data snapshot has 23 top-level JSON
files at commit `e9f1c68006d0f0f7fb9443614e603b04243bbfe5`. The curated Public
Export Plus snapshot is pinned in
`external/warframe-public-export-plus/raw/.last-sync.json`.

At the current upstream snapshot, `npm run generate:data` creates 3,532 relic
mission reward rows. This includes both rotational reward tables and flat
reward arrays (used by Sanctuary Onslaught); refinement suffixes such as
`(Radiant)` resolve to the same canonical base relic key.

`npm run validate:external-data` currently reports two source defects. WFCD's
supplemental `all.slim.json` has 13 invalid `chance` fields (`"NaN"` at
zero-based record indices 13,808, 13,809, 14,454, 15,261, 15,264, 15,395,
15,650, 16,906, 16,921, 16,924, 16,928, 18,124, and 18,706). WFCD's
`relics.json` also has one Intact Requiem row at index 3,181 with no
`relicName`. The updater retains every source row verbatim and reports both
defects. The unnamed relic cannot be assigned a canonical identity, so it is
not synthesized into the runtime relic catalog; strict validation remains
failing until WFCD supplies its name. Do not guess an identity or normalize or
delete the invalid slim reward records. The required per-table files and
`all.json` aggregate have no `"NaN"` chance values at the same snapshot.

## Separate third-party catalog defects

The application catalog also incorporates `external/overframe-gg/items.json`,
which is outside these two WFCD update commands. The source audit currently
finds four zero-source recipe parts in that catalog: Sagek Prime Stock and the
standard Snipetron Barrel, Receiver, and Stock. None is present in the freshly
generated WFCD `All.json` recipe graph. Current game references show that Sagek
Prime uses only a Barrel and Receiver, while the standard Snipetron is built
from its main blueprint and ordinary resources, not those three parts. These
are third-party catalog records with no valid independent acquisition source;
they remain visible in the audit rather than receiving invented source data.
See [Sagek Prime](https://wiki.warframe.com/w/Sagek_Prime) and
[Snipetron](https://wiki.warframe.com/w/Snipetron).

## Troubleshooting

- **GitHub API returns 403:** set `GITHUB_TOKEN` and retry. The updater reports
  the failing API URL and HTTP status.
- **A required file is missing:** check the repository's current `data/json`
  or `data` inventory. Required files are used by direct runtime imports; do
  not bypass the check. Update the application imports and requirements only
  after confirming an upstream rename or removal.
- **An unresolved component is reported:** inspect the named parent and
  `uniqueName` in the category payload and `Components.json`. This is an
  upstream data defect until WFCD's source resolves it; do not generate a
  partial aggregate.
- **A shrink check fails:** compare the affected source at the pinned commit
  with the current raw file. If upstream intentionally removed records, review
  the application impact before adjusting its required-source contract.
- **No network access:** `update:data*` and `refresh:data` require HTTPS access
  to `api.github.com` and `raw.githubusercontent.com`; generation from already
  synchronized data remains local.
