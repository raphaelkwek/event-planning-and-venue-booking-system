# One notification per person per message: S3's flagged arrangements and F5's bookings reach their staff

**Timestamp:** 2026-11-04T19:44+08:00 (SGT)
**Author:** Joash
**Reason:** S3-T13's browser journey (#116) found that Venue Staff and Technical Support never heard
that an approved change flagged their arrangements. S3's recipient rule wrote one notice per flag,
and the message has one entry per flag, so one person could be named several times: a booking moved
and too small appears twice, and one Venue Staff member often looks after both venues.
`notification.notifications` is unique on (source_message_id, recipient_user_id), the inbox's
idempotency key, so the second insert failed with `duplicate key value violates unique constraint
"notifications_source_message_id_recipient_user_id_key"`. The message was retried, then
dead-lettered, and nobody it named was told. F5's `event.arrangements-confirmed` rule wrote one
notice per booking in the same way, so a member who looks after two booked venues lost the whole
message, the owner's and the Safety Officers' notices included.
**Scope:** the notification service's recipient rules (`src/domain/recipients.ts`) and their unit
tests, a new notification integration test (`tests/consumer/oneNoticePerRecipient.test.ts`),
planning-core's S3-T10 API test, S3-T13's browser journey (`tests/e2e/q-equipment-and-changes.spec.ts`),
the S3-T10 and S3-T13 cards, and the S3, F5 and T2 traceability. No migration, no contract change,
no API change; the unique constraint stays.

## Fixed

- **S3 tells each person once, naming every flagged arrangement of theirs.** A Venue Staff member
  hears of each flagged booking, hold or pending request at their venues, with every reason, in one
  notice: "Booking BKR-… at <venue> and booking BKR-… at <venue> for EVT-… “name” need attention
  after an approved change. BKR-…: <reason> <reason> BKR-…: <reason>". A member who reserved several
  flagged lines hears of them together and is asked to release any that is no longer needed. One
  arrangement keeps the words its notice always had, with both reasons when it carries two flags.
- **F5 tells each Venue Staff member once**, listing every booking of theirs with its venue and
  period, as it already did for each reserver's equipment.
- **No rule can fail a whole message this way again.** `notificationsFor` keeps one notification per
  recipient whatever a rule returns: someone a rule names twice gets each different text once, in
  order, in one notification.
- The grouping is done where the notices are built, in the notification service, so messages
  already on the event topic deliver unchanged. Both design specs already said one notice per
  recipient (S3's §3, decision 7; F5's §5).

## Tests

- Unit (`recipients.test.ts`): S3-T13's message shape (one booking flagged twice, one member at both
  venues) gives three notices, one per person, each worded in full; several reservations of one
  member; a booking and a reservation of one person; a hold and a pending request listed together;
  F5 with one member at two venues; a Lead named twice; one person named in two roles. Mutation
  score on `recipients.ts` 97.67% (every mutant in the changed lines killed; the 12 survivors are
  in unchanged rules).
- Integration (`oneNoticePerRecipient.test.ts`, CI's throwaway Postgres): the S3 and F5 messages are
  consumed by `handleMessage`, store one row per person with every arrangement named, and send
  nothing to the retry or dead-letter topic; a second delivery is still a duplicate.
- S3-T10's API test asserted one notice per arrangement, which is the defect; it now expects VS's
  one notice to name B1 and B2.
- S3-T13's journey loses its expected-failure marker (#116): step 7's delivery must be stored,
  Venue Staff One's one notice must name both bookings and all three flags' reasons, and Technical
  Support's must name the reservation. S3-T13's step 7 and S3-T10's step 3 expected a notice per
  booking; each now expects one notice per person, with a dated note saying why, and both cards are
  recorded from this change's CI run.
