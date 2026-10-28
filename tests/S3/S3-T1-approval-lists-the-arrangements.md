# S3-T1 — The approval lists every arrangement and the registration count

## Specification

| Item | Content |
|---|---|
| Test Case ID | S3-T1 |
| Test Scenario | Approving a change to the date returns, in `impact`, the confirmed bookings B1 and B2, the reservation R1 and the active registration count |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `venue/0018` and `equipment/0009`), using the isolated setup in `tests/S3/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-S3 from `tests/S3/README.md` is loaded. Specific set-up: CR proposes `proposedStartAt` `D 15:00` (event E moves from `D 14:00`–`D 18:00` to `D 15:00`–`D 18:00`), nothing else. |
| Test Steps | 1. As C, send `POST /api/v1/change-requests/<CR>/decision` with `{"decision":"APPROVE"}`, noting the HTTP status and the body.<br>2. Read `impact` in the body.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/change/api/s3Cards.test.ts -t 'S3-T1 '` (or the whole suite) and read the named `S3-T1 ` result. |
| Test Data | `{"decision":"APPROVE"}`; CR proposes `proposedStartAt` `D 15:00` (event E moves from `D 14:00`–`D 18:00` to `D 15:00`–`D 18:00`), nothing else. |
| Expected Result | HTTP 200. `changeRequest.status` is `APPROVED`. `impact.bookings` has exactly two entries, B1 (V1) and B2 (V2), each with its booking reference and venue name; `impact.reservations` has exactly one entry, R1, with its equipment name; `impact.activeRegistrations` is 0. |
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
