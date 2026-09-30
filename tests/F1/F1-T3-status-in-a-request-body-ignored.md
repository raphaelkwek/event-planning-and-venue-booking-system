# F1-T3 — A status sent in a request body does not change the event's status

## Specification

| Item | Content |
|---|---|
| Test Case ID | F1-T3 |
| Test Scenario | A status sent in a request body does not change the event's status |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-DRAFT completed; note the draft **id**. Stay signed in as `organiser@connectsphere.test`. |
| Test Steps | 1. Open "API console". Set Method `PUT`, Path `/api/v1/event-drafts/<id>`, and the Body from Test Data. Click "Send".<br>2. In the Supabase SQL editor, run the query from Test Data. |
| Test Data | Body: `{ "name": "Annual Research Symposium", "status": "APPROVED" }`<br>Query: `select status from event.events where id = '<id>';` |
| Expected Result | The response is HTTP 200 and its body shows `"status": "DRAFT"`. The query returns `DRAFT`. |
| Created By | Raphael |
| Date of Creation | 2026-09-30 |

> **Expected results are checked by the PR reviewer** against F1's acceptance criteria
> (§11.12's before-code confirmation was waived for F1 by the team on 2026-09-30).

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
