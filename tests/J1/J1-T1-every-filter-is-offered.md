# J1-T1 — The search offers every filter J1 lists, and with none chosen lists the active venues

## Specification

| Item | Content |
|---|---|
| Test Case ID | J1-T1 |
| Test Scenario | The search offers every filter J1 lists, and with none chosen lists the active venues |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SEARCH completed.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Click “Find a venue” in the navigation.<br>2. Look at the form.<br>3. Without choosing anything, click “Search”. |
| Test Data | Account: `coordinator@connectsphere.test` |
| Expected Result | The form has From and To (date and time), Minimum capacity, Building / location, Layout, a Facilities group and an Accessibility features group, besides J2's “Search by name or building”. The results list FX Auditorium, FX Seminar Room, FX Lecture Hall and FX Late Studio, each once. FX Old Gym is not listed because it is inactive. Judge only the rows whose name starts with `FX `; other venues in the shared database may also appear. |
| Created By | Joash |
| Date of Creation | 2026-10-10 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Every filter control was present; with none chosen each active test venue was listed once and the inactive one was not. (The FX-SEARCH venues were created through the API.) Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6080462 · Evidence: tests/e2e/h-venues.spec.ts › J1-T1 the search offers every filter, and with none chosen lists the active venues, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
