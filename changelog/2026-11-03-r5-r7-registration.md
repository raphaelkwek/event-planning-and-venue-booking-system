# R5–R7: the organiser's registration list, the waitlist, and manual additions (PR #88)

**Timestamp:** 2026-11-03T04:50+08:00 (SGT)
**Author:** Joash
**Scope:** registration service (migrations 0005 to 0007), planning-core (event and identity
modules), contracts, notification service, web app, CI.

**Deploy:** stacks on #80. Run `npm run migrate -- registration` (0005 to 0007), then deploy
planning-core, the registration service and the notification service together. Events confirmed
before this deploy get their assigned coordinator in the registration service on their next
`event.listing-changed` (any status, settings or coordinator change); until then only the owner
sees their registrations.

## Added

- **R5:** `GET /api/v1/events/{id}/registrations` in the registration service, for the owning
  organiser and the assigned coordinator only (anyone else gets 404, so no registration data
  leaves). Each row has the attendee's name, the registration time and status; manual additions
  say who added them, why and whether they went over capacity. Totals count the records in each
  status, places remaining is R2's, and the waitlist is counted apart. Names come from identity's
  `GET /api/v1/users` with the caller's token when the list is read, outside any transaction.
- **R6:** the waitlist (`registration.waitlist_entries`): `POST /api/v1/events/{id}/waitlist`
  after a capacity refusal, `GET /api/v1/waitlist-entries`, `POST
  /api/v1/waitlist-entries/{id}/withdrawal`, and the organiser's `GET /api/v1/events/{id}/waitlist`
  in the order joined. A withdrawal that frees a public place, or a further confirmed booking that
  adds places, tells every waiting attendee (`waitlist.place-opened`) in the same transaction;
  nobody is registered for them. Registering or being added ends the entry. Cancelling the event
  cancels the waiting entries and tells each attendee (`waitlist.cancelled`).
- **R7:** `POST /api/v1/events/{id}/manual-registrations`: the owner or the assigned coordinator
  adds an attendee by their account's email (identity's new `GET /api/v1/attendees?email=`),
  when full and after the window closes, refused without a confirmed booking. Above capacity it is
  saved only with `confirmOverCapacity: true` (D-01) and records `added_over_capacity`; the
  attendee is told (`registration.added`) and can withdraw under R4.
- **The places invariant:** every change to free seats or seatless registrations takes the
  event's places lock (exclusive for withdrawals, additions, seat builds and cancellation; shared
  for registering and joining), and a freed or new seat goes to the earliest seatless
  registration before it becomes free. A race test checks it.
- `event.listing-changed` carries `assignedCoordinatorId` (additive; an older message reads null),
  and is written on each change of coordinator (E2 accept, E3 assign, E4 reassign).
- The web app: a Registrations screen (totals, rows, Add an attendee with the capacity and new total
  shown before saving, the waitlist), linked from the organiser's request and the coordinator's
  review page; Join the waitlist on the event page; the Waitlist section, with Leave, on My
  registrations.
- 31 functional test cases in `tests/R5` to `tests/R7`, one automated test each, and 73
  traceability rows.

## Fixed

- R1–R4's relay test bound a JSON string to `jsonb`, so the relay set every test row aside; and
  R4-T10 compared two registrations made at the same instant, whose order was the random id's.
  Both are test fixes; neither test had run in CI before.

## Changed

- CI: the notification and registration integration steps run even when an earlier step failed,
  so one failure doesn't hide another's results. The job still fails if any step does.

## Not done

- No "manual release" action exists in any story, so a withdrawal and a further booking are the
  only openings that notify the waitlist; a release action would call the same function.
- The UI walk-throughs in Chrome are pending at the sprint review; several need a second attendee
  account, which the seed doesn't have (`tests/R5/README.md`).
