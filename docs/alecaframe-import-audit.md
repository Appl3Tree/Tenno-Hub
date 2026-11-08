# AlecaFrame `lastData.dat` implementation audit

This audit records implementation and validation status for draft PR #6. See [alecaframe-import.md](./alecaframe-import.md) for parser behavior, source interpretation, reconciliation, and privacy details. The private save file and decrypted contents are not stored in the repository.

## Real-file validation

The supplied save was decrypted and parsed locally to validate the format and import workflow. A follow-up audit against the existing WFCD and Overframe path-keyed catalogs found Riven template paths in `RawUpgrades`; these now import as generic Riven-type stacks, separate from fingerprinted personal Rivens. Other identities remain unresolved, so the snapshot is incomplete. No account-specific inventory totals, Riven counts or statuses, owned-item paths, source instance IDs, raw fingerprints, or decrypted values are recorded in the current documentation.

The repository also synchronizes WFCD `warframe-drop-data`. Its reward tables feed acquisition and Star Chart features; acquisition adapters join name-valued rewards to canonical records through normalized catalog names and WFCD aliases. The AlecaFrame importer's exact `ItemType` matcher checks `FULL_CATALOG` records built from WFCD item identities, `Mods.json`, `Arcanes.json`, and the Overframe path-keyed export. Drop-table reward names are not used as a substitute for an exact item identity.

## Local verification

- `npm test`: 266 tests passed in 33 files.
- `npm run build`: passed (`tsc -b` and Vite production build); Vite reported the repository's existing large-chunk warning.
- Targeted ESLint over new importer, reconciliation, and Riven files: passed.
- Full repository ESLint remains blocked by 959 existing violations (940 errors, 19 warnings), mostly `no-explicit-any`; the modified store and export/import files contain baseline violations outside these changes.
- `npm run validate:sources`: passed.
- `npm run validate:external-data`: retains local raw-data errors (`chance="NaN"` and one undefined relic name); no source files were overwritten.
- Browser validation covered real-file preview, search with no matches and recovery, malformed-file handling, unresolved acknowledgement, two-step confirmation, backup-before-apply, persistence across reload, zero-change reimport, and backup replacement restore across reload. The Imports & Backups route showed no horizontal overflow at 390, 768, and 1280 pixels; light and dark themes were checked, and the replacement confirmation's initial focus and cancel focus return were verified. The browser test profile was restored from its pre-import backup.

## Release status

The importer preserves unmatched source identities in the user-visible report and refuses to disguise category ambiguity as a catalog match. It supports importing the verified subset only after explicit acknowledgement. Some source paths are absent from the checked catalogs, so coverage remains incomplete and PR #6 stays a draft. Browser restore, responsive, and theme checks are complete; unresolved source identities still block merge and deployment.

Import and reconciliation are deterministic and preserve local-only records. A real-file reimport now produces no planned changes after persistence, including unresolved rank records. Backup replacement is explicit and confirmed; the merge-based Progress Pack import remains available separately.
