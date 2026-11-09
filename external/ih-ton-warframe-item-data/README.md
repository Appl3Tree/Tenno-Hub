# Legacy Warframe upgrade identity data

`raw/upgrades.json` is from [IhToN/warframe-item-data](https://github.com/IhToN/warframe-item-data), pinned to commit `f93ac0a5a94e58a153d625d1cb013a7318ce1a1e` (2018-01-20). The upstream repository includes an MIT license; see [LICENSE](./LICENSE). That notice does not establish a separate license for the underlying Digital Extremes game names or data.

This snapshot is a compatibility fallback for exact upgrade paths that no longer appear in the maintained catalogs. The generator derives entries from the complete upstream file and skips every path already present in Overframe, WFCD, or the current Public Export Plus catalog. It never reads or filters against a player profile. Current catalogs always take precedence over this historical source.

Run `npm run generate:legacy-upgrades` after changing the pinned snapshot or canonical catalog inputs. The generated output is `src/data/_generated/legacy-upgrades.auto.json`.

The upstream repository has not changed since 2018. Keep this snapshot pinned unless a new revision is reviewed and its source terms and records are revalidated.
