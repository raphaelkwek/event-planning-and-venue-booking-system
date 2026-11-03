# R4 — Withdraw my registration

Twelve cases, written from the story on 2 Nov 2026, before the code. The `FX-R-…` statements are in
`tests/R1/README.md`.

| Acceptance criterion | Cases |
|---|---|
| An attendee can withdraw only their own registration, and only while its status is Registered | R4-T1, R4-T3, R4-T4 |
| On withdrawal the registration status becomes Withdrawn and the withdrawal timestamp is recorded; the record is retained, not deleted | R4-T1 |
| Places remaining for the event increases by exactly one on a successful withdrawal, and any waitlisted attendees are notified that a place has become available (R6) | R4-T2, R4-T9 |
| Withdrawal is refused after the withdrawal deadline recorded for that event, with a message naming the deadline as the cause; the status and places remaining are unchanged. The deadline is set by the Event Organiser per event; where none is set, withdrawal is permitted up to the event's start date/time | R4-T5, R4-T6, R4-T7, R4-T8 |
| The attendee receives confirmation of the withdrawal, and the owning organiser sees the updated totals (R5) | R4-T9, R4-T12 |
| Registering again after withdrawing creates a new registration and is subject to the same capacity and registration-window rules as R2 | R4-T10 |

R4-T11 checks §7.2's rule that Withdraw confirms before acting.

## The deadline

The organiser sets it on the event's "Registration settings" screen (R4-T8), and may leave it
empty. It must be no later than the event's start. Withdrawal is allowed up to and including the
deadline, or the event's start when there is none (R4-T5, R4-T7).

## The waitlist and the organiser's totals (R5, R6)

- **Notifying the waitlist (R6).** A withdrawal that frees a public place tells every waiting
  attendee, in the withdrawal's transaction (`waitlist.place-opened`); R4-T9's waitlist half is
  proven with R6-T6. A seat that goes to an addition above capacity (R7) opens no place, so it
  tells nobody.
- **The organiser's totals (R5).** R4-T12 is proven with R5-T5.
