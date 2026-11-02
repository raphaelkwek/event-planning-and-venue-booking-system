# R3-T7 — Cross-cutting, story-specific: a staff role cannot list registrations through the attendee API

## Specification

| Item | Content |
|---|---|
| Test Case ID | R3-T7 |
| Test Scenario | Cross-cutting, story-specific: a staff role cannot list registrations through the attendee API |
| Pre-conditions | Automated (CI), against the registration schema. |
| Test Steps | 1. Call `GET /api/v1/registrations` as an Event Organiser.<br>2. Call it without a token. |
| Test Data | Organiser and no token |
| Expected Result | Step 1 is `403` `ROLE_NOT_AUTHORISED` and step 2 `401` `UNAUTHENTICATED`; neither returns registration data. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result |  |
| Status | Not Executed |
| Remarks | Automated test written: backend/services/registration/tests/api/r3Cards.test.ts › R3-T7 a staff role has no registrations to list here, and a request without a token is refused (API level); not yet run: CI's integration job stops at planning-core's unrelated L3-T17 date failure (fixed by PR #82) before it reaches the registration step (commit d43fab5). Becomes Pass when that step runs green. |
| Executed By |  |
| Date of Execution |  |
