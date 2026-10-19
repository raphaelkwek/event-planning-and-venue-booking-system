# O2-T17 — Technical Support updates lines on screen and the coordinator is notified

## Specification

| Item | Content |
|---|---|
| Test Case ID | O2-T17 |
| Test Scenario | End-to-end in the browser: Technical Support updates a line's status and the coordinator receives the notification |
| Pre-conditions | 1. Standard environment running, `.env` has the `KAFKA_*` settings, and test data reset (`tests/README.md`).<br>2. The two Submitted lines saved in O1-T26 steps 1 to 4 (chairs and projectors) for the event, with its assigned coordinator noted. |
| Test Steps | 1. Sign in as `techsupport@connectsphere.test` and open "Equipment requests".<br>2. Click "Update" on the chairs line, choose Unavailable and leave the reason empty; click "Save status".<br>3. Enter the reason `All chairs are out at another event` and click "Save status".<br>4. Click "Update" on the projectors line, choose Substituted, pick `O1 Folding Chairs` as substitute with quantity `3`; click "Save status".<br>5. Sign out, sign in as the assigned coordinator and open "Notifications", then the equipment request for the event. |
| Test Data | As in the steps. |
| Expected Result | Step 2 shows a refusal naming the reason and the line stays Submitted. Step 3 sets Unavailable. Step 4 sets Substituted and the row shows the original projectors and the substitute chairs. The coordinator sees two notifications naming the event reference, the equipment and the new status, and the equipment request shows both new statuses. |
| Created By | Joash, via Claude |
| Date of Creation | 2026-10-10 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | UI walk-through in Chrome pending at the sprint review |
| Executed By | |
| Date of Execution | |
