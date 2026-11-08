# AlecaFrame inventory import

Tenno Hub reads a user-selected `lastData.dat` snapshot locally in the browser. The importer converts only records with a verified exact catalog identity into canonical inventory counts. Unmatched or incomplete records remain visible in the review report; they are not silently discarded or mapped by display name.

## File format and privacy

The supported file is AlecaFrame's `%LOCALAPPDATA%\AlecaFrame\lastData.dat`. The observed format is AES-128-CBC with PKCS#7 padding, followed by UTF-8 JSON. The key and IV are constants used by independent AlecaFrame save readers; the file has no application-level header or compression layer. The decoded root may contain an `InventoryJson` string or object wrapper, which the parser unwraps before analysis. Independent implementations use the same decryption and wrapper behavior ([Sainan's parser](https://github.com/Sainan/alecaframe-inventory-parser/blob/senpai/script.pluto), [Sentinel save reader](https://github.com/calamity-inc/Sentinel-for-Warframe/blob/senpai/Inventory.cpp#L790-L927)).

The selected file is read with the browser File API and decrypted with Web Crypto. The complete decrypted document is held in page memory for analysis; it is not sent to a server or persisted. Only normalized import results are stored in the app's existing local state, including counts, rank histograms, normalized Riven fields, and unresolved source paths. The parser rejects empty, malformed, non-block-aligned, and over-25-MiB files, limits each array to 100,000 entries, validates JSON types and quantities, and never evaluates source text. The optional audit download is initiated by the user and contains normalized catalog IDs, exact source paths, counts, ranks, unresolved rows, warnings, and section accounting. It excludes source `ItemId` values and raw personalized Riven fingerprints.

The field names and JSON types observed in the supplied snapshot are listed in [alecaframe-source-schema.md](./alecaframe-source-schema.md). That schema inventory contains no save values, array lengths, owned-item paths, identifiers, quantities, or rank data. AlecaFrame may add or change fields; the importer treats an unrecognized top-level array as unclassified rather than assuming it is inventory or safe to ignore.

## Real-file validation

The supplied file was parsed locally to validate the format and workflow. Its inventory coverage was incomplete because some identities could not be mapped safely. The review report exposes those details to the local user, but this repository does not record account-specific inventory totals or Riven summaries. Personalized Rivens with missing or unsupported source metadata remain marked incomplete and are excluded from build math until their fields are supported.

## Source section interpretation

These meanings are the importer's explicit source rules. `ItemType` is the game's Lotus path. It is matched against the catalog by exact path and expected category; a display-name match is never enough. The format has no public, versioned schema, so interpretations are based on the observed save structure and cross-checks against independent readers. Known sections are handled as follows.

| Source section group | Sections | Interpretation |
| --- | --- | --- |
| Counted inventory | `Consumables`, `LevelKeys`, `MiscItems`, `Recipes`, `CrewShipAmmo`, `CrewShipRawSalvage`, `ShipDecorations`, `FusionTreasures` | Each record must include an explicit safe nonnegative `ItemCount`. `Recipes` stays the exact blueprint/recipe catalog path; the importer does not convert a blueprint into a crafted result. |
| Individually owned equipment and other items | `FlavourItems`, `LongGuns`, `Melee`, `Pistols`, `Suits`, `SentinelWeapons`, `Sentinels`, `SpaceSuits`, `SpaceMelee`, `SpaceGuns`, `Ships`, `Scoops`, `SpecialItems`, `DataKnives`, `MechSuits`, `CrewShipHarnesses`, `CrewShips`, `DrifterMelee`, `Horses`, `OperatorSuits`, `OperatorAmps`, `Motorcycles`, `KubrowPets`, `CrewShipWeapons`, `CrewShipWeaponSkins`, `Drones`, `WeaponSkins` | Each valid source entry establishes one copy. Repeated entries with the same exact item path count as separate copies. A repeated `ItemId` is ignored to prevent duplicate references from double-counting. |
| Stacked upgrades | `RawUpgrades` | Each record requires explicit `ItemCount`; the observed section represents rank-zero upgrade copies, so those copies are recorded at rank 0. |
| Individual upgrades | `Upgrades` | Each unique entry is one mod, arcane, or personalized Riven. A normal mod or arcane rank is read only from an explicit integer `UpgradeFingerprint.lvl`. Missing rank is stored as an unknown-rank copy, never guessed as rank 0 or maximum. |

The section accounting table in the review separates source entries, matched copies, unknown-rank copies, unresolved copies, duplicates skipped, malformed records, and excluded records. A section absent from a save means unknown ownership, not zero ownership. Absence and partial mappings make coverage incomplete; importing an available exact match does not erase local-only records from absent sections.

### Non-inventory and progression sections

The importer explicitly excludes arrays that describe unclaimed attachments, ongoing jobs, histories, progression, loadout selections, or other non-owned state. Examples include `EmailItems`, `PendingRecipes`, `Boosters`, `Missions`, `QuestKeys`, `XPInfo`, `ChallengeProgress`, `FocusUpgrades`, `EquippedGear`, `CurrentLoadOutIds`, `SpectreLoadouts`, `PendingTrades`, `RecentVendorPurchases`, `EvolutionProgress`, and `CrewMembers`. The complete current exclusion map and its per-section reason strings live in `EXCLUDED_SECTIONS` in `src/utils/alecaFrameImport.ts`.

Every top-level array must be either a supported inventory section or an explicit exclusion. A new array containing item identities, or an array whose semantics are unknown, raises a blocking validation issue until reviewed. This prevents a future AlecaFrame field from silently disappearing or being treated as ownership.

## Exact catalog mapping and unresolved records

Equipment, resources, blueprints, skins, and other counted entries retain their exact source path and are matched to `items:` catalog IDs. Upgrade paths are matched only in the mods catalog; paths under the arcane category are classified as arcanes, and personalized Riven templates are matched in the Riven catalog. Catalog matching is exact and category-specific.

If no exact match exists, or a path appears in the wrong source section, the importer preserves the path, category, section provenance, quantity, and any verifiable rank counts in `alecaFrameUnresolvedRecords`. These rows are included in the review and downloadable audit but are excluded from canonical counts. A user must acknowledge unresolved rows before importing the matched data. The saved report is replaced on each import so stale unresolved rows do not carry forward.

`MiscItems` and `Recipes` are treated as independent explicit stacks. `PendingRecipes` is excluded because an in-progress Foundry job does not establish collected ownership. `EmailItems` is excluded because an attachment is not proof that it was claimed. `XPInfo`, mission history, loadout selections, and equipped-slot references do not create extra copies. `PlayerLevel`, `RegularCredits`, and `PremiumCredits` are detected for the preview only; this inventory import does not change mastery, currencies, mastery XP, equipment rank, or Foundry state.

## Mod and arcane ownership

Inventory stores total quantity and an exact rank histogram separately for mods and arcanes. A record may also have an explicit unknown-rank copy count when the source provides quantity but not rank. The Mods and Arcanes pages display that uncertainty. The existing `modRanks` and `arcaneRanks` fields remain for compatibility with build tools and older saves; a partial source rank distribution does not overwrite the previous maximum-rank value with a guess.

For example, an imported stack of eight rank-zero copies plus three individual copies at ranks 3, 5, and 5 is stored as 11 total copies with rank counts `0: 8`, `3: 1`, and `5: 2`. If an individual copy has no verified rank, it contributes to total quantity and the unknown-rank bucket. It is not added to the rank-zero bucket.

## Personalized Rivens

An `Upgrades` entry is treated as an individual Riven only when its exact path matches a Riven catalog entry. The importer accepts an object fingerprint or a JSON-encoded fingerprint, reads known `compat`, `lvl`, `lvlReq`, `rerolls`, `pol`, `buffs`, and `curses` fields, and normalizes only supported attribute tags. Weapon compatibility must match an exact weapon catalog path. Derived stats are generated only when the required source rank, weapon, and attributes are supported; the derived display stats are normalized to the build tool's rank-8 model, and the actual source rank is retained separately. Unknown ranks, missing weapons, and unsupported tags stay represented with an import status and warning and are excluded from the Mod Builder.

Raw fingerprints and source instance IDs are not retained. A SHA-256 digest of the catalog identity plus the source instance ID provides a repeatable local row ID. If the save has no instance ID, the digest uses the normalized fingerprint plus its ordinal among identical fingerprints; this remains stable if unrelated Riven entries reorder. Two indistinguishable records without source IDs cannot be distinguished beyond their multiplicity in the snapshot.

## Review, reconciliation, backup, and persistence

Before applying, the page previews exact matches and ranks, unresolved paths, Riven statuses, excluded records, section coverage, and differences from local state. The user selects one of three behaviors:

- **Merge with choices:** update matching source values, with per-row controls to retain selected local values.
- **Replace matching values:** apply every matching source quantity and rank distribution.
- **Keep local conflicts:** retain existing values when the source differs, while adding new source records.

All modes preserve local-only records not present in the snapshot. They do not interpret a missing source record as deletion. Unresolved report rows are replaced with the latest source report. Reimporting the same snapshot is idempotent; Riven IDs are hashed and import uses replacement quantities instead of incrementing counts.

After the user confirms, Tenno Hub exports the current Progress Pack to a dated JSON backup before applying the change. If backup creation or download fails, state is not changed. Inventory replacement occurs through one Zustand/Immer action and persists through the existing Progress Pack and migration paths. The backup can be restored with the existing Progress Pack import workflow.

## Limits and freshness

`lastData.dat` is a snapshot. AlecaFrame documents that inventory data can be stale between updates; loading screens are a refresh trigger, so a successful parse does not mean the snapshot is live ([AlecaFrame connection guide](https://docs.alecaframe.com/get-started/connecting)). Tenno Hub cannot watch the AlecaFrame folder from a browser; select a newer file to refresh.

The catalog may not contain every path present in a save. The importer reports such rows and does not invent canonical IDs. Until every unresolved path has an approved catalog mapping or a verified non-inventory explanation, the preview remains incomplete and the import remains explicitly partial. Support for a new section or Riven tag requires source evidence, a test, and an update to the section interpretation table and exclusion rules.
