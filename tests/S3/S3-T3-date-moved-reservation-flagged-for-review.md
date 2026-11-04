# S3-T3 — A moved date flags the equipment reservation for review and releases nothing

## Specification

| Item | Content |
|---|---|
| Test Case ID | S3-T3 |
| Test Scenario | After a date change R1 is `FLAGGED_FOR_REVIEW`, still RESERVED, with the same quantity and period |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `venue/0019` and `equipment/0009`), using the isolated setup in `tests/S3/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-S3 from `tests/S3/README.md` is loaded. Specific set-up: CR proposes `proposedStartAt` `D 15:00` (event E moves from `D 14:00`–`D 18:00` to `D 15:00`–`D 18:00`), nothing else. |
| Test Steps | 1. As C, send `POST /api/v1/change-requests/<CR>/decision` with `{"decision":"APPROVE"}`.<br>2. As C, send `GET /api/v1/events/<E>/arrangement-flags`.<br>3. Read R1 through the equipment module's reservation read (or the repository) for its status, quantity and period.<br>4. Run `npm test -w @connectsphere/planning-core -- tests/change/api/s3Cards.test.ts -t 'S3-T3 '` (or the whole suite) and read the named `S3-T3 ` result. |
| Test Data | `{"decision":"APPROVE"}`; CR proposes `proposedStartAt` `D 15:00` (event E moves from `D 14:00`–`D 18:00` to `D 15:00`–`D 18:00`), nothing else. |
| Expected Result | Step 1 answers HTTP 200. Step 2 lists, among its flags, one for R1 with flag `FLAGGED_FOR_REVIEW` and the reason `The reservation is for <old period>, but the event is now <new period>.` Both periods are written in Singapore time, where the venues are, as the implementation's `formatPeriod` does: for example `D 14:00`–`D 18:00` UTC on 2 December 2026 reads `Wednesday 2 December 2026 22:00 to Thursday 3 December 2026 02:00`, and `D 15:00`–`D 18:00` reads `Wednesday 2 December 2026 23:00 to Thursday 3 December 2026 02:00`. In step 3, R1 is still RESERVED, its quantity is unchanged and its period is still `D 14:00`–`D 18:00`. |
| Created By | Raphael |
| Date of Creation | 2026-10-28 |

> **Expected results are checked by the PR reviewer** against S3's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | The approval answered 200. `GET .../arrangement-flags` answered 200 with exactly one equipment flag: R1 (`EQUIPMENT`, its id as reference, its equipment type name) `FLAGGED_FOR_REVIEW` with the reason `The reservation is for <old period>, but the event is now <new period>.` R1 was still `RESERVED` and flagged for review, its quantity unchanged at 4 and its period still `D 14:00`–`D 18:00`. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: a406635 · Evidence: `backend/services/planning-core/tests/change/api/s3Cards.test.ts` › S3 cards: reconsidering the arrangements an approved change affects › S3-T3 a moved date flags the reservation for review and releases nothing, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41773031885 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
