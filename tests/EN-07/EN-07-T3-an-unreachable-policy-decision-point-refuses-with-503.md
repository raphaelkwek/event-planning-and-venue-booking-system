# EN-07-T3 — When the policy decision point cannot be reached, a protected request is refused (fail closed)

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-07-T3 |
| Test Scenario | When the policy decision point cannot be reached, a protected request is refused (fail closed) |
| Pre-conditions | 1. Standard environment running (`tests/README.md`), signed in as `venue-staff@connectsphere.test`.<br>2. Stop the policy decision point, or set `CERBOS_URL` to an address nothing listens on (`http://127.0.0.1:1`) and restart planning-core. |
| Test Steps | 1. Send `POST /api/v1/venues` with a valid venue.<br>2. Send `GET /api/v1/venues`.<br>3. Check the database for the venue. |
| Test Data | Account: `venue-staff@connectsphere.test` / `ConnectSphere-Test-1234!`. `CERBOS_URL=http://127.0.0.1:1`. |
| Expected Result | Both requests are refused with `503`, code `POLICY_UNAVAILABLE`, and a message saying permissions could not be checked and nothing was changed. No venue is created. The request is never let through because the check failed. |
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
