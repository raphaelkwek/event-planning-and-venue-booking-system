# E3-T9 — Every active Event Coordinator Lead is told when a submitted request enters the unassigned queue

## Specification

| Item | Content |
|---|---|
| Test Case ID | E3-T9 |
| Test Scenario | Every active Event Coordinator Lead is told when a submitted request enters the unassigned queue (team decision D-02, `documentation/clarifications.md`) |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (`npm run migrate:all`, with the CI seed). Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Users in `identity.users` with their roles: ORG (`EVENT_ORGANISER`, active), LEAD (`EVENT_COORDINATOR_LEAD`, active), RETIRED_LEAD (`EVENT_COORDINATOR_LEAD`, deactivated), COORDINATOR (`EVENT_COORDINATOR`, active). |
| Test Steps | 1. As ORG, send `POST /api/v1/events` with a complete request (name, purpose, description, a future start and end, expected attendance 150).<br>2. Read the `event.submitted` message in the event's outbox (`select envelope from event.outbox where message_key = '<id>' and envelope->>'type' = 'event.submitted'`).<br>3. Pass the stored message through the notification service's recipient rule (`notificationsFor`).<br>4. Run `npm test -w @connectsphere/planning-core -- tests/event/api/leadAssignment.test.ts -t 'E3-T9 '` and read the named `E3-T9 ` result. |
| Test Data | The request of step 1. |
| Expected Result | One `event.submitted` message, keyed by the new event, whose `leadIds` include LEAD and not RETIRED_LEAD. The recipient rule notifies each Lead it names once, with "Event request `<reference>` “Annual Research Symposium” was submitted and is waiting in your unassigned queue to be assigned a coordinator.", and nobody else: not ORG, not RETIRED_LEAD, not COORDINATOR. |
| Created By | Joash |
| Date of Creation | 2026-11-04 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | As ORG the test submitted a complete request through `POST /api/v1/events` against the real Express app and a migrated Postgres (authentication stubbed). Exactly one `event.submitted` message was written, keyed by the event; its `leadIds` held LEAD and not RETIRED_LEAD. The notification service's rule told each named Lead once, LEAD with "Event request `<reference>` “Annual Research Symposium” was submitted and is waiting in your unassigned queue to be assigned a coordinator.", and told neither ORG, RETIRED_LEAD nor COORDINATOR. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: 7e9382df295b20e20ea0368e82b5bfc84057e36b · Evidence: backend/services/planning-core/tests/event/api/leadAssignment.test.ts › E3-T9 names every active Lead in the submission's message, and the rule tells each of them and nobody else, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41791224022 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
