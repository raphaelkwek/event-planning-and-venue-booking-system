# EN-07-T13 — The API gateway refuses a role the policies never allow, before the request reaches a service

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-07-T13 |
| Test Scenario | The API gateway refuses a role the policies never allow, before the request reaches a service |
| Pre-conditions | 1. The API gateway (EN-12) deployed in front of planning-core, configured with the same policy decision point. |
| Test Steps | 1. As `organiser@connectsphere.test`, send `POST /api/v1/events/<id>/approve` through the gateway. |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!`. |
| Expected Result | The gateway refuses with `403 ROLE_NOT_AUTHORISED`, and planning-core receives no request. |
| Acceptance criterion | AC1: Cerbos policies in the repo, evaluated by the gateway, the services and the SPA's navigation. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result |  |
| Status | Blocked |
| Remarks | Blocked: the API gateway (EN-12) is not built, so there is no gateway to send the request through. It would ask the same PDP. · Defect: — |
| Executed By |  |
| Date of Execution |  |
