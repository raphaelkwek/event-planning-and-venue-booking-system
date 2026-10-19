# J1-T21 — Opened from an event, the filters are pre-filled from the event's recorded requirements

## Specification

| Item | Content |
|---|---|
| Test Case ID | J1-T21 |
| Test Scenario | Opened from an event, the filters are pre-filled from the event's recorded requirements |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SEARCH completed.<br>3. FX-SEARCH-EVENT completed. Note the event's id.<br>4. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Click “All events” and open the event `FX Symposium` (use its reference from FX-SEARCH-EVENT).<br>2. Click “Find a venue”.<br>3. Look at the filters before changing anything. |
| Test Data | Account: `coordinator@connectsphere.test` · The event: 14 December 2026, 12:00–14:00, expected attendance 150, layout Theatre, facilities Projector and Wireless microphones, accessibility needs “Step-free access, Hearing loop, Reserved seating” |
| Expected Result | The form opens with From 14 December 2026 12:00, To 14 December 2026 14:00, Minimum capacity 150, Layout Theatre, Projector and Wireless microphones ticked, and Step-free access and Hearing loop ticked. A note says that “Reserved seating” was not matched to a catalogue feature. The results already shown are FX Auditorium only. Judge only the rows whose name starts with `FX `; other venues in the shared database may also appear. |
| Created By | Joash |
| Date of Creation | 2026-10-10 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: cb3b9d8 · Evidence: partial only. At API level, for an event on 14 Dec 12:00-14:00, attendance 150, layout theatre, facilities projector and Wireless microphones, needs 'Step-free access, hearing LOOP, Reserved seating', the pre-fill route returned from 12:00 to 14:00 SGT, minimum capacity 150, layout Theatre, facilities Projector and Wireless microphones, accessibility Step-free access and Hearing loop, with Reserved seating listed as unmatched. Searching with those returned filters returned Auditorium only (backend/services/planning-core/tests/venue/api/venueSearch.test.ts › gives the event's window, attendance, layout, facilities and matched accessibility needs, in the catalogue's spelling (J1-T21) ; backend/services/planning-core/tests/venue/api/venueSearch.test.ts › gives filters the search accepts back unchanged, so the pre-filled search runs (J1-T21) , CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/38427990873). Not covered by any automated test: the pre-filled form itself and the note naming the unmatched need. UI walk-through in Chrome pending at the sprint review · Defect: — |
| Executed By | |
| Date of Execution | |