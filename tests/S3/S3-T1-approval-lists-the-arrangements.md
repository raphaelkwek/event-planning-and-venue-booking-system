# S3-T1 — The approval lists every arrangement and the registration count

## Specification

| Item | Content |
|---|---|
| Test Case ID | S3-T1 |
| Test Scenario | Approving a change to the date returns, in `impact`, the confirmed bookings B1 and B2, the reservation R1 and the active registration count |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `venue/0019` and `equipment/0009`), using the isolated setup in `tests/S3/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-S3 from `tests/S3/README.md` is loaded. Specific set-up: CR proposes `proposedStartAt` `D 15:00` (event E moves from `D 14:00`–`D 18:00` to `D 15:00`–`D 18:00`), nothing else. |
| Test Steps | 1. As C, send `POST /api/v1/change-requests/<CR>/decision` with `{"decision":"APPROVE"}`, noting the HTTP status and the body.<br>2. Read `impact` in the body.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/change/api/s3Cards.test.ts -t 'S3-T1 '` (or the whole suite) and read the named `S3-T1 ` result. |
| Test Data | `{"decision":"APPROVE"}`; CR proposes `proposedStartAt` `D 15:00` (event E moves from `D 14:00`–`D 18:00` to `D 15:00`–`D 18:00`), nothing else. |
| Expected Result | HTTP 200. `changeRequest.status` is `APPROVED`. `impact.bookings` has exactly two entries, B1 (V1) and B2 (V2), each with its booking reference and venue name; `impact.reservations` has exactly one entry, R1, with its equipment name; `impact.activeRegistrations` is 0. |
| Created By | Raphael |
| Date of Creation | 2026-10-28 |

> **Expected results are checked by the PR reviewer** against S3's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | As C, approving CR (start moved to `D 15:00`) answered 200 with `changeRequest` CR `APPROVED`. `impact.bookings` held exactly B1 with V1's name and B2 with V2's name, each with its booking reference; `impact.reservations` held exactly one entry, R1, with its equipment type name; `impact.activeRegistrations` was 0. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: 5eb3bfd · Evidence: `backend/services/planning-core/tests/change/api/s3Cards.test.ts` › S3 cards: reconsidering the arrangements an approved change affects › S3-T1 approval lists every booking, reservation and the registration count, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41767254259 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
