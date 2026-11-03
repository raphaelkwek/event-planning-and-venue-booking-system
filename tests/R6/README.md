# R6 — Join and be invited from the waitlist

Twelve cases, written from the story on 3 Nov 2026, before the code. The `FX-R-…` statements and
Attendee Two are in `tests/R1/README.md` and `tests/R5/README.md`.

| Acceptance criterion | Cases |
|---|---|
| When registration is refused because no places remain, the attendee is offered a place on the waitlist; joining stores the attendee, the event, status Waitlisted, and the timestamp | R6-T1, R6-T2 |
| An attendee cannot hold both an active registration and a waitlist entry for the same event, and a second waitlist entry for the same attendee and event is refused | R6-T3, R6-T4, R6-T7 |
| Waitlist entries are retained in the order they were created, and that order is visible to the owning organiser and assigned coordinator | R6-T5 |
| Promotion is not automatic. When a place becomes available (a withdrawal, a capacity increase, or a manual release) waitlisted attendees are notified that a place is open and invited to apply; no registration is created on their behalf | R6-T6, R6-T11 |
| An invited attendee registers through R2 and is subject to the same capacity, duplicate, and registration-window rules; places are taken on a first-come basis among those invited | R6-T7, R6-T12 |
| An attendee can leave the waitlist at any time; the entry is retained with status Withdrawn and the attendee is not notified of further openings | R6-T8 |
| Waitlist entries do not consume places and are never counted as registrations in the totals shown in R5 | R6-T9 |
| When an event is cancelled, active waitlist entries become Cancelled and each waitlisted attendee is notified | R6-T10 |

R4-T9 (a withdrawal notifies the waitlist) is proven with R6-T6.

## How the waitlist works

- **Joining** is offered where R2 refuses for capacity, and on a Full event's page. It needs the
  event to take registrations, its window to be open, and no place to remain: while one does, the
  attendee should register instead (R6-T2).
- **Invited, not promoted.** When a place opens, every attendee still waiting is told, and nobody
  is registered for them. They register through R2 like anyone else, so the first to register gets
  the place (R6-T7).
- **Registering ends the entry.** When a waitlisted attendee registers, or is added by the
  organiser (R7), their entry closes with status `Registered` in the same transaction, so nobody
  holds both. A refused registration leaves the entry waiting.
- **Leaving** marks the entry `Withdrawn`. It is kept, and later openings don't reach it.
- **Manual release.** No story lets anyone release a held place other than by withdrawing it, so a
  withdrawal and a further confirmed venue booking are the two openings that exist. Both notify the
  waitlist through the same function, which a later release action would call.
