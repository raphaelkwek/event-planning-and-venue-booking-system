# Docs: test cards use §8.4's four statuses, and traceability rows point at tests that exist

**Timestamp:** 2026-11-03T04:10+08:00 (SGT)
**Author:** Joash
**Scope:** `tests/*/` cards, `documentation/traceability/sprint-1.csv` to `sprint-4.csv`,
`documentation/scripts/`. No application code.

## Changed

- 127 test cards (F2, J1, J2, K1, L6, O1, O2, Q1, Q2, S1, S2) had a Status such as
  `Pass (automated, API level)`. implementation.md §8.4 allows `Pass`, `Fail`, `Not Executed` and
  `Blocked` only, so Status is now `Pass` and the qualifier leads Remarks, for example
  `Automated (API level) · Commit: …`. Nothing else in those cards changed.
- 21 traceability rows named a test title that no longer exists. Six E1 rows and nine E2 rows
  lost their tests when E3 (43cd4b5) and E4 (dde7534) replaced automatic assignment and retired
  peer reassignment proposals: seven now point at the E3 or E4 test that covers the criterion, and
  eight carry the marker `SUPERSEDED by E3 (CR-05)` or `SUPERSEDED by E4 (W9-FX-5)` in place of a
  test name. Six rows had a cut-short or reworded title, or an unquoted comma that split the row
  into five fields.
- After main's EN-10 to EN-23, U1 and R1 to R4 rows and cards came in, both checks were run again.
  Every card main added already had one of the four statuses, so none changed. 26 traceability
  rows were flagged and repaired the same way:
  - F1's CR-06 row and EN-13's T6 row name the titles their tests had before U1 and R2 reworded
    them; they now name the current titles.
  - 17 rows (EN-10 7, EN-16 3, EN-17 6, U1 1) named a CI job, a script, a promtool or Cerbos file,
    which the checker cannot open as a test. They point at the card that describes the check, with
    the card's heading as the name; EN-17's four T8 rows for the four promtool files became one.
  - 4 EN-14 rows (the stack, the tag check, the report settings, axe) point at their cards the same
    way, and the stack row is now one row each for T1 and T8.
  - 3 EN-14 rows (fake auth, GoTrue endpoints, visual snapshots) now name each test in
    `fake-supabase-auth.test.ts` and `visual.spec.ts` one by one.
  - F1's row keeps its criterion text, which still says the Safety Officer's approval moves an
    event to Confirmed. Since W9-31 the coordinator marks it Confirmed after the approval.

## Added

- `documentation/scripts/normalise-card-status.ts` makes the card change and checks it
  (`--check`), keeping each file's line endings.
- `documentation/scripts/repoint-traceability-rows.ts` holds the 21 row repairs; it refuses a line
  that is not as the audit found it.
- `documentation/scripts/check-traceability.ts` fails when a traceability row has the wrong number
  of fields or names a test that is not in its file. It runs in `npm run test:scripts`, as do the
  other two scripts' tests.

## Known gap

- Some cards still cite evidence that cannot be checked today. They are listed in the pull request
  under "needs the owner's re-run" and were not rewritten.
