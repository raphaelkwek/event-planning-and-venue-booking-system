# C1-T4 — Saving with a one-character event name is accepted (boundary: exactly at)

## Specification

| Item | Content |
|---|---|
| Test Case ID | C1-T4 |
| Test Scenario | Saving with a one-character event name is accepted (boundary: exactly at) |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed in as `organiser@connectsphere.test`. |
| Test Steps | 1. Click "New request".<br>2. Enter the Event name.<br>3. Click "Save draft". |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` · Event name: `X` |
| Expected Result | "Saved as a draft at" followed by the time appears, and "My requests" lists "X" as a Draft. |
| Created By | Seann |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | "Saved as a draft at 3:25:54 PM." was shown, and "My requests" listed the row: —XDraft9/20/2026, 3:25:54 PM——Open draft |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/C1/evidence/C1-T4.png · Defect: — |
| Executed By | Joash |
| Date of Execution | 2026-09-20 |
