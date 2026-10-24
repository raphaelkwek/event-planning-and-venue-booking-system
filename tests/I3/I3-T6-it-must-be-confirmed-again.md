# I3-T6 — To become Confirmed again, the event passes confirmation (F5) again: refused while its booking is flagged, accepted once replaced

## Specification

| Item | Content |
|---|---|
| Test Case ID | I3-T6 |
| Test Scenario | To become Confirmed again, the event passes confirmation (F5) again: refused while its booking is flagged, accepted once replaced |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. I3-T1 completed: the event is in Planning with its `Lee Kong Chian Auditorium` booking flagged.<br>3. Signed in as the event's assigned coordinator. |
| Test Steps | 1. Open the event and click "Confirm arrangements".<br>2. Replace the flagged booking with an approved request for `Mochtar Riady Hall` (L5, M1), as in I3-T5.<br>3. Click "Confirm arrangements" again. |
| Test Data | Event returned to Planning |
| Expected Result | Step 1 is refused, naming the flagged booking. Step 3 succeeds, and the event moves to Safety Review, from where only the safety check (U1) can make it Confirmed again. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-24 |

> The safety check itself is U1, which isn't built, so this case stops at Safety Review.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
