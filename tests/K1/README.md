# K1 — See whether a venue is suitable for an event, and why not

Thirteen cases, written from the story (revision 4) on 10 Oct 2026, before the code.

| Acceptance criterion | Cases |
|---|---|
| For a selected event and venue the screen shows Suitable, Suitable with warnings, or Not suitable | K1-T1, K1-T2, K1-T11 |
| Not suitable when attendance exceeds the selected layout's capacity | K1-T2, K1-T3 |
| Not suitable when a required facility is absent | K1-T4 |
| Not suitable when a required accessibility feature is absent | K1-T5 |
| Not suitable when the requested period falls outside operating hours | K1-T6, K1-T7 |
| Every failing condition is listed separately with the values compared | K1-T2, K1-T4, K1-T5, K1-T6, K1-T8 |
| All compared values are read from the event record and the venue catalogue | K1-T9 |
| The indicator is advisory: it creates, changes or blocks no booking | K1-T10 |
| With no failing condition the result is Suitable and no reasons are listed | K1-T1, K1-T3, K1-T7 |
| CR-03: each venue of an event is assessed against its own booking request | K1-T13 (blocked until L1 and L4) |

K1-T12 checks that only Event Coordinators can run the check (A2, Cerbos action `check_suitability`).

## What "Suitable with warnings" means here

The story names the result but lists only failing conditions. A warning is therefore limited to
what the story's own text supports: a condition that **cannot be assessed** because the event or
the catalogue does not hold the value to compare (no layout recorded on the event, no proposed
period, or a layout the venue does not offer). It is not a failure, and it is not a pass. No
other warning rule is invented. K1-T11 checks it.

## FX-SUITABILITY

Fixture for every case: venue `K1 Test Hall` and the events below (owned by an Event Organiser,
status Planning).

| Venue attribute | Value |
|---|---|
| Layouts | Theatre 120, Classroom 60 |
| Facilities | Projector, Microphone, Livestream |
| Accessibility features | Step-free entrance, Hearing loop |
| Operating hours | Monday to Friday 08:00–22:00, Saturday 09:00–18:00, Sunday closed |

Events not listed with a period default to Monday 7 December 2026 10:00–12:00, Theatre layout
and 100 attendees, with no facility or accessibility need. Each case names the attribute that
differs.

## CR-03

L1 (booking request) and L4 (several venues per event) are Sprint 3, so K1-T13 cannot run yet.
The check takes a "requirements" input so that L1 can pass each request's own requirements
later; for now it is given the event's.

## Execution (10 Oct 2026)

K1-T1 to K1-T8 and K1-T11 are recorded Pass (automated, API level): the API integration test in
`backend/services/planning-core/tests/venue/api/suitability.test.ts` runs each card's data and
checks its expected result, and passed in CI. The screen steps of those cards, and K1-T9, K1-T10
and K1-T12 (which look at the screen), wait for the Chrome walk-through at the sprint review.
K1-T13 is blocked until L1 and L4.
