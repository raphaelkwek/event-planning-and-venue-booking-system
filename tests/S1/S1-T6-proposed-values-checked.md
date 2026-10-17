# S1-T6 — Proposed values are checked as the event would be after the change

## Specification

| Item | Content |
|---|---|
| Test Case ID | S1-T6 |
| Test Scenario | Each invalid proposed value is refused on the field it affects, every failing field is named, and nothing is stored |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `change/0001`), using the isolated setup in `tests/S1/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-S1 from `tests/S1/README.md` is loaded: event E1 (Approved, owned by ORG, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC, expected attendance 150, equipment not required, venue and equipment requirements null) and the actors ORG, ORG2, C1, TS and VS. |
| Test Steps | 1. As ORG, send `POST /api/v1/events/<E1>/change-requests` with each body in Test Data in turn, (a) to (f).<br>2. Count the rows in `change.change_requests` for E1.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/change/api/s1Cards.test.ts -t 'S1-T6 '` (or the whole suite) and read the named `S1-T6 ` result. |
| Test Data | Each with `"reason":"x"` and these changes: (a) `{"proposedStartAt":"<now minus 1 day>"}`; (b) `{"proposedEndAt":"D 13:00"}`; (c) `{"proposedStartAt":"D 19:00"}`; (d) `{"expectedAttendance":0}`; (e) `{"expectedAttendance":2.5}`; (f) `{"proposedStartAt":"<now minus 1 day>","expectedAttendance":0}` |
| Expected Result | HTTP 400 `VALIDATION_FAILED` for each. The field named is: (a) `proposedStartAt`; (b) `proposedEndAt` (the end is before the current start `D 14:00`); (c) `proposedEndAt` (the new start is after the current end `D 18:00`); (d) `expectedAttendance`; (e) `expectedAttendance`; (f) both `proposedStartAt` and `expectedAttendance`. There are no `change.change_requests` rows for E1. |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-17 |

> **Expected results are checked by the PR reviewer** against S1's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | The automated test performed this card's steps against the real Express app and a migrated Postgres (authentication stubbed) and its assertions passed; they check the expected result above. |
| Status | Pass (automated, API level) |
| Remarks | Commit: 814b6695b826bc05114f1f5360f3d5739d3ad5e9 · Evidence: backend/services/planning-core/tests/change/api/s1Cards.test.ts › S1-T6, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/39051697005 · Defect: — |
| Executed By | Raphael, via automated testing (CI) |
| Date of Execution | 2026-10-18 |
