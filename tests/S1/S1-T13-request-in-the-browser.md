# S1-T13 — The organiser requests a change on screen and the coordinator sees it

## Specification

| Item | Content |
|---|---|
| Test Case ID | S1-T13 |
| Test Scenario | End-to-end in the browser: the unchanged form, the missing reason, the pending notice and the coordinator's notification |
| Pre-conditions | 1. Standard environment running, `.env` has the `KAFKA_*` settings, and test data reset (`tests/README.md`); migrations applied, including `change/0001` (`npm run migrate -- change`).<br>2. An Approved request of `organiser@connectsphere.test` (FX-APPROVED in `tests/README.md`), with its assigned coordinator noted. |
| Test Steps | 1. Sign in as `organiser@connectsphere.test`, open the request and click "Request a change".<br>2. Click "Send request" without changing anything.<br>3. Change the expected attendance to `180`, leave Reason empty, and click "Send request".<br>4. Enter `More people registered` as the Reason and click "Send request".<br>5. Sign out, sign in as the assigned coordinator, open "Notifications", then the request. |
| Test Data | As in the steps. |
| Expected Result | Step 2 says no change was made and sends nothing. Step 3 refuses the empty reason inline. Step 4 succeeds and the page shows "Change requested on <date>: expected attendance (Pending)" with no "Request a change" button. The coordinator has a notification naming the request, and the request shows the same pending notice. |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-17 |

> **Expected results are checked by the PR reviewer** against S1's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Waits for the S1 implementation and migration change/0001 on the shared database, applied after the S1 PR merges (`npm run migrate -- change`). Commit: · Evidence: · Defect: — |
| Executed By | |
| Date of Execution | |
