# E5-T3 — The Lead opens an event's assignment history: each assignment's coordinator, who made it, and its start and end

## Specification

| Item | Content |
|---|---|
| Test Case ID | E5-T3 |
| Test Scenario | The Lead opens an event's assignment history: each assignment's coordinator, who made it, and its start and end |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SUBMITTED completed, then assigned to Coordinator One by `lead@connectsphere.test` (E3) and reassigned to Coordinator Two (E4).<br>3. Signed in as `lead@connectsphere.test`. |
| Test Steps | 1. Open "Assignments" and click the event's reference.<br>2. Read "Assignment history". |
| Test Data | Two assignments |
| Expected Result | The history lists, oldest first: Coordinator One, made by Lead One, with a start and an end; then Coordinator Two, made by Lead One, with a start and "Current" for its end. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-27 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The history read, oldest first: Coordinator One \| Lead One \| Wednesday 28 October 2026, 00:29 \| Wednesday 28 October 2026, 00:29; Coordinator Two \| Lead One \| Wednesday 28 October 2026, 00:29 \| Current. |
| Status | Pass |
| Remarks | Commit: 742bee5 · Evidence: tests/E5/evidence/E5-T3.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-28 |
