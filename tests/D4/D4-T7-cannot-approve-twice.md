# D4-T7 — A request that already carries a decision cannot be approved again, and no second approval time is written

## Specification

| Item | Content |
|---|---|
| Test Case ID | D4-T7 |
| Test Scenario | A request that already carries a decision cannot be approved again, and no second approval time is written |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-APPROVED completed; note the request id and the "Decided" time shown. The coordinator is on the review screen. |
| Test Steps | 1. Check the "Approve" button.<br>2. Click "API console". Set Method to `POST` and Path to `/event/api/v1/events/<id>/approve`, leave Body empty, and click "Send".<br>3. Go to http://localhost:5173/#/review/<id>. |
| Test Data | Account: `coordinator@connectsphere.test` / `ConnectSphere-Test-1234!` · id: from the pre-condition |
| Expected Result | In step 1 "Approve" is disabled. Step 2 is refused with HTTP 409. In step 3 the "Decided" time is exactly the one noted. |
| Created By | Seann Khoo |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | A second approval through the API console was refused and the decision time was unchanged. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6080462 · Evidence: tests/e2e/d-review.spec.ts › D4-T7 a request that already carries a decision cannot be approved again, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
