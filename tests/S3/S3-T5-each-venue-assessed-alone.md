# S3-T5 — Each booking is assessed on its own capacity

## Specification

| Item | Content |
|---|---|
| Test Case ID | S3-T5 |
| Test Scenario | With expected attendance 150, only B1 is flagged; B2 (Hall, capacity 200) is not |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `venue/0019` and `equipment/0009`), using the isolated setup in `tests/S3/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-S3 from `tests/S3/README.md` is loaded. Specific set-up: CR proposes `expectedAttendance` 150 (E has 80), nothing else. |
| Test Steps | 1. As C, send `POST /api/v1/change-requests/<CR>/decision` with `{"decision":"APPROVE"}`.<br>2. As C, send `GET /api/v1/events/<E>/arrangement-flags`.<br>3. Read B2's status through the venue module.<br>4. Run `npm test -w @connectsphere/planning-core -- tests/change/api/s3Cards.test.ts -t 'S3-T5 '` (or the whole suite) and read the named `S3-T5 ` result. |
| Test Data | `{"decision":"APPROVE"}`; CR proposes `expectedAttendance` 150 (E has 80), nothing else. |
| Expected Result | Step 1 answers HTTP 200. Step 2 lists exactly one flag, for B1, `UNSUITABLE`; B2 and R1 have none. In step 3, B2 is CONFIRMED with no flag. `impact.bookings` still lists both B1 and B2 (AC1 lists every booking, flagged or not). |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-28 |

> **Expected results are checked by the PR reviewer** against S3's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Waits for the S3 implementation and migrations venue/0019 and equipment/0009. Commit: · Evidence: · Defect: — |
| Executed By | |
| Date of Execution | |
