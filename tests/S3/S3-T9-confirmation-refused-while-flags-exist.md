# S3-T9 — Confirmation is refused while flags exist and the refusal names them

## Specification

| Item | Content |
|---|---|
| Test Case ID | S3-T9 |
| Test Scenario | F5 confirmation of E is refused, listing each outstanding flag, and changes nothing |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `venue/0018` and `equipment/0009`), using the isolated setup in `tests/S3/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-S3 from `tests/S3/README.md` is loaded. A change of both `proposedStartAt` (`D 15:00`) and `expectedAttendance` (150) has been approved, so B1 carries REQUIRES_RECONFIRMATION and UNSUITABLE, B2 REQUIRES_RECONFIRMATION and R1 FLAGGED_FOR_REVIEW; E is in Planning. |
| Test Steps | 1. As C, send `POST /api/v1/events/<E>/confirmation`.<br>2. As C, send `GET /api/v1/events/<E>` and read the status, then read B1, B2 and R1.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/change/api/s3Cards.test.ts -t 'S3-T9 '` (or the whole suite) and read the named `S3-T9 ` result. |
| Test Data | No body, as in F5's cards. The change: `proposedStartAt` `D 15:00` and `expectedAttendance` 150. |
| Expected Result | Step 1 answers HTTP 422 `ARRANGEMENTS_NOT_READY`, whose message and `details.flags` name B1 (`Requires Reconfirmation` and `Unsuitable`), B2 (`Requires Reconfirmation`) and R1 (`Flagged for review`), each with its reference and venue or equipment name. In step 2 E is still `PLANNING` and no booking, reservation or flag changed. |
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
