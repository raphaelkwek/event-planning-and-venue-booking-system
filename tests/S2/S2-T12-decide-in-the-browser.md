# S2-T12 — The coordinator approves and rejects on screen and the organiser sees both outcomes

## Specification

| Item | Content |
|---|---|
| Test Case ID | S2-T12 |
| Test Scenario | End-to-end in the browser: approve with confirmation, reject with a required reason, no further actions on decided requests, and the organiser's request pages and notifications |
| Pre-conditions | 1. Standard environment running, `.env` has the `KAFKA_*` settings, and test data reset (`tests/README.md`); migrations applied, including `change/0001` to `change/0003` (`npm run migrate -- change`).<br>2. Two Approved requests of `organiser@connectsphere.test` (FX-APPROVED in `tests/README.md`), each with a pending change request raised as in S1-T13, and their assigned coordinator noted. |
| Test Steps | 1. Sign in as the assigned coordinator, open the first request's review page and click "Approve change", then "Confirm approval".<br>2. Open the second request's review page, click "Reject change" and click "Confirm rejection" with the reason empty.<br>3. Enter `No larger hall` as the reason and click "Confirm rejection".<br>4. Reopen both review pages.<br>5. Sign out, sign in as `organiser@connectsphere.test`, open both requests, then "Notifications". |
| Test Data | As in the steps. |
| Expected Result | Step 1 applies the change and the page shows "Change approved on <date>". Step 2 refuses the empty reason inline and sends nothing. Step 3 shows "Change rejected on <date>: No larger hall". In step 4 neither page offers "Approve change" or "Reject change". In step 5 the first request shows "Change approved on <date>" with the new values, the second shows "Change rejected on <date>: No larger hall", "Request a change" is offered again on both, and Notifications has two entries, one for each outcome. |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-18 |

> **Expected results are checked by the PR reviewer** against S2's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Waits for the S2 implementation and migrations change/0002 and change/0003 on the shared database, applied after the S2 PR merges (`npm run migrate -- change`). Commit: · Evidence: · Defect: — |
| Executed By | |
| Date of Execution | |
