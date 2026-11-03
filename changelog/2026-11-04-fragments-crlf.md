# Read changelog fragments and traceability CSVs with Windows line endings

**Timestamp:** 2026-11-04T01:36+08:00 (SGT)
**Author:** Joash
**Reason:** On a Windows checkout with `core.autocrlf=true` the working tree has CRLF, and the
changelog parser's field patterns then missed every `**Timestamp:**` and `**Author:**`: the
fragment unit test failed locally ("has no readable **Timestamp:**"), and `npm run changelog`'s
readers (`confluence:digest`, `submission:build`) printed entries with no date or author. CI on
Linux checks out LF, so it passed.
**Scope:** `documentation/scripts/confluence-digest.ts` and the script tests. No service code.

## Fixed

- `readFragments` and `readCombinedChangelog` read `changelog/*.md` and `CHANGELOG.md` as LF
  text, so the combined log parses the same on Windows and Linux and is always printed with LF.
- Tests: a CRLF fragment, a CRLF `CHANGELOG.md` with CRLF fragments, and CRLF per-story
  traceability files. The CSV readers (the EN-22 generator, its layout check and
  `submission:build`) already treated CRLF as a line break; the new test pins that.
- Checked on this Windows machine: on a fresh CRLF checkout of main, the fragment test failed
  for all four fragments and `confluence:digest` showed no dates or authors; with this change the
  script tests pass on a CRLF checkout.
