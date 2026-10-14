# J2-T4 — The text search combined with J1's filters returns only venues satisfying both

## Specification

| Item | Content |
|---|---|
| Test Case ID | J2-T4 |
| Test Scenario | The text search combined with J1's filters returns only venues satisfying both |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SEARCH completed.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Click “Find a venue” in the navigation.<br>2. Enter `fx science` in “Search by name or building”.<br>3. Enter `100` in Minimum capacity.<br>4. Click “Search”.<br>5. Tick `Hearing loop` under Accessibility features and click “Search”.<br>6. Set From to 14 December 2026, 10:30 and To to 14 December 2026, 11:30 and click “Search”. |
| Test Data | Account: `coordinator@connectsphere.test` · FX Auditorium (300, hearing loop, booked 14 December 10:00–12:00) and FX Seminar Room (60, no hearing loop) are in FX Science Block |
| Expected Result | `fx science` with minimum capacity 100: FX Auditorium only (FX Seminar Room holds 60). Adding Hearing loop: FX Auditorium only. Adding the window 10:30–11:30 on the 14th: no venue, because FX Auditorium's confirmed booking overlaps it; the message restates the search and the filters. Judge only the rows whose name starts with `FX `; other venues in the shared database may also appear. |
| Created By | Joash |
| Date of Creation | 2026-10-10 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Search 'science' with minimum capacity 100 returned Auditorium only; adding Hearing loop returned Auditorium only; adding the window 14 Dec 10:30-11:30 returned no venue (Auditorium's booking overlaps). The message restating the search and filters was not asserted in this test. |
| Status | Pass (automated, API level) |
| Remarks | Commit: cb3b9d8 · Evidence: backend/services/planning-core/tests/venue/repo/venueSearch.test.ts › combines with the filters, and the result satisfies both (J2-T4) , CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/38427990873 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-10-13 |
