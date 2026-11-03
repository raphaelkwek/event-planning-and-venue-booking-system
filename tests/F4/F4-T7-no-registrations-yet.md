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

## Execution record

| Item | Content |
|---|---|
| Actual Result | Not run: the registration consumer of `event.cancelled` is not on main. Step 1's part passed in CI: the cancellation answered 200 with `released.registrations` 0. |
| Status | Blocked |
| Remarks | Blocked: waits for R1–R4 (#80) and R5–R7 (#88), whose registration-service consumer of `event.cancelled` cancels the event's registrations and waitlist entries and tells the attendees. Neither is merged. Only step 1's `released.registrations` 0 is automated (API level) · Commit: 1e9a764 · Evidence: `backend/services/planning-core/tests/change/api/f4Cards.test.ts` › `F4-T7 the cancellation itself releases no registration: the registration service does that from event.cancelled`, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41597952863 · Defect: — |
| Executed By | Joash, via automated testing (CI) (step 1 only) |
| Date of Execution | 2026-11-03 |
