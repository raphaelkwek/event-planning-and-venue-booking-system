# F4-T7 — The event's registrations and waitlist entries are cancelled, and each attendee is told

## Specification

| Item | Content |
|---|---|
| Test Case ID | F4-T7 |
| Test Scenario | F4-AC4: cancelling E cancels its active registrations and waitlist entries, and tells each attendee. The registration service does this when it consumes `event.cancelled`; F4's cancellation transaction releases no registration itself. |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including F3's `event/0012`, `event/0013`, `change/0004` and `change/0005`), using the isolated setup in `tests/F4/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-F4 from `tests/F4/README.md` is loaded.<br>3. The registration service is migrated and running its consumer of `connectsphere.event.v1`, and E has seats from B1's approval, two Registered attendees and one waiting waitlist entry (R2, R6). |
| Test Steps | 1. As O, cancel E with the body below.<br>2. Let the registration service consume the `event.cancelled` message the cancellation wrote.<br>3. Read E's registrations, seats and waitlist entries in the registration service, and its outbox.<br>4. Run `npm test -w @connectsphere/planning-core -- tests/change/api/f4Cards.test.ts -t 'F4-T7 '` and read the named `F4-T7 ` result. |
| Test Data | `{"reason":"The speaker withdrew."}` |
| Expected Result | Step 1 answers 200 with `released.registrations` 0 and writes `event.cancelled` for E. After step 2, both registrations are Cancelled at the cancellation's time, E's seats are retired, the waitlist entry is Cancelled, and the outbox holds one `registration.cancelled` per registration and one `waitlist.cancelled` per entry, each naming its attendee. Step 4 passes. |
| Created By | Raphael |
| Date of Creation | 2026-10-29 (revised 2026-11-03 for the review of #72) |

> **Expected results are checked by the PR reviewer** against F4's acceptance criteria.

> **Run note, 2026-11-04.** Run on CI's browser stack rather than the isolated API setup: E is built through the
> services' APIs there, with B1's approved booking, its seats, two Registered attendees and one waiting entry. FX-F4's
> hold, pending booking request and equipment reservations are left out, since this criterion does not use them
> (F4-T1 to F4-T6 do). Step 2 is the registration service's own consumer of `event.cancelled`, handed the message by the
> test harness in place of Kafka (`tests/e2e/support/deliver.ts`); step 4 is unchanged.

## Execution record

| Item | Content |
|---|---|
| Actual Result | Run on CI's throwaway stack with every service, in place of the isolated API setup. E was Approved and booked at a venue whose Theatre layout seats 2 (B1); B1's approval was handed to the registration service's seat builder, which built E's 2 seats. FX-F4's hold, pending request and reservations were left out, as AC4 reads none of them (F4-T1 to F4-T6 cover them). Attendee One and another attendee were Registered and Attendee Two was on the waitlist. Step 1: O's cancellation answered 200 with `released.registrations` 0 and wrote one `event.cancelled` for E; both registrations were still Registered. Step 2: that `event.cancelled` was handed to the registration service's consumer of `connectsphere.event.v1` (the test harness in place of Kafka), which applied it. Step 3: both registrations were CANCELLED at the cancellation's time (the `cancelledAt` of `event.cancelled`, equal to E's own), E's 2 seats were RETIRED, the waitlist entry was CANCELLED at that time, and registration.outbox held one `registration.cancelled` per registration (each naming its attendee and REG-…) and one `waitlist.cancelled` naming Attendee Two and WL-…. Each attendee was told: the notification service stored those three notices; Attendee One's Notifications read `EVT-… “F4 Registrations …” has been cancelled, so your registration REG-… is cancelled.`, Attendee Two's read `EVT-… “F4 Registrations …” has been cancelled, so your place on its waitlist (WL-…) is cancelled.`, and the other attendee's was stored for them. Step 4: f4Cards.test.ts › F4-T7 passed in the same run. |
| Status | Pass |
| Remarks | Automated (browser, Playwright; API level) · Commit: c0f7183 · Evidence: tests/e2e/u-safety-and-assignment.spec.ts › F4-T7 the registration service cancels the event's registrations and waitlist entry from event.cancelled, and tells each attendee; `backend/services/planning-core/tests/change/api/f4Cards.test.ts` › F4 cards (tests/F4) › F4-T7 the cancellation itself releases no registration: the registration service does that from event.cancelled, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41798410254 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
