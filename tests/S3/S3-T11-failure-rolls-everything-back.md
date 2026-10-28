# S3-T11 — A failure while flagging rolls back the change, the decision and every flag

## Specification

| Item | Content |
|---|---|
| Test Case ID | S3-T11 |
| Test Scenario | With the flag writer forced to throw, the approval fails and the request is still Pending, E is unchanged and nothing is flagged. This is an automated-only case |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `venue/0018` and `equipment/0009`), using the isolated setup in `tests/S3/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-S3 from `tests/S3/README.md` is loaded. Specific set-up: CR proposes `proposedStartAt` `D 15:00` (event E moves from `D 14:00`–`D 18:00` to `D 15:00`–`D 18:00`), nothing else. |
| Test Steps | 1. In the automated test, make the flag writer throw (for example by stubbing the venue module's flag function to reject).<br>2. As C, send `POST /api/v1/change-requests/<CR>/decision` with `{"decision":"APPROVE"}`, noting the HTTP status.<br>3. Read CR, E, B1, B2 and R1 and the outbox.<br>4. Run `npm test -w @connectsphere/planning-core -- tests/change/api/s3Cards.test.ts -t 'S3-T11 '` and read the named `S3-T11 ` result. |
| Test Data | `{"decision":"APPROVE"}`; CR proposes `proposedStartAt` `D 15:00` (event E moves from `D 14:00`–`D 18:00` to `D 15:00`–`D 18:00`), nothing else. Automated only: the failure is injected in the test, which cannot be reproduced by hand. |
| Expected Result | Step 2 answers a 5xx (HTTP 500). Then CR is still `PENDING` with no decision, decider or timestamp; E's start is still `D 14:00`, its version and history are unchanged and its status is as before; B1, B2 and R1 carry no flag and no flag rows exist; the outbox has neither `change-request.approved` nor `change-request.arrangements-flagged`. |
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
