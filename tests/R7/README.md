# R7 — Add an attendee manually

Thirteen cases, written from the story on 3 Nov 2026, before the code. The `FX-R-…` statements and
Attendee Two are in `tests/R1/README.md` and `tests/R5/README.md`.

| Acceptance criterion | Cases |
|---|---|
| Only the owning organiser or the assigned coordinator can add an attendee manually, and only to an event they manage | R7-T1, R7-T2, R7-T3 |
| A manual addition is permitted even when no registration places remain and when the registration window has closed | R7-T4, R7-T5 |
| Week 9 answer (CQ-01, decision D-01): a manual addition is permitted even when it takes the total above the capacity; before it is saved they are shown the capacity and the total the addition would make, and the registration records that it was added over capacity | R7-T5, R7-T6 |
| CR-03, Week 9 answer (CQ-04): for an event with several venues, the capacity is the total of the layout capacities of its confirmed bookings | R7-T7 |
| A manual addition is refused when the event has no confirmed venue booking, because the capacity ceiling is not yet known | R7-T8 |
| The registration is stored with status Registered, marked as manually added, and records who added it, when, and an optional reason | R7-T1, R7-T2, R7-T13 |
| Manually added attendees appear in the organiser's registration list (R5) distinguishable from self-registered attendees, and are included in the totals and in the places-remaining calculation (R2) | R7-T9, R7-T12 |
| A duplicate manual addition for an attendee who already holds an active registration is refused and names the existing registration | R7-T10 |
| The added attendee receives a notification and can withdraw their own registration under the same terms as R4 | R7-T1, R7-T11 |

R2-T13 (D-01: places remaining is zero, never negative, after additions above capacity, and
registration is refused until withdrawals bring the total below capacity) is proven with R7-T12.

## Who is added

The organiser names the attendee by the email of their account. Only an account with the Attendee
role can be added (R7-T13): the added attendee must be able to sign in, see the registration (R3)
and withdraw it (R4).

## Over capacity (D-01)

An addition takes a free seat when there is one. When there is none, the addition is over
capacity: the screen shows the capacity (the total of the confirmed bookings' layout capacities,
CQ-04) and the number of attendees the addition makes, and saves only once the organiser confirms.
The server refuses an unconfirmed addition over capacity too (R7-T6), so a seat taken by someone
else between showing and saving can't slip past. The registration records `addedOverCapacity` and
holds no seat.

When a seated attendee later withdraws, their seat goes straight to the earliest registration that
holds none, in the same transaction, so the event never shows a free place while attendees are
still over capacity (R7-T12, R2-T13). The flag stays on the record: it says how the attendee was
added.
