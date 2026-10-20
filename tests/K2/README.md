# K2 — Justify booking a venue flagged as unsuitable

Ten cases, written from the story on 19 Oct 2026, before the code.

| Acceptance criterion | Cases |
|---|---|
| Proceeding from a Suitable or Suitable-with-warnings result requires no justification | K2-T1, K2-T8, K2-T9 |
| Proceeding from a Not suitable result requires a justification of at least one non-whitespace character; without it no booking request is created | K2-T2, K2-T3, K2-T4, K2-T7, K2-T10 |
| The justification is stored with the booking request, with the failing conditions as evaluated at the time of the request, the coordinator and the timestamp | K2-T5, K2-T7 |
| The justification and the failing conditions are shown to Venue Staff on the pending request | K2-T6 |

## What is assessed

When the coordinator submits a request (L1), the venue is assessed by K1's rules against **the
request's own values**: its layout and expected attendance, its facilities and accessibility
features, and its period (CR-03: each venue is judged against its own request). A request is
never refused for being unsuitable: with a justification it is created, Pending, as any other.

**Through the form, only the layout capacity and the operating hours can fail.** The form offers
only the chosen venue's own facilities and accessibility features, so a request made there never
asks for one the venue lacks. A request sent through the API console can (K2-T10).

**"Suitable with warnings" can't arise for a request.** A warning is a condition K1 could not
assess because a value was missing. A request always has a layout the venue offers, an attendance
and a valid period (L1 refuses anything else), so every condition is assessed. The rule that a
warning needs no justification is checked by the unit tests
(`backend/services/planning-core/tests/venue/domain/bookingRequest.test.ts`), not by a card.

**The failing conditions are a snapshot.** They are stored with the request as they were
evaluated when it was made. Changing the venue afterwards doesn't change them (K2-T5).

**Requests made before K2** have no assessment; Venue Staff see them as "Not assessed".

## Messages

| Where | Text |
|---|---|
| Refusal without a justification | `<venue> is not suitable for this request. Give a justification to request it anyway.` |
| Under the Justification box | `Give a justification: at least one character that isn't a space.` |
| Layout capacity (K1) | `Expected attendance 150 against layout capacity 120 (Classroom).` |
| Operating hours (K1) | `The requested period 2026-12-02 14:00–23:00 is outside Wednesday's operating hours 08:00–22:00.` |

Every case uses **FX-BOOKING** (`tests/L1/README.md`): the approved standard request (2 December
2026, 14:00–18:00, 150 attending) and the standard venue `Lee Kong Chian Auditorium` (Theatre 300 ·
Classroom 120 · Banquet 180; Monday to Friday 08:00–22:00), looked after by
`venuestaff@connectsphere.test`. "The assigned coordinator" is whichever seeded coordinator the
event's "Assigned coordinator" field names.

## FX-K2-UNSUITABLE

FX-BOOKING, then, signed in as the assigned coordinator: the event → "Venue requests" →
"Request a venue" → Venue `Lee Kong Chian Auditorium` → Room layout `Classroom` (the attendance
stays 150) → "Submit request" → in the Justification box, `Only the auditorium has a stage; the
extra 30 will stand at the back.` → "Submit request". The event's venue requests list the new
request, Pending.
