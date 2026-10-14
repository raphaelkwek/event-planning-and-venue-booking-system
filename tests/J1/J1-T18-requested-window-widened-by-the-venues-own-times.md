# J1-T18 — CR-01: the requested window is widened by the venue's own setup and turnaround time

## Specification

| Item | Content |
|---|---|
| Test Case ID | J1-T18 |
| Test Scenario | CR-01: the requested window is widened by the venue's own setup and turnaround time |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SEARCH completed.<br>3. Signed in as `coordinator@connectsphere.test`.<br>4. H3 is merged, so a venue record holds a setup time and a turnaround time. |
| Test Steps | 1. As `venuestaff@connectsphere.test`, set FX Seminar Room's setup time to 30 minutes and its turnaround time to 30 minutes (H3).<br>2. Sign in as `coordinator@connectsphere.test`.<br>3. Click “Find a venue” in the navigation.<br>4. Enter `FX Science` in Building / location.<br>5. Set From to 14 December 2026, 16:00 and To to 14 December 2026, 17:00.<br>6. Click “Search”.<br>7. Change the window to 14 December 2026, 16:30–17:30 and click “Search”. |
| Test Data | Account: `coordinator@connectsphere.test` · FX Seminar Room's hold runs 14:00–16:00 on 14 December 2026 |
| Expected Result | 16:00–17:00: FX Auditorium only, because FX Seminar Room's turnaround widens the window back to 15:30, into the hold. 16:30–17:30: FX Auditorium and FX Seminar Room (the widened window starts exactly at 16:00, where the hold ends). Judge only the rows whose name starts with `FX `; other venues in the shared database may also appear. |
| Created By | Joash |
| Date of Creation | 2026-10-10 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Waits for H3 (Sprint 3): the venue record has no setup or turnaround time yet, so the search widens by zero minutes until it lands. See the J1 README |
| Executed By | |
| Date of Execution | |
