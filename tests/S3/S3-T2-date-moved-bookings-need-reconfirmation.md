# S3-T2 — A moved date sets each booking to Requires Reconfirmation and keeps its period

## Specification

| Item | Content |
|---|---|
| Test Case ID | S3-T2 |
| Test Scenario | After a date change B1 and B2 are `REQUIRES_RECONFIRMATION`, still CONFIRMED, with the same period; the venue is not released |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `venue/0018` and `equipment/0009`), using the isolated setup in `tests/S3/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-S3 from `tests/S3/README.md` is loaded. Specific set-up: CR proposes `proposedStartAt` `D 15:00` (event E moves from `D 14:00`–`D 18:00` to `D 15:00`–`D 18:00`), nothing else. |
| Test Steps | 1. As C, send `POST /api/v1/change-requests/<CR>/decision` with `{"decision":"APPROVE"}`.<br>2. As C, send `GET /api/v1/events/<E>/arrangement-flags`.<br>3. Read B1 and B2 through the venue module's booking read (or the repository) for their status and period, and check the venue's availability for `D 14:00`–`D 18:00`.<br>4. Run `npm test -w @connectsphere/planning-core -- tests/change/api/s3Cards.test.ts -t 'S3-T2 '` (or the whole suite) and read the named `S3-T2 ` result. |
| Test Data | `{"decision":"APPROVE"}`; CR proposes `proposedStartAt` `D 15:00` (event E moves from `D 14:00`–`D 18:00` to `D 15:00`–`D 18:00`), nothing else. |
| Expected Result | Step 1 answers HTTP 200 with `impact.flags` naming B1 and B2, each with flag `REQUIRES_RECONFIRMATION`. Step 2 answers HTTP 200 with exactly two flags (B1, B2), each `REQUIRES_RECONFIRMATION` with the reason `The booking is for D 14:00–D 18:00, but the event is now D 15:00–D 18:00.`. In step 3, B1 and B2 are still CONFIRMED, their period is still `D 14:00`–`D 18:00` (not moved), and the period is still unavailable at V1 and V2 (nothing released). |
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
