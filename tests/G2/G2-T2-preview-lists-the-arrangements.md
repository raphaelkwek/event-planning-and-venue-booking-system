# G2-T2 — A pending change's preview lists every arrangement and the registration count

## Specification

| Item | Content |
|---|---|
| Test Case ID | G2-T2 |
| Test Scenario | Previewing a pending date change returns, in `impact`, the confirmed bookings B1 and B2, the reservation R1 and the active registration count |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `venue/0018` and `equipment/0009`), using the isolated setup in `tests/G2/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-G2 from `tests/G2/README.md` is loaded. Specific set-up: CR proposes `proposedStartAt` `D 15:00` (event E would move from `D 14:00`–`D 18:00` to `D 15:00`–`D 18:00`), nothing else. |
| Test Steps | 1. As C, send `GET /api/v1/change-requests/<CR>/impact`, noting the HTTP status and the body.<br>2. Read `impact` in the body.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/change/api/g2Cards.test.ts -t 'G2-T2 '` (or the whole suite) and read the named `G2-T2 ` result. |
| Test Data | CR proposes `proposedStartAt` `D 15:00`, nothing else. |
| Expected Result | HTTP 200. `impact.bookings` has exactly two entries, B1 (V1, `Venue One`) and B2 (V2, `Venue Two`), each with `arrangement` `BOOKING`, its booking reference, venue name and booked period (`D 14:00`–`D 18:00`); `impact.reservations` has exactly one entry, R1, with its equipment name, reserved quantity and period; `impact.activeRegistrations` is 0. CR is still `PENDING`. |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-29 |

> **Expected results are checked by the PR reviewer** against G2's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Waits for the G2 implementation. Commit: · Evidence: · Defect: — |
| Executed By | |
| Date of Execution | |
