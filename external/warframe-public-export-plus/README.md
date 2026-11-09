# Warframe Public Export Plus data

The selected JSON files in `raw/` are synchronized from
[calamity-inc/warframe-public-export-plus](https://github.com/calamity-inc/warframe-public-export-plus).
The snapshot is pinned by `raw/.last-sync.json`. The upstream repository
includes an MIT license; see [LICENSE](./LICENSE). The manifests originate
from Digital Extremes' Public Export, so the repository license does not
establish a separate license for Digital Extremes' underlying game names or
data.

Run `npm run update:data:public-export-plus` to refresh the curated source
allowlist. It includes path-keyed item and upgrade exports, ability names for
recipe results, booster-pack references, and the English localization
dictionary. Downloads are validated
in staging before the raw directory is replaced.

Run `npm run generate:public-export-identities` after syncing to regenerate
`src/data/_generated/public-export-items.auto.json` and
`src/data/_generated/public-export-mods.auto.json`. The generator adds only
exact records absent from the existing WFCD and Overframe catalogs. It filters
item records by the importer's supported inventory categories and resolves
localized names from the English dictionary. Recipe labels use the exported
result identity when available; otherwise the exact recipe path is retained
with a visibly marked path-derived label. It does not infer catalog entries from nested reward or
`additionalItems` references that lack a standalone item record.

WFCD `warframe-drop-data` remains the acquisition and reward-table source. It
contains reward names and probabilities, not canonical Lotus `ItemType` path
records, so it is not used to invent identity matches.
