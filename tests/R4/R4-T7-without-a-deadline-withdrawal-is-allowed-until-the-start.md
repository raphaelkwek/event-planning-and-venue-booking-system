# R4-T7 — With no deadline set, withdrawal is permitted up to the event's start date/time and refused after it

## Specification

| Item | Content |
|---|---|
| Test Case ID | R4-T7 |
| Test Scenario | With no deadline set, withdrawal is permitted up to the event's start date/time and refused after it |
| Pre-conditions | Automated (CI), against the registration schema, with the clock fixed: no deadline, the event starts at 2026-12-16T06:00:00.000Z. |
| Test Steps | 1. Withdraw exactly at the start.<br>2. On a second registration, withdraw one millisecond after the start. |
| Test Data | No deadline · start `2026-12-16T06:00:00.000Z` (Wednesday 16 December 2026, 14:00 Singapore time) |
| Expected Result | Step 1 is accepted. Step 2 is `422` `WITHDRAWAL_DEADLINE_PASSED`, naming the event's start as the deadline, and the registration stays `REGISTERED`. |
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
