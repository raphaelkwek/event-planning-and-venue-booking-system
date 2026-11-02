# L6-T13 — The coordinator is told when Venue Staff move the expiry

## Specification

| Item | Content |
|---|---|
| Test Case ID | L6-T13 |
| Test Scenario | When VS moves H1's expiry later, the `venue-booking.hold-expiry-changed` message carries what C1 is told: the hold, venue, event, coordinator, the old and the new expiry (W9-40: "He need to notify the event coordinator with such changes") |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/L6/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names.<br>2. Fixture FX-L6 from `tests/L6/README.md` is loaded: venue V, VS (Venue Staff of V), event E1 (Approved, coordinator C1) and hold H1 (Held, expiry `D-1 12:00` UTC, lead 60 minutes). |
| Test Steps | 1. As VS, send `PATCH /api/v1/holds/<H1>/expiry` with `{"expiresAt":"D-1 18:00 UTC"}`.<br>2. Read the outbox messages for H1.<br>3. Feed the message to the notification rules (`tests/domain/recipients.test.ts` in the notification service does this).<br>4. Run `npm test -w @connectsphere/planning-core -- tests/venue/api/l6Cards.test.ts -t 'L6-T13 '` and read the named `L6-T13 ` result. |
| Test Data | As in the steps. |
| Expected Result | Step 1 answers HTTP 200. Step 2 shows exactly one `venue-booking.hold-expiry-changed` message for H1, carrying H1's id and reference, V's id and name, E1's id and reference, `coordinatorId` C1, `expiresAt` `D-1 18:00` UTC, `previousExpiresAt` `D-1 12:00` UTC and `changedBy` VS. Step 3 gives one notice, to C1 alone, naming the venue, event, period, the new expiry and the old one in Singapore time. A message written before this change, with no coordinator, notifies nobody. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

> **Expected results are checked by the PR reviewer** against L6's acceptance criteria and the Week 9 answer W9-40.

## Execution record

| Item | Content |
|---|---|
| Actual Result | The automated tests performed this card's steps. PATCH /api/v1/holds/<H1>/expiry answered 200 and wrote exactly one venue-booking.hold-expiry-changed message carrying the hold id and reference, the venue id and name, the event id and reference, coordinatorId C1, the new expiry, previousExpiresAt and changedBy VS. The notification rules turned that message into one notice to C1 alone, naming the venue, event, period, the new expiry and the old one in Singapore time, and a message with no coordinator notified nobody. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: 2f7c1256a9a2bdb8a767e8ffef0925b869a4ee19 · Evidence: backend/services/planning-core/tests/venue/api/l6Cards.test.ts › L6-T13 tells the holding coordinator what the new expiry is, in the message the change writes (W9-40); backend/services/notification/tests/domain/recipients.test.ts › tells the coordinator when Venue Staff move the expiry, naming the old and the new (W9-40), CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41519054822 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
