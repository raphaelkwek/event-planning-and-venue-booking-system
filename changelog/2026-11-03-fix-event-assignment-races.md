# Audit fixes in the event module and the web app: E2 closed, the assignment read under the lock, and smaller gaps

**Timestamp:** 2026-11-03T04:30+08:00 (SGT)
**Updated:** merged with main 2026-11-03T16:15+08:00 (SGT)
**Author:** Joash
**Scope:** planning-core (event, identity, venue and notification-facing changes), contracts, notification service, web app; migration event/0020.

**Deploy:** run `npm run migrate -- event` (0020) before deploying planning-core. It closes the reassignment proposals still pending; nothing else in it needs a deploy order.

## What changed

1. **M8: E2 can no longer reassign an event without the Lead.** Accepting a reassignment proposal answers 410 `REASSIGNMENT_RETIRED`, naming E4. Migration event/0020 closes every proposal still pending, unaccepted, with `resolved_at`; the rows are kept. `closeActiveAssignment` is conditional on `is_active` and reports whether it closed anything, so a race with the Lead cannot raise 23505 or 40P01. The nominee's Accept and Decline buttons are gone from the review page. The E2 cards (`tests/E2`) are Blocked, retired by E4 (W9-FX-5); new card E4-T9.
2. **M7: the assignment is read again under the lock.** `findEventInScope` joined the active assignment in the statement that locks the event row. Under READ COMMITTED the recheck after a lock wait keeps the joined row from before the wait, so the coordinator the Lead had just replaced still passed S2's and F5's assigned-coordinator check (the new tests show an outgoing coordinator's approval going through on the old code). With a lock held, the active assignment is now read in a statement of its own. A note on this is in implementation.md section 4.7.
3. **L4: M1 approval re-reads the event's status.** It takes a share lock on the event (through the event module's index) after the venue lock and before the request lock, and refuses with 409 `EVENT_NOT_BOOKABLE` unless the event is Approved, Planning, Safety Review or Confirmed. A Completed or Cancelled event no longer gains a booking, and a cancellation in progress is waited for.
4. **L11: the request and review pages ask for their lists together.** After the event, the clarifications, proposals and change requests are fetched with `Promise.all` instead of one after another.
5. **L12, smaller gaps.**
   - **Holds (W9-40):** moving a hold's expiry now notifies the holding coordinator. `venue-booking.hold-expiry-changed` carries the hold, venue, event, coordinator and previous expiry (all optional in the contract, so older messages still validate and notify nobody). New card L6-T13.
   - **Correlation id:** `event.schedule-changed` carries the approving request's correlation id instead of null.
   - **E3, E4:** whether the chosen coordinator is an active Event Coordinator is checked inside the assignment's transaction, after the event is locked, with the user's row share-locked.
6. **L7: `GET /api/v1/events` is paged.** `limit` (default 25, at most 100) and `cursor`, newest first, answered as `{ items, nextCursor }` as before. The cursor is keyset (listed-at time and id). The `kind` filter is in the query. The web app's `listRequests` follows `nextCursor` in pages of 100, so no screen changed.

## Not done

- **I3, naming the block in the history entry:** the entry's triggering action is `VENUE_BLOCKED`, which is what the story and card I3-T1 ask for; naming the individual block would need a new history column.
- **S1, a change request on an unassigned event:** the story names only the assigned coordinator, and no customer answer says who else to tell, so nobody is notified until a coordinator is assigned. Left for a decision.

## Merged with main (F3, F4, G2 and A4), 3 Nov 2026

- **`findEventInScope`:** A4 and this change each re-read the assignment once the lock is held. They
  are one read now: with a lock, the active assignment is read in a statement of its own; a
  coordinator (A4 scope) who no longer holds it gets no event, and anyone else gets the event naming
  the coordinator assigned now.
- **M7's tests follow A4:** the outgoing coordinator's F5 confirmation and S2 approval, queued behind
  the reassignment, now come back `NOT_FOUND` (A4's 404, "not assigned to you") instead of
  `NOT_ASSIGNED`, which A4 removed. The two tests and their traceability rows are renamed to match.
- **E2's decline is retired too:** A4 let the nominee of a pending proposal decline it from outside
  their scope. Migration event/0020 closes every pending proposal and none can be made, so that path,
  and the decline's whole success path, could never run. The decline now answers 410
  `REASSIGNMENT_RETIRED` like the proposal and the accept; `findPendingProposal` and
  `resolveProposalDecline` are gone. The E2 cards' remarks say so.
- **Migration event/0020** still applies after main's event migrations, F3's 0012 and 0013 included.
