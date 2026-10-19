# L5-T8 — A venue becoming unavailable never cancels the event automatically, through disruption, replacement and release

## Specification

| Item | Content |
|---|---|
| Test Case ID | L5-T8 |
| Test Scenario | A venue becoming unavailable never cancels the event automatically, through disruption, replacement and release |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed; the event is Approved. Note its status history count.<br>3. The assigned coordinator's request for `Lee Kong Chian Auditorium` 14:00–18:00 has been approved. |
| Test Steps | 1. As `venuestaff@connectsphere.test`, record a block over the booking (16:00–19:00).<br>2. Run the L5 replacement statement, and approve the replacement as `venuestaff@connectsphere.test`.<br>3. As the assigned coordinator, open the event's review page; in the SQL editor count its status history entries. |
| Test Data | Accounts: `venuestaff@connectsphere.test`, then the assigned coordinator |
| Expected Result | The event is still Approved at every step, with no new status history entry. It was never Cancelled. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-19 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The event was APPROVED before, and after the block: APPROVED; after the replacement request: APPROVED; after the approval and release: APPROVED. Its review page shows Approved, with 3 status history entries before and after. It was never Cancelled. |
| Status | Pass |
| Remarks | Commit: a97986f · Evidence: tests/L5/evidence/L5-T8.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-19 |
