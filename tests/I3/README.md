# I3 — Return a Confirmed event to Planning when its venue is blocked (W9-FX-1)

Seven cases, written from the story on 24 Oct 2026, before the code. The story comes from the
customer's Week 9 answers: a Confirmed event whose venue becomes unavailable "should revert to
Planning review. The event itself is preserve and not automatically cancelled" (W9-50); "The Event
Coordinator is informed immediately … Organisers and Attendees are notified when replacement
arrangements or formal event changes are confirmed" (W9-51); see also W9-43
(`documentation/clarifications.md`). I3 replaces I2's "the corresponding event's status is
unchanged" for a Confirmed event.

| Acceptance criterion | Cases |
|---|---|
| A block over a confirmed booking of a Confirmed event moves it to Planning, with a status history entry naming the block as the trigger (F1); an event in any other status is unchanged | I3-T1, I3-T2 |
| The event and its record are kept: never cancelled; its other arrangements and registrations unchanged | I3-T3 |
| The assigned coordinator is notified at once, and the notification says the event returned to Planning | I3-T4 |
| The organiser and attendees aren't notified when the block is recorded; they are when a replacement is approved (L5, M1) or a change approved (S2) | I3-T4, I3-T5 (organiser; attendees await R2) |
| To become Confirmed again the event passes F5 and the safety check (U1) again | I3-T6 (to Safety Review; U1 isn't built) |
| A failed block creation changes no event's status | I3-T7 |

## FX-CONFIRMED-BOOKING

An event can only become Confirmed through U1, which isn't built, so this fixture sets the status
directly, as FX-SEEDED does (`tests/README.md`).

1. **FX-BOOKING** (`tests/L1/README.md`). Note the event's id and its assigned coordinator.
2. As the coordinator, request `Lee Kong Chian Auditorium`, Theatre, 150, 2 December 2026
   14:00–18:00, and as `venuestaff@connectsphere.test` approve it (M1).
3. **The FX-CONFIRMED statement** below, with the event's id.

~~~sql
update event.events set status = 'CONFIRMED', updated_at = now() where id = '<EVENT_ID>';
~~~

## The trigger in the status history

F1 records the triggering action of every status change. A block's is `VENUE_BLOCKED`, by the Venue
Staff member who recorded the block. The status history on the event's page shows the change
(Confirmed → Planning, by Venue Staff, and when); the action itself is read in the database
(`event.event_history.triggering_action`).
