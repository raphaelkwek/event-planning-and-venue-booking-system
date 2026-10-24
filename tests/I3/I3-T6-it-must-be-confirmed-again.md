# I3-T6 — To become Confirmed again, the event passes confirmation (F5) again: refused while its booking is flagged, accepted once replaced

## Specification

| Item | Content |
|---|---|
| Test Case ID | I3-T6 |
| Test Scenario | To become Confirmed again, the event passes confirmation (F5) again: refused while its booking is flagged, accepted once replaced |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. I3-T1 completed: the event is in Planning with its `Lee Kong Chian Auditorium` booking flagged.<br>3. Signed in as the event's assigned coordinator. |
| Test Steps | 1. Open the event and click "Confirm arrangements".<br>2. Replace the flagged booking with an approved request for `Seminar Room 2-1` (L5, M1), as in I3-T5.<br>3. Click "Confirm arrangements" again. |
| Test Data | Event returned to Planning |
| Expected Result | Step 1 is refused, naming the flagged booking. Step 3 succeeds, and the event moves to Safety Review, from where only the safety check (U1) can make it Confirmed again. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-24 |

> The safety check itself is U1, which isn't built, so this case stops at Safety Review.

## Execution record

| Item | Content |
|---|---|
| Actual Result | With BKR-004489 flagged, confirmation was refused, listing "Outstanding flagsBKR-004489 at Lee Kong Chian Auditorium: requires reconfirmation.", and the event stayed PLANNING. Once BKR-004490 at Seminar Room 2-1 was approved (BKR-004489 released, replaced), confirmation succeeded and the event is SAFETY_REVIEW. |
| Status | Pass |
| Remarks | Commit: d54760c · Evidence: tests/I3/evidence/I3-T6.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-24 |
