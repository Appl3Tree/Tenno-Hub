# AlecaFrame `lastData.dat` implementation audit

This audit records implementation and validation status for draft PR #6. See [alecaframe-import.md](./alecaframe-import.md) for parser behavior, source interpretation, reconciliation, and privacy details. The private save file and decrypted contents are not stored in the repository.

## Verified sample results

- 191 root fields and 6,361 array entries were parsed.
- 2,467 entries were excluded from classified non-inventory or progression sections.
- 3,421 normalized item/mod/arcane rows plus 5 Riven template identities covered 3,426 catalog identities and 3,851,580 matched non-Riven copies.
- 73 distinct identities representing 167 copies remain unresolved. Of these, 68 are absent from every current catalog namespace and 5 coincide with another catalog category, so their source section does not establish a safe canonical category.
- 14 personalized Rivens were retained: 1 ready, 10 rank unknown, 2 weapon unknown, and 1 with an unsupported stat tag.
- There were 0 blocking structural issues and 33 review warnings. Snapshot coverage is incomplete.

The report intentionally records aggregate counts only. It does not include owned-item paths, source instance IDs, raw Riven fingerprints, or decrypted values.

## Local verification

- `npm test -- --run`: 261 tests passed in 33 files.
- `npm run build`: passed (`tsc -b` and Vite production build); Vite reported the repository's existing large-chunk warning.
- Targeted ESLint over new importer, reconciliation, and Riven files: passed.
- Full repository ESLint remains blocked by existing violations outside the new files. The modified Mods/Progress Pack files also contain pre-existing lint failures outside the changed lines.
- `npm run validate:sources`: passed.
- `npm run validate:external-data`: retains local raw-data errors (`chance="NaN"` and one undefined relic name); no source files were overwritten.
- Browser validation confirmed real-file preview, source-section and Riven review, unresolved acknowledgement, backup-first import action, persistence after a new page load, and populated Inventory, Mods, and Arcanes views. Import search behavior, validation-error handling, viewport resizing, and backup restoration were not verified in this run.

## Release status

The importer preserves unmatched source identities in the user-visible report and refuses to disguise category ambiguity as a catalog match. It supports importing the verified subset only after explicit acknowledgement. Because 73 identities are unresolved and viewport/restore verification is incomplete, PR #6 remains a draft and must not be merged or deployed.

Import and reconciliation are deterministic and preserve local-only records. Backup restoration uses the existing Progress Pack import flow; end-to-end restore still needs browser verification before release.
