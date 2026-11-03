# F3, F4 and A4 review follow-ups: locked scope checks, the cancellation's venue gap, and who is told

**Timestamp:** 2026-11-03T16:53+08:00 (SGT)
**Author:** Joash
**Scope:** planning-core event, venue, equipment and change modules; contracts (`event.cancelled`,
`CANCELLATION_CONTENDED`); notification; the OpenAPI spec; ADR-0009; F3, F4, G2 and S3 cards;
traceability. PR #91, the follow-up to #71, #72 and #81; no migration.

## Fixed

- **A4: D2, L1, L2, L3 and O1 check the coordinator's scope again under the event lock.** They checked it
  only before their transaction, so a Lead's reassignment (E4) committing in between let the outgoing
  coordinator act. Each now reads the event in the caller's scope inside the transaction, through
  `findEventInScope`'s lock option (which re-reads the assignment once the lock is held, #81):
  - D2 (request clarification) locks the event `for update`, as D4 and D5 do;
  - L1, and L3's conversion through it, lock the venue, then the event `for share`, then the hold;
    L1 also re-checks that the event can still be booked;
  - L3's hold request locks the venue, then the event `for share` (the hold's foreign key share-locks
    the venue row, so the event first could deadlock with a block, which locks venue then event), and
    re-checks that the event can still hold a venue; L3's release locks the event before the hold;
  - L2's withdrawal locks the event `for share` before the request and its slot;
  - O1's request, edit and removal lock the event `for share` before the line and the type.
  S1 needed no change: its only write, the organiser's request, already reads the event in scope
  `for share` inside its transaction, and coordinators cannot make one.
- **F4: the cancellation's last lock-order gap is closed.** A hold or request at a venue the
  cancellation had not locked could commit between its venue locks and its event lock, and the release
  then locked that venue after the event, so a block there could deadlock with it. Once it holds the
  event, the cancellation reads the event's venues again; if it gained one, the attempt writes nothing
  and is tried again with that venue locked first, at most three times, then 409
  `CANCELLATION_CONTENDED` (new in contracts and the OpenAPI `ErrorCode` enum). The re-read is
  complete because L1 and L3 now create a request or hold only while holding the event `for share`.
- **Venue Staff are told when a cancellation releases their hold or withdraws their request** (review
  note CQ-06; not one of F3's or F4's acceptance criteria). `event.cancelled` gains optional `holds`
  and `requests`, each entry with its venue id, venue name, period and the venue's staff. They are
  additive, so registration's consumer (#80) and earlier messages still parse. The notification
  service tells those staff in the same notice as their released bookings.

## Docs

- ADR-0009: an implementation note (3 Nov 2026) that the CancelEvent workflow was never built; F4
  releases in the core transaction and the consumers of `event.cancelled` do the rest. The decision
  text is unchanged.
- The F3, G2 and S3 CHANGELOG entries and cards credit Raphael by name alone.
- On #84's branch, implementation.md §4.6 now records that a cancellation locks its venues before the
  event (settled in #72) instead of saying the pair needs a ruling.

## Tests

- `tests/event/api/a4LockedScopeActions.test.ts`: D2, L1, L2, L3 (request, release, convert) and O1
  (request, edit, remove), each queued behind an uncommitted reassignment. Throwaway database only.
- `f4Cards.test.ts`: a hold at a new venue committed while the cancellation waits for the event, with a
  block holding that venue; F4-T2 now searches with J1 before and after the cancellation; CQ-06's
  message and notice.
- Unit: `unlockedVenues` and `retryWhile` (change domain), the `event.cancelled` contract, and the
  notification wording.

## Cards

- F4-T2, F3-T2 and G2-T7 are recorded from this branch's CI run.
