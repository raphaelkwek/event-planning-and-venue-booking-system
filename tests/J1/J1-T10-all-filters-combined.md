# J1-T10 — Only venues meeting every selected filter are returned

## Specification

| Item | Content |
|---|---|
| Test Case ID | J1-T10 |
| Test Scenario | Only venues meeting every selected filter are returned |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SEARCH completed.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Click “Find a venue” in the navigation.<br>2. Enter `science` in Building / location.<br>3. Enter `100` in Minimum capacity.<br>4. Choose `Classroom` in Layout.<br>5. Tick `Projector` under Facilities.<br>6. Tick `Hearing loop` under Accessibility features.<br>7. Set From to 16 December 2026, 10:00 and To to 16 December 2026, 11:00.<br>8. Click “Search”. |
| Test Data | Account: `coordinator@connectsphere.test` · FX Auditorium meets all of these; FX Seminar Room is in the building but its Classroom layout holds 40 and it has no hearing loop |
| Expected Result | FX Auditorium only. Judge only the rows whose name starts with `FX `; other venues in the shared database may also appear. |
| Created By | Joash |
| Date of Creation | 2026-10-10 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Building 'J1T Science', minimum capacity 100, Classroom layout, Projector, Hearing loop, window 16 Dec 10:00-11:00 returned Auditorium only. |
| Status | Pass (automated, API level) |
| Remarks | Commit: cb3b9d8 · Evidence: backend/services/planning-core/tests/venue/repo/venueSearch.test.ts › returns only venues meeting every filter at once (J1-T10) , CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/38427990873 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-10-13 |
