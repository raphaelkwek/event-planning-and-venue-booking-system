# S3-T12 — A descriptive-only change lists the arrangements and flags none

## Specification

| Item | Content |
|---|---|
| Test Case ID | S3-T12 |
| Test Scenario | Approving a change to the venue requirements text lists B1, B2 and R1 and sets no flag |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `venue/0018` and `equipment/0009`), using the isolated setup in `tests/S3/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-S3 from `tests/S3/README.md` is loaded. Specific set-up: CR proposes only `venueRequirements` `{"notes":"Stage with a lectern"}`; start, end and attendance are unchanged. |
| Test Steps | 1. As C, send `POST /api/v1/change-requests/<CR>/decision` with `{"decision":"APPROVE"}`.<br>2. As C, send `GET /api/v1/events/<E>/arrangement-flags`.<br>3. Send `GET /api/v1/events/<E>` and read the status.<br>4. Run `npm test -w @connectsphere/planning-core -- tests/change/api/s3Cards.test.ts -t 'S3-T12 '` (or the whole suite) and read the named `S3-T12 ` result. |
| Test Data | `{"decision":"APPROVE"}`; the change above. |
| Expected Result | Step 1 answers HTTP 200: `impact.bookings` lists B1 and B2, `impact.reservations` lists R1, `impact.activeRegistrations` is 0 and `impact.flags` is empty. Step 2 answers HTTP 200 with an empty list. In step 3 E's status is unchanged, and no `change-request.arrangements-flagged` message is written. |
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
