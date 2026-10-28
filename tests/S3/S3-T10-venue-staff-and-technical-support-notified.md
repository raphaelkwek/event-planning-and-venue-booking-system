# S3-T10 — One message is written and the right staff each get a notice

## Specification

| Item | Content |
|---|---|
| Test Case ID | S3-T10 |
| Test Scenario | Approval writes one `change-request.arrangements-flagged` message; Venue Staff of B1 and B2 and the member who reserved R1 are notified |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `venue/0018` and `equipment/0009`), using the isolated setup in `tests/S3/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-S3 from `tests/S3/README.md` is loaded. Specific set-up: CR proposes `proposedStartAt` `D 15:00` (event E moves from `D 14:00`–`D 18:00` to `D 15:00`–`D 18:00`), nothing else; The notification service is running against the same database and broker, or the outbox is read directly (the automated test reads the outbox and passes the stored message through the notification service's recipient rule, `notificationsFor`). |
| Test Steps | 1. As C, send `POST /api/v1/change-requests/<CR>/decision` with `{"decision":"APPROVE"}`.<br>2. Read the outbox for messages of type `change-request.arrangements-flagged` for E.<br>3. Read the notifications of VS and of T (`techsupport@connectsphere.test`).<br>4. Repeat with a fresh FX-S3 and a CR whose change flags nothing (S3-T12) and read the outbox again.<br>5. Run `npm test -w @connectsphere/planning-core -- tests/change/api/s3Cards.test.ts -t 'S3-T10 '` (or the whole suite) and read the named `S3-T10 ` result. |
| Test Data | VS `venuestaff@connectsphere.test` is the Venue Staff of V1 and V2. T `techsupport@connectsphere.test` reserved R1. |
| Expected Result | Step 1 answers HTTP 200. Step 2 finds exactly one `change-request.arrangements-flagged` message on the event topic, whose payload lists B1 and B2 with their venues' staff ids (VS) and R1 with `reservedBy` T, and the flag for each. Step 3 shows VS with a notice for each of B1 and B2 and T with a notice for R1, each naming the event, the arrangement and the reason. In step 4 no `change-request.arrangements-flagged` message is written. |
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
