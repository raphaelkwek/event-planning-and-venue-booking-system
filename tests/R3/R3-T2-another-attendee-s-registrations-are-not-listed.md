# R3-T2 — Registrations belonging to other attendees are never listed

## Specification

| Item | Content |
|---|---|
| Test Case ID | R3-T2 |
| Test Scenario | Registrations belonging to other attendees are never listed |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it).<br>2. FX-R-EVENT run with its defaults, then FX-R-OTHER-ATTENDEE on it.<br>3. Signed in as `attendee@connectsphere.test` / `ConnectSphere-Test-1234!`. |
| Test Steps | 1. Click "My registrations". |
| Test Data | One registration for another attendee (`00000000-0000-0000-0000-0000000000a5`), none for Attendee One |
| Expected Result | The list is empty and says `You have no registrations yet.`. The other attendee's registration is not shown. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result |  |
| Status | Not Executed |
| Remarks | Covered by backend/services/registration/tests/api/r3Cards.test.ts › R3-T2 never lists another attendee's registrations (API level), not yet run: CI's integration job stops at planning-core's unrelated L3-T17 date failure (fixed by PR #82) before it reaches the registration step (commit d43fab5). UI walk-through in Chrome pending at the sprint review. |
| Executed By |  |
| Date of Execution |  |
