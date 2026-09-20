# A3-T2 — An organiser opening another organiser's request by direct link gets no event data

## Specification

| Item | Content |
|---|---|
| Test Case ID | A3-T2 |
| Test Scenario | An organiser opening another organiser's request by direct link gets no event data |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. As `organiser2@connectsphere.test`: FX-SUBMITTED; note the request id; sign out. |
| Test Steps | 1. Go to http://localhost:5173 and sign in as `organiser@connectsphere.test`.<br>2. In the address bar, go to http://localhost:5173/#/requests/<id>. |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` · id: from the pre-condition |
| Expected Result | A refusal titled `EVENT_NOT_FOUND` reads "No event with that reference is available to you." (HTTP 404). No event name, purpose, description or other detail of the request is shown. |
| Created By | Seann |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Refused with "EVENT_NOT_FOUNDNo event with that reference is available to you.HTTP 404 · correlation 165acac1-a8a9-40b0-a892-82c74ad0681c". Neither the name, purpose nor description of the other organiser's request was shown. |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/A3/evidence/A3-T2.png · Defect: — |
| Executed By | Joash |
| Date of Execution | 2026-09-20 |
