# F5-T19 — On success the owning organiser, the Venue Staff of each booked venue and the Technical Support Staff who reserved are notified

## Specification

| Item | Content |
|---|---|
| Test Case ID | F5-T19 |
| Test Scenario | On success the owning organiser, the Venue Staff of each booked venue and the Technical Support Staff who reserved are notified |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/F5/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-F5 from `tests/F5/README.md`: event E1 (Approved, owned by ORG, assigned to C1, `D 14:00`–`D 18:00` UTC, equipment required), booking B1 (Confirmed, V1 `F5 Hall`, looked after by VS) and line L1 (`F5 Chairs` × 5, reserved 5 of 5 by TS), plus a second CONFIRMED booking B2 at V2 `F5 Breakout Room` (looked after by VS2). |
| Test Steps | 1. As C1, send `POST /api/v1/events/<E1>/confirmation` with no body.<br>2. Pass the `event.arrangements-confirmed` message in E1's outbox through the notification service's recipient rule (`notificationsFor`).<br>3. Run `npm test -w @connectsphere/planning-core -- tests/change/api/f5Cards.test.ts -t 'F5-T19 '` and read the named `F5-T19 ` result. |
| Test Data | No body. |
| Expected Result | Exactly one `event.arrangements-confirmed` message on `connectsphere.event.v1`, keyed by E1. It notifies ORG once (the event is in Safety Review), VS once (naming B1 and F5 Hall), VS2 once (naming B2 and F5 Breakout Room) and TS once (naming F5 Chairs × 5). Nobody else is notified: not C2, not ATT. Since team decision D-02 (4 Nov 2026) the message also names every active Safety Officer, who is told too; U1-T17 checks that, and this card sets them aside. |
| Created By | Shawmya, via Claude |
| Date of Creation | 2026-10-20 |

> **Expected results are checked by the story owner** against F5's acceptance criteria before the code
> is written (implementation.md §11.12).

## Execution record

| Item | Content |
|---|---|
| Actual Result | With B1 at V1 and B2 at V2 confirmed, C1's confirmation answered 200 and E1's outbox held exactly one event.arrangements-confirmed message, on connectsphere.event.v1, keyed by E1 and with subject E1 (it parsed as a CloudEvent). Passed through the notification service's recipient rule (notificationsFor), and setting aside the active Safety Officers the message also names since team decision D-02 (U1-T17 checks those), it gave exactly four notifications, one each: ORG, whose text contained "Safety Review"; VS, naming B1's reference and F5 Hall; VS2, naming B2's reference and F5 Breakout Room; TS, naming "F5 Chairs × 5". C2 and ATT got none. The notification service's unit tests asserted the full wording of each: the owner is told "... has its venue and equipment arrangements confirmed. It is now in Safety Review, awaiting the Safety Officer.", each venue's staff the booking, venue, date and times, each reserver only the equipment they reserved, and each recipient exactly once. The message went through the recipient rule in the test, in place of Kafka delivery. |
| Status | Pass |
| Remarks | Automated (API level; unit test) · Commit: c0f7183 · Evidence: `backend/services/planning-core/tests/change/api/f5Cards.test.ts` › F5 cards (tests/F5) › F5-T19 the organiser, each booked venue's staff and the reserver are each notified once; `backend/services/notification/tests/domain/recipients.test.ts` › F5: tells the owner, each booked venue's staff and each reserver that the arrangements are confirmed › notifies exactly the owner, each venue's staff and each reserver, once each; `backend/services/notification/tests/domain/recipients.test.ts` › F5: tells the owner, each booked venue's staff and each reserver that the arrangements are confirmed › tells the owner the event is in Safety Review, not Confirmed; `backend/services/notification/tests/domain/recipients.test.ts` › F5: tells the owner, each booked venue's staff and each reserver that the arrangements are confirmed › tells each Venue Staff member which booking at their venue, and when; `backend/services/notification/tests/domain/recipients.test.ts` › F5: tells the owner, each booked venue's staff and each reserver that the arrangements are confirmed › tells each reserver the equipment they reserved, and only theirs, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41798410254 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
