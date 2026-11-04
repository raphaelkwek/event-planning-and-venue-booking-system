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
| Status | Not Executed |
| Remarks | Re-checked on 4 Nov: the blocker named before is gone (EN-12's Kong gateway was built in #89), but the case still cannot pass as written. The gateway as built authenticates the token, rate-limits and adds trace headers; gateway/kong.yml has no authorisation plugin and never asks the Cerbos policy decision point, so an organiser's approve would pass the gateway and be refused by planning-core's own route gate (EN-07), not by the gateway. ADR-0010's 'the gateway evaluates the same policy bundle' is not built, and the deployed environments route through Caddy, not Kong (ADR-0016). Owning work: EN-07/EN-12. · Defect: — |
| Executed By |  |
| Date of Execution |  |
