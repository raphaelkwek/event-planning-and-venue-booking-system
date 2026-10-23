# I5-T6 — Venue search leaves the venue out for any period after an open-ended block starts

## Specification

| Item | Content |
|---|---|
| Test Case ID | I5-T6 |
| Test Scenario | Venue search leaves the venue out for any period after an open-ended block starts |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. A block recorded at `Lee Kong Chian Auditorium` from 2 December 2026 13:00 with no end.<br>4. Signed in as FX-BOOKING's assigned coordinator. |
| Test Steps | 1. Open Venue search and search 20 December 2026 14:00 to 18:00, minimum capacity 100.<br>2. Search 1 December 2026 14:00 to 18:00 with the same capacity. |
| Test Data | Block from 2 December 13:00, no end |
| Expected Result | The search for 20 December does not list `Lee Kong Chian Auditorium`. The search for 1 December, before the block, lists it. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-24 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
