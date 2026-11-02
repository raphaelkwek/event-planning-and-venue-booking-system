# EN-19-T15 — The organiser flags an event high-demand on the registration settings screen, which explains what it does

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-19-T15 |
| Test Scenario | The organiser flags an event high-demand on the registration settings screen, which explains what it does |
| Pre-conditions | 1. Dependencies installed (`npm ci`).<br>2. The registration settings screen for an Approved event; the API faked at the fetch boundary. |
| Test Steps | 1. Run `npm test -w @connectsphere/web`.<br>2. Find the tests named `EN-19-T15` in `frontend/tests/registrationSettings.test.tsx`. |
| Test Data | Tick the high-demand box and save; the server refuses with a stale version |
| Expected Result | The box is described as putting attendees in a queue before they can register. Saving sends `highDemand: true` with the version loaded in If-Match, and the screen shows the saved state. A stale version shows the server's message and leaves the box as it was. |
| Acceptance criterion | An organiser can mark an event high-demand. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result |  |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By |  |
| Date of Execution |  |
