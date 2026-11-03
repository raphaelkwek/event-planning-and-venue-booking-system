# EN-07-T4 — The staff console's navigation and route guard show only what the policy decision point allows the signed-in role

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-07-T4 |
| Test Scenario | The staff console's navigation and route guard show only what the policy decision point allows the signed-in role |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`). |
| Test Steps | 1. Sign in as `organiser@connectsphere.test` and read the navigation.<br>2. Sign out, sign in as `venue-staff@connectsphere.test` and read the navigation.<br>3. As Venue Staff, open `http://localhost:5173/#/queue` directly. |
| Test Data | Accounts: `organiser@connectsphere.test`, `venue-staff@connectsphere.test` / `ConnectSphere-Test-1234!`. |
| Expected Result | The console asks planning-core's `POST /api/v1/permissions/check` once per session for the resource and action behind each screen. The organiser's navigation offers My requests and New request and no Review queue; Venue Staff's offers Booking requests and Hold requests and no Review queue. Opening the review queue as Venue Staff lands on their own start page. The console holds no list of roles per screen. |
| Acceptance criterion | AC1: Cerbos policies in the repo, evaluated by the gateway, the services and the SPA's navigation. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
