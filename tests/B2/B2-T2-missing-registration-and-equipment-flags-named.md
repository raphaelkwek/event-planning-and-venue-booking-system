# B2-T2 — Submitting without the registration and equipment flags names both

## Specification

| Item | Content |
|---|---|
| Test Case ID | B2-T2 |
| Test Scenario | Submitting without the registration and equipment flags names both |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed in as `organiser@connectsphere.test`. (The form always sends both flags, so this uses the API console.) |
| Test Steps | 1. Click "API console". Set Method to `POST` and Path to `/event/api/v1/events`, enter the Body from Test Data, and click "Send". |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!`<br>Body: `{"name": "Annual Research Symposium", "purpose": "Share faculty research", "description": "A one-day symposium for the school of computing.", "proposedStartAt": "2026-12-02T06:00:00.000Z", "proposedEndAt": "2026-12-02T10:00:00.000Z", "expectedAttendance": 150}` |
| Expected Result | HTTP 400 with error code `VALIDATION_FAILED`. `fields` includes `registrationRequired` ("Whether attendee registration is required must be stated.") and `equipmentRequired` ("Whether equipment is required must be stated."). |
| Created By | Seann |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | HTTP 400 VALIDATION_FAILED naming both flags — registrationRequired: "Whether attendee registration is required must be stated."; equipmentRequired: "Whether equipment is required must be stated.". |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/B2/evidence/B2-T2.png · Defect: — |
| Executed By | Joash |
| Date of Execution | 2026-09-20 |
