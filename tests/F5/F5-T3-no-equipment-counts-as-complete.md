# F5-T3 — An event marked as requiring no equipment is complete on equipment without any line

## Specification

| Item | Content |
|---|---|
| Test Case ID | F5-T3 |
| Test Scenario | An event marked as requiring no equipment is complete on equipment without any line |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/F5/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-F5 from `tests/F5/README.md`: event E1 (Approved, owned by ORG, assigned to C1, `D 14:00`–`D 18:00` UTC, equipment required), booking B1 (Confirmed, V1 `F5 Hall`, looked after by VS) and line L1 (`F5 Chairs` × 5, reserved 5 of 5 by TS), except that E1 has `equipment_required = false` and no equipment request line (L1 is not created). |
| Test Steps | 1. As C1, send `POST /api/v1/events/<E1>/confirmation` with no body.<br>2. Read the event, latest history entry, arrangements and outbox with the queries in `tests/F5/README.md`.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/change/api/f5Cards.test.ts -t 'F5-T3 '` and read the named `F5-T3 ` result. |
| Test Data | No body. |
| Expected Result | HTTP 200; E1's status is `SAFETY_REVIEW`. |
| Created By | Shawmya, via Claude |
| Date of Creation | 2026-10-20 |

> **Expected results are checked by the story owner** against F5's acceptance criteria before the code
> is written (implementation.md §11.12).

## Execution record

| Item | Content |
|---|---|
| Actual Result | With equipment_required = false and no request line (E1 had none before the request), C1's confirmation answered 200 with event.status SAFETY_REVIEW, and E1's status read SAFETY_REVIEW. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: 5cd14bb · Evidence: `backend/services/planning-core/tests/change/api/f5Cards.test.ts` › F5 cards (tests/F5) › F5-T3 an event marked as needing no equipment is complete without any line, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41793114951 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
