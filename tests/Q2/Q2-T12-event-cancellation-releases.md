# Q2-T12 — Cancelling an event releases all its reservations

## Specification

| Item | Content |
|---|---|
| Test Case ID | Q2-T12 |
| Test Scenario | F4's cancellation releases every Reserved line of the event, recording the cancelling user and F4's reason |
| Pre-conditions | 1. F4 (event cancellation) is built, and E1 has at least two Reserved lines. |
| Test Steps | 1. As the user cancelling E1, cancel E1 through F4.<br>2. Read E1's reservations and their lines.<br>3. Read CHAIRS availability for E1's window and C1's notifications. |
| Test Data | F4 cancels E1 |
| Expected Result | Every `RESERVED` reservation of E1 is `RELEASED` by the cancelling user with F4's reason. Availability is restored, and C1 is notified. |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-16 |

> **Expected results are checked by the PR reviewer** against Q2's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | Automated at API level against the real Express app and a migrated Postgres (authentication stubbed). E1 had two Reserved lines, CHAIRS × 4 (bulk) and PROJECTORS × 2 (serialized), reserved through Q1's route, leaving 6 chairs and 1 projector. The owner cancelled E1 through F4 (POST /api/v1/events/<E1>/cancellation, 200), which named both reservations as released. Both reservations were RELEASED, each with released_by the cancelling owner, release_reason "event cancelled" (F4's reason) and a release time, and kept; their bulk row and both unit rows were Released; each line went from Reserved back to Confirmed, its history recording the release by the owner with F4's reason. CHAIRS availability for E1's window was 10 again and PROJECTORS 3. The cancellation's one event.cancelled message, passed through the notification service's recipient rule, gave C1 exactly one notice, "The event EVT-… “Q2-T12 fixture event” has been cancelled. Reason: The speaker withdrew.", and told Technical Support that the chairs × 4 and projectors × 2 they reserved were released. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: 5cd14bb · Evidence: `backend/services/planning-core/tests/equipment/api/q2Cancellation.test.ts` › Q2 cards: an event cancellation releases the reservations › Q2-T12 F4's cancellation releases every Reserved line, recording the cancelling user and F4's reason, restores availability and tells the coordinator, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41793114951 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
