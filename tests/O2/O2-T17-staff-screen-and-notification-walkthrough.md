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
| Actual Result | Ran in the browser on CI's throwaway stack, with unique names, from O1-T26's two Submitted lines (O1 Folding Chairs × 40, O1 Projectors × 2). Technical Support chose Unavailable for the chairs with no reason and clicked "Save status": the refusal VALIDATION_FAILED named the reason ("Give a reason why the equipment is unavailable.") and the line stayed Submitted. With "All chairs are out at another event" it read "<chairs> for EVT-… is now Unavailable." and the row "Unavailable", "Reason: All chairs are out at another event". The projectors, Substituted by O1 Folding Chairs × 3, read "<projectors> for EVT-… is now Substituted." and the row kept the projectors × 2 with "Instead: <chairs> × 3". Both messages were delivered by the test harness in place of Kafka and stored, and the coordinator's Notifications read "Technical Support updated equipment for EVT-… “…”: <chairs> × 40 is now Unavailable. Reason: All chairs are out at another event" and "Technical Support updated equipment for EVT-… “…”: <projectors> × 2 is now Substituted. Substitute: <chairs> × 3.", and the event's equipment request showed both new statuses. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: 5cd14bb · Evidence: tests/e2e/o-equipment.spec.ts › O2-T17 technical support set one line Unavailable once a reason is given and substitute another, and the coordinator is told of both, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41793114951 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
