# B1-T2 — The request form captures every field the story lists

## Specification

| Item | Content |
|---|---|
| Test Case ID | B1-T2 |
| Test Scenario | The request form captures every field the story lists |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed in as `organiser@connectsphere.test`. |
| Test Steps | 1. Click "New request".<br>2. Tick "Equipment is required", then click "Add equipment line".<br>3. For each field in Test Data, find an input on the form where it can be entered. |
| Test Data | Fields: event name · purpose · description · proposed date · proposed start time · proposed end time · expected attendance · venue requirements · accessibility needs · equipment requirements · whether attendee registration is required |
| Expected Result | Every one of the eleven fields has an input on the form. |
| Created By | Seann Khoo |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The form exposed inputs for event details, dates/times, attendance, venue, accessibility, equipment lines, and the registration-required flag. |
| Status | Pass |
| Remarks | Commit: b0ef6ee · Evidence: tests/B1/evidence/B1-T2-2026-09-20.png · Defect: — |
| Executed By | Joash Lau Rong Wei |
| Date of Execution | 2026-09-20 |