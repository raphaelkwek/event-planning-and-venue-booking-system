# One file per change for the changelog and traceability, so pull requests stop conflicting

**Timestamp:** 2026-11-03T21:19+08:00 (SGT)
**Author:** Joash
**Reason:** Every pull request edited the same lines: the top of `CHANGELOG.md`, the end of
`documentation/traceability/sprint-<n>.csv`, and the end of `ERROR_CODES` and the OpenAPI
`ErrorCode` enum. Merging any one made all the others conflict, and GitHub's merge ignores
`.gitattributes merge=union`, so the fix is to stop sharing those lines.
**Scope:** `changelog/`, `CHANGELOG.md` (header only), `documentation/traceability/`,
`documentation/scripts/`, contracts' `errorCodes.ts`, the OpenAPI `ErrorCode` enums, `package.json`,
and the docs that describe the conventions. No service code, no migration, no behaviour change.

## Changed

- **Changelog entries are one file per change**, `changelog/<YYYY-MM-DD>-<branch-or-slug>.md`,
  holding exactly what a `CHANGELOG.md` entry holds; this entry is the first. `CHANGELOG.md` keeps
  every older entry unchanged, under a new note saying where newer ones live.
  `npm run changelog` prints the whole log, newest first, and `confluence:digest` and
  `submission:build` read the same combined log. A unit test fails on a fragment with no title,
  timestamp or author.
- **Traceability is one file per story**: each `sprint-<n>.csv` was split into
  `sprint-<n>/<story-id>.csv` with the same header, every row kept in its order (the old files
  rebuild byte for byte from the new ones). The EN-22 generator and `submission:build` read the new
  files; the generator refuses a `sprint-<n>.csv` that comes back, and a unit test fails on a file
  without the header or a row filed under another story. The matrix holds the same stories,
  criteria, tests and results as before; it now lists stories by sprint and then story id, and
  a test's row number is its row in the story's own file.
- **Error codes are in alphabetical order**, in `ERROR_CODES` and in the planning-core and
  registration `ErrorCode` enums, so new codes land in different places. No code was added,
  removed or renamed, and each story comment now sits on its codes' lines. A contracts unit test
  and `npm run lint:api` (`documentation/scripts/check-error-codes.ts`) check the order and that
  planning-core's enum holds exactly `ERROR_CODES`.
- implementation.md §2, §8.2, §8.3, §11 rule 8 and §11.2, the definitions of ready and done,
  CLAUDE.md, README.md and `tests/TEMPLATE.md` describe the new places.

## Known gap

- Open pull requests cut before this change still edit the old files: each needs migrating once after this merges (its entries to a fragment, its rows to story files, its codes re-sorted), then a merge of main.
