# AlecaFrame lastData.dat — importer audit (work in progress)

## Source and privacy

- User selects %LOCALAPPDATA%\\AlecaFrame\\lastData.dat in the browser.
- AES-128-CBC with PKCS#7 padding, using the fixed key/IV published in open-source AlecaFrame inventory parsers.
- No server request, upload, logging, analytics event, or persisted plaintext.
- File size is limited to 25 MB. The parser accepts the direct inventory JSON and the InventoryJson-wrapped form.
- The supplied real-world November 6, 2026 snapshot was verified locally using OpenSSL and Node WebCrypto, **not committed** to this repository.

## Verified real snapshot structure

- 191 top-level keys
- RawUpgrades: 818 stacked-mod records, with ItemCount and ItemType
- Upgrades: 547 per-copy records, with ItemType, ItemId, and UpgradeFingerprint
- 13 individualized Riven fingerprints have no simple lvl property, and must not receive a fabricated rank
- FlavourItems: 437 individually listed items, **without** ItemCount
- MiscItems: 834 records, with ItemCount and ItemType
- Recipes: 408 records, with ItemCount and ItemType
- Missions: 372 records; QuestKeys: 44; XPInfo: 354
- PendingRecipes: 24 in-progress crafts; these are not owned finished items

## Import behavior

- Parse only explicitly enumerated inventory groups. Inventory categories with ItemCount are distinct from per-owned-copy groups.
- Resolve by exact Lotus path against the runtime canonical catalog; do not map by display name.
- Aggregate normal ranked mods and rank-zero stacks without losing the per-rank distribution.
- Preserve modRankCounts per Lotus path in persisted state; update legacy modRanks (maximum owned rank) and arcaneRanks for backwards-compatible UI.
- Keep a detailed issue registry for unknown paths, malformed quantities, unsupported fingerprints, or missing sections.
- Refuse to commit an incomplete snapshot; the user can download the complete issue report.
- When complete, save a Progress Pack backup before applying the import.
- The merge only changes records explicitly present in the snapshot. Unmentioned records remain unchanged. Currency is intentionally retained unchanged pending a separate semantics audit.

## Known blockers before release

1. Resolve all unmatched paths returned by this real file against the current catalog. Add missing catalog data rather than guessing IDs.
2. Implement and independently validate individualized Riven fingerprint mapping to the current CustomRivenRecord schema (or keep import blocked).
3. Confirm that every listed owned-item section represents actual ownership and not an inbox/claimable asset. In particular, investigate EmailItems before release.
4. Verify mod/arcane rank-and-quantity interpretations against a second snapshot with known in-game ground truth.
5. Run npm test, npm run build, and interactive import dry-run in both desktop and mobile browsers. No claim is made that these have passed yet.
6. After completing the scope, separately implement validated mission, quest, mastery XP, and Foundry import; these are **not imported** by this initial inventory-focused parser.

## Restrictions

Do not commit any real lastData.dat, full decrypted JSON, private account identifier, item instance identifier, or fingerprint to GitHub. Use synthetic fixtures and aggregate-only debugging.
