# J1-T13 — Recorded unavailability excludes the venue; a released slot and a removed block do not

## Specification

| Item | Content |
|---|---|
| Test Case ID | J1-T13 |
| Test Scenario | Recorded unavailability excludes the venue; a released slot and a removed block do not |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SEARCH completed.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Click “Find a venue” in the navigation.<br>2. Enter `FX Arts` in Building / location.<br>3. Set From to 14 December 2026, 10:00 and To to 14 December 2026, 11:00.<br>4. Click “Search”.<br>5. Change the window to 14 December 2026, 15:30–16:30 and click “Search”.<br>6. Change the window to 16 December 2026, 10:00–11:00 and click “Search”. |
| Test Data | Account: `coordinator@connectsphere.test` · FX Lecture Hall has an active maintenance block on 14 December 2026, 09:00–13:00, a released slot on 14 December 15:00–17:00, and a removed block on 16 December 09:00–13:00. FX Old Gym is inactive |
| Expected Result | 10:00–11:00 on the 14th: no venue, and the empty-result message. 15:30–16:30 on the 14th: FX Lecture Hall (the released slot blocks nothing). 10:00–11:00 on the 16th: FX Lecture Hall (the removed block blocks nothing). Judge only the rows whose name starts with `FX `; other venues in the shared database may also appear. |
| Created By | Joash |
| Date of Creation | 2026-10-10 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | UI walk-through in Chrome pending at the sprint review |
| Executed By | |
| Date of Execution | |
