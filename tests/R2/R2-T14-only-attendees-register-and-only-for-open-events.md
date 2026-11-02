# R2-T14 — Cross-cutting, story-specific: only the Attendee role may register, and an event that is not open for registration is not revealed

## Specification

| Item | Content |
|---|---|
| Test Case ID | R2-T14 |
| Test Scenario | Cross-cutting, story-specific: only the Attendee role may register, and an event that is not open for registration is not revealed |
| Pre-conditions | Automated (CI), against the registration schema. |
| Test Steps | 1. Call `POST /api/v1/registrations` as an Event Organiser.<br>2. As an attendee, call it for an event in Planning.<br>3. As an attendee, call it for an event id that does not exist.<br>4. Call it without a token. |
| Test Data | An open event; an event in status Planning; a random event id |
| Expected Result | Step 1 is `403` `ROLE_NOT_AUTHORISED`. Steps 2 and 3 are both `404` `EVENT_NOT_FOUND` with the same message, so a Planning event's existence is not revealed. Step 4 is `401` `UNAUTHENTICATED`. None stores a registration. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result |  |
| Status | Not Executed |
| Remarks | Automated test written: backend/services/registration/tests/api/r2Cards.test.ts › R2-T14 lets only attendees register, and does not reveal an event that is not open (API level); not yet run: CI's integration job stops at planning-core's unrelated L3-T17 date failure (fixed by PR #82) before it reaches the registration step (commit d43fab5). Becomes Pass when that step runs green. |
| Executed By |  |
| Date of Execution |  |
