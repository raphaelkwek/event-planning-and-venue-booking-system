# U1-T17 — Every active Safety Officer is told when an event enters Safety Review

## Specification

| Item | Content |
|---|---|
| Test Case ID | U1-T17 |
| Test Scenario | Every active Safety Officer is told when an event's arrangements are confirmed and it enters Safety Review (team decision D-02, `documentation/clarifications.md`) |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (`npm run migrate:all`, with the CI seed). Authentication is stubbed: the signed-in user is whichever actor a step names.<br>2. Fixture FX-U1 from `tests/U1/README.md`, with E1 in status Approved instead of Safety Review: confirmed booking B1 at `U1 Hall` and reservation R1 (`U1 Chairs` × 5), so E1's arrangements are complete.<br>3. Users in `identity.users` with their roles: SO (`SAFETY_OFFICER`, active) and RETIRED_SO (`SAFETY_OFFICER`, deactivated). |
| Test Steps | 1. As C1, send `POST /api/v1/events/<E1>/confirmation` with no body.<br>2. Read the `event.arrangements-confirmed` message in E1's outbox with the queries in `tests/U1/README.md`.<br>3. Pass the stored message through the notification service's recipient rule (`notificationsFor`).<br>4. Run `npm test -w @connectsphere/planning-core -- tests/change/api/u1Cards.test.ts -t 'U1-T17 '` and read the named `U1-T17 ` result. |
| Test Data | No body. |
| Expected Result | HTTP 200 and E1 is in Safety Review. The one `event.arrangements-confirmed` message names SO in `safetyOfficerIds` and not RETIRED_SO. The recipient rule tells SO once, with "`<reference>` “U1 fixture event” has its venue and equipment arrangements confirmed and is waiting in your Safety Review queue.", and RETIRED_SO nothing. The organiser, the venue's staff and the reserver are still told as F5 says (F5-T19). |
| Created By | Joash |
| Date of Creation | 2026-11-04 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
