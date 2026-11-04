# S3-T11 — A failure while flagging rolls back the change, the decision and every flag

## Specification

| Item | Content |
|---|---|
| Test Case ID | S3-T11 |
| Test Scenario | With the flag writer forced to throw, the approval fails and the request is still Pending, E is unchanged and nothing is flagged. This is an automated-only case |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `venue/0019` and `equipment/0009`), using the isolated setup in `tests/S3/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-S3 from `tests/S3/README.md` is loaded. Specific set-up: CR proposes `proposedStartAt` `D 15:00` (event E moves from `D 14:00`–`D 18:00` to `D 15:00`–`D 18:00`), nothing else. |
| Test Steps | 1. In the automated test, make the flag writer throw (for example by stubbing the venue module's flag function to reject).<br>2. As C, send `POST /api/v1/change-requests/<CR>/decision` with `{"decision":"APPROVE"}`, noting the HTTP status.<br>3. Read CR, E, B1, B2 and R1 and the outbox.<br>4. Run `npm test -w @connectsphere/planning-core -- tests/change/api/s3Cards.test.ts -t 'S3-T11 '` and read the named `S3-T11 ` result. |
| Test Data | `{"decision":"APPROVE"}`; CR proposes `proposedStartAt` `D 15:00` (event E moves from `D 14:00`–`D 18:00` to `D 15:00`–`D 18:00`), nothing else. Automated only: the failure is injected in the test, which cannot be reproduced by hand. |
| Expected Result | Step 2 answers a 5xx (HTTP 500). Then CR is still `PENDING` with no decision, decider or timestamp; E's start is still `D 14:00`, its version and history are unchanged and its status is as before; B1, B2 and R1 carry no flag and no flag rows exist; the outbox has neither `change-request.approved` nor `change-request.arrangements-flagged`. |
| Created By | Raphael |
| Date of Creation | 2026-10-28 |

> **Expected results are checked by the PR reviewer** against S3's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | With the venue flag writer forced to throw after writing, the approval answered 500. CR was still `PENDING` with no decider or decision time; E's status, version and start (`D 14:00`) were as before, with no FIELD_CHANGE or STATUS_CHANGE entry and no `event.status-changed` message; B1, B2 and R1 carried no flag, no flag rows existed, and the outbox had neither `change-request.approved` nor `change-request.arrangements-flagged`. With the writer working again the same approval answered 200. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: 5eb3bfd · Evidence: `backend/services/planning-core/tests/change/api/s3Cards.test.ts` › S3 cards: reconsidering the arrangements an approved change affects › S3-T11 a failure while flagging rolls back the change, the decision and every flag, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41767254259 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
