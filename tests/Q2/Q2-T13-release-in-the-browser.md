# Q2-T13 — Technical Support releases on screen and the coordinator removes a Reserved line

## Specification

| Item | Content |
|---|---|
| Test Case ID | Q2-T13 |
| Test Scenario | End-to-end in the browser: the Release form, the reason check, the Remove dialog and the coordinator's notifications |
| Pre-conditions | 1. Standard environment running, `.env` has the `KAFKA_*` settings, and test data reset (`tests/README.md`); migrations applied.<br>2. A Reserved chairs line left by Q1-T14's walkthrough (or reserve one the same way), with its assigned coordinator noted. |
| Test Steps | 1. Sign in as `techsupport@connectsphere.test` and open "Equipment requests".<br>2. Click "Release" on the Reserved chairs line.<br>3. Leave Reason empty and click "Release reservation".<br>4. Enter `Event moved` as the reason and click "Release reservation".<br>5. Reserve the same line again.<br>6. Sign out, sign in as the assigned coordinator, and open the event's equipment request.<br>7. Click "Remove" on the Reserved line and confirm.<br>8. Open "Notifications". |
| Test Data | As in the steps. |
| Expected Result | Step 3 shows a reason-required message inline and the line stays Reserved. Step 4 succeeds with the banner "Equipment released", and the row shows Confirmed with Reserve available again. In step 7 the Remove dialog warns that the equipment will be released, and afterwards the line is Removed. The coordinator has notifications naming the event and "released". |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-16 |

> **Expected results are checked by the PR reviewer** against Q2's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Waits for migrations equipment/0005–0008 on the shared database, applied after #42 and #44 merge (`npm run migrate -- equipment`). Commit: · Evidence: · Defect: — |
| Executed By | |
| Date of Execution | |
