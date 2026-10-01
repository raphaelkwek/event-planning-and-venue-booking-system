# F1-T5 — Submitting an already-submitted request is refused, naming both statuses

## Specification

| Item | Content |
|---|---|
| Test Case ID | F1-T5 |
| Test Scenario | Submitting an already-submitted request is refused, naming both statuses |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-DRAFT completed with the standard request; note the draft **id**. Stay signed in as `organiser@connectsphere.test`. |
| Test Steps | 1. Open "API console". Set Method `POST`, Path `/api/v1/event-drafts/<id>/submit`, no Body. Click "Send".<br>2. Click "Send" again with the same settings. |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` · the standard request |
| Expected Result | Step 1 returns HTTP 201 with `"status": "SUBMITTED"`. Step 2 returns HTTP 409 with error code `DRAFT_ALREADY_SUBMITTED` and the message "This event is Submitted and cannot move to Submitted." |
| Created By | Raphael |
| Date of Creation | 2026-09-30 |

> **Expected results are checked by the PR reviewer** against F1's acceptance criteria
> (§11.12's before-code confirmation was waived for F1 by the team on 2026-09-30). The wording "Submitted … cannot move to Submitted" is what AC3
> prescribes when the current status and the target coincide; it was accepted as written
> (spec §4.1). FX-DRAFT saves the name only, so enter the standard request and "Save draft" before
> step 1.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
