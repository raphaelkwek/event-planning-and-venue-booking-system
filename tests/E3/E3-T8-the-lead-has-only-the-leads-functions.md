# E3-T8 — The Event Coordinator Lead is a role of its own (A2): its navigation shows only its functions, and coordinator actions are refused

## Specification

| Item | Content |
|---|---|
| Test Case ID | E3-T8 |
| Test Scenario | The Event Coordinator Lead is a role of its own (A2): its navigation shows only its functions, and coordinator actions are refused |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SUBMITTED completed, assigned to Coordinator One by the Lead, and opened by Coordinator One (FX-UNDER-REVIEW). |
| Test Steps | 1. Sign in as `lead@connectsphere.test` and read the navigation.<br>2. Through the API console, send `POST /api/v1/events/<id>/approve` as the Lead.<br>3. Read the request's status. |
| Test Data | The request Under Review |
| Expected Result | The header names the role "Event Coordinator Lead". The navigation shows "Unassigned" and "Notifications", and none of the coordinator's (review queue, booking requests, venue search). The approval is refused, saying the role is not authorised; the request is still Under Review. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-27 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
