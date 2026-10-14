# J1-T9 — Every required accessibility feature must be present

## Specification

| Item | Content |
|---|---|
| Test Case ID | J1-T9 |
| Test Scenario | Every required accessibility feature must be present |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SEARCH completed.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Click “Find a venue” in the navigation.<br>2. Tick `Hearing loop` under Accessibility features.<br>3. Click “Search”.<br>4. Untick it, tick `Accessible toilet`, and click “Search”.<br>5. Also tick `Step-free access` and `Hearing loop` and click “Search”. |
| Test Data | Account: `coordinator@connectsphere.test` · Hearing loop: FX Auditorium, FX Lecture Hall. Accessible toilet: FX Lecture Hall. Step-free access: all four active FX venues |
| Expected Result | `Hearing loop`: FX Auditorium and FX Lecture Hall. `Accessible toilet`: FX Lecture Hall only. `Accessible toilet`, `Step-free access` and `Hearing loop`: FX Lecture Hall only. Judge only the rows whose name starts with `FX `; other venues in the shared database may also appear. |
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
