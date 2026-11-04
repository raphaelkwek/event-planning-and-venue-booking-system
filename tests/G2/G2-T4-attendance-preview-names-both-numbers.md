# G2-T4 — Attendance above a booked layout's capacity previews Unsuitable, naming both numbers

## Specification

| Item | Content |
|---|---|
| Test Case ID | G2-T4 |
| Test Scenario | Previewing expected attendance 150 names B1 (Theatre, 100) `UNSUITABLE` with 150 and 100, and does not flag B2 (Hall, 200) or R1 |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `venue/0019` and `equipment/0009`), using the isolated setup in `tests/G2/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-G2 from `tests/G2/README.md` is loaded. Specific set-up: CR proposes `expectedAttendance` 150 (E has 80), nothing else. |
| Test Steps | 1. As C, send `GET /api/v1/change-requests/<CR>/impact`.<br>2. Read `impact.flags`.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/change/api/g2Cards.test.ts -t 'G2-T4 '` (or the whole suite) and read the named `G2-T4 ` result. |
| Test Data | CR proposes `expectedAttendance` 150, nothing else. V1 is named `Venue One` in the fixture (the automated test appends a unique suffix to the venue's name, and the reason quotes the full name). |
| Expected Result | HTTP 200. `impact.flags` has exactly one entry: B1 (`arrangement` `BOOKING`, its reference, name `Venue One`) with flag `UNSUITABLE` and the reason `Expected attendance is now 150, but Venue One holds 100 in the Theatre layout.` B2, whose Hall layout holds 200, carries no flag, R1 carries no flag, and there is no period flag, since the dates did not change. `impact.bookings` still lists both B1 and B2. |
| Created By | Raphael |
| Date of Creation | 2026-10-29 |

> **Expected results are checked by the PR reviewer** against G2's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | The preview answered 200 with exactly one `impact.flags` entry: B1 (`BOOKING`, its reference, V1's name) `UNSUITABLE` with `Expected attendance is now 150, but <V1's name> holds 100 in the Theatre layout.`, so no flag on B2 or R1 and no period flag. `impact.bookings` listed B1 and B2. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: 5eb3bfd · Evidence: `backend/services/planning-core/tests/change/api/g2Cards.test.ts` › G2 cards: previewing the arrangements a pending change would affect › G2-T4 attendance 150 previews only the 100-seat booking as Unsuitable, naming both numbers, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41767254259 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
