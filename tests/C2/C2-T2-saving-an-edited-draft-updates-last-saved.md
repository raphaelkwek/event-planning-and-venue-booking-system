# C2-T2 — Saving an edited draft updates the last-saved time and keeps it a Draft

## Specification

| Item | Content |
|---|---|
| Test Case ID | C2-T2 |
| Test Scenario | Saving an edited draft updates the last-saved time and keeps it a Draft |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-DRAFT with Event name `Untitled idea` completed.<br>3. Signed in as `organiser@connectsphere.test`; in "My requests", note the Last saved time, then wait at least one minute. |
| Test Steps | 1. Click "Open draft" on "Untitled idea".<br>2. Enter the Purpose in Test Data.<br>3. Click "Save draft".<br>4. Click "My requests". |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` · Purpose: `Now decided` |
| Expected Result | Step 3 shows "Saved as a draft at" with a new time. In step 4 the Last saved time is later than the one noted, and the status is still "Draft". |
| Created By | Seann, via Claude |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
