# R3-T6 — Boundary: an attendee with no registrations sees an empty state, not an error

## Specification

| Item | Content |
|---|---|
| Test Case ID | R3-T6 |
| Test Scenario | Boundary: an attendee with no registrations sees an empty state, not an error |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it).<br>2. Signed in as `attendee@connectsphere.test` / `ConnectSphere-Test-1234!`. (Attendee One has no registrations after the reset.) |
| Test Steps | 1. Click "My registrations". |
| Test Data | No registrations |
| Expected Result | The page shows `You have no registrations yet.` and a link to "Events". No error is shown. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
