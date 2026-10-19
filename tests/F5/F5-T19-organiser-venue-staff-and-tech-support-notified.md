# F5-T19 — On success the owning organiser, the Venue Staff of each booked venue and the Technical Support Staff who reserved are notified

## Specification

| Item | Content |
|---|---|
| Test Case ID | F5-T19 |
| Test Scenario | On success the owning organiser, the Venue Staff of each booked venue and the Technical Support Staff who reserved are notified |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/F5/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-F5 from `tests/F5/README.md`: event E1 (Approved, owned by ORG, assigned to C1, `D 14:00`–`D 18:00` UTC, equipment required), booking B1 (Confirmed, V1 `F5 Hall`, looked after by VS) and line L1 (`F5 Chairs` × 5, reserved 5 of 5 by TS), plus a second CONFIRMED booking B2 at V2 `F5 Breakout Room` (looked after by VS2). |
| Test Steps | 1. As C1, send `POST /api/v1/events/<E1>/confirmation` with no body.<br>2. Pass the `event.arrangements-confirmed` message in E1's outbox through the notification service's recipient rule (`notificationsFor`).<br>3. Run `npm test -w @connectsphere/planning-core -- tests/change/api/f5Cards.test.ts -t 'F5-T19 '` and read the named `F5-T19 ` result. |
| Test Data | No body. |
| Expected Result | Exactly one `event.arrangements-confirmed` message on `connectsphere.event.v1`, keyed by E1. It notifies ORG once (the event is in Safety Review), VS once (naming B1 and F5 Hall), VS2 once (naming B2 and F5 Breakout Room) and TS once (naming F5 Chairs × 5). Nobody else is notified: not C2, not ATT. |
| Created By | Shawmya, via Claude |
| Date of Creation | 2026-10-20 |

> **Expected results are checked by the story owner** against F5's acceptance criteria before the code
> is written (implementation.md §11.12).

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
