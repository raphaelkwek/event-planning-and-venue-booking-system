# S3-T4 — Attendance above the booked layout's capacity makes the booking Unsuitable

## Specification

| Item | Content |
|---|---|
| Test Case ID | S3-T4 |
| Test Scenario | With expected attendance 150, B1 (Theatre, capacity 100) is `UNSUITABLE` and the reason names 150 and 100 |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `venue/0018` and `equipment/0009`), using the isolated setup in `tests/S3/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-S3 from `tests/S3/README.md` is loaded. Specific set-up: CR proposes `expectedAttendance` 150 (E has 80), nothing else. |
| Test Steps | 1. As C, send `POST /api/v1/change-requests/<CR>/decision` with `{"decision":"APPROVE"}`.<br>2. As C, send `GET /api/v1/events/<E>/arrangement-flags`.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/change/api/s3Cards.test.ts -t 'S3-T4 '` (or the whole suite) and read the named `S3-T4 ` result. |
| Test Data | `{"decision":"APPROVE"}`; CR proposes `expectedAttendance` 150 (E has 80), nothing else. V1 is named `Venue One` in the fixture. |
| Expected Result | Step 1 answers HTTP 200 and `impact.flags` includes B1 with flag `UNSUITABLE`. Step 2 answers HTTP 200 and lists B1 with flag `UNSUITABLE` and the reason `Expected attendance is now 150, but Venue One holds 100 in the Theatre layout.` B1 is still CONFIRMED and its period unchanged. No period flag exists, since the dates did not change. R1 carries no flag. |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-28 |

> **Expected results are checked by the PR reviewer** against S3's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Waits for the S3 implementation and migrations venue/0018 and equipment/0009. Commit: · Evidence: · Defect: — |
| Executed By | |
| Date of Execution | |
