# S3-T6 — An event that is not Confirmed keeps its status

## Specification

| Item | Content |
|---|---|
| Test Case ID | S3-T6 |
| Test Scenario | With E in Planning, flagging leaves E in Planning (and in Safety Review too, in a second run) |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `venue/0018` and `equipment/0009`), using the isolated setup in `tests/S3/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-S3 from `tests/S3/README.md` is loaded. Specific set-up: CR proposes `proposedStartAt` `D 15:00` (event E moves from `D 14:00`–`D 18:00` to `D 15:00`–`D 18:00`), nothing else; E is in status Planning. |
| Test Steps | 1. As C, send `POST /api/v1/change-requests/<CR>/decision` with `{"decision":"APPROVE"}`.<br>2. As C, send `GET /api/v1/events/<E>` and read the status and history.<br>3. Repeat steps 1 and 2 on a fresh FX-S3 whose E is in Safety Review.<br>4. Run `npm test -w @connectsphere/planning-core -- tests/change/api/s3Cards.test.ts -t 'S3-T6 '` (or the whole suite) and read the named `S3-T6 ` result. |
| Test Data | `{"decision":"APPROVE"}`; CR proposes `proposedStartAt` `D 15:00` (event E moves from `D 14:00`–`D 18:00` to `D 15:00`–`D 18:00`), nothing else. |
| Expected Result | Both runs answer HTTP 200 with B1, B2 and R1 flagged. In step 2 E's status is still `PLANNING`, and its history has no status-change entry, only the `proposedStartAt` FIELD_CHANGE. In step 3 E's status is still `SAFETY_REVIEW`, with no status-change entry. |
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
