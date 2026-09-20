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
| Created By | Seann |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | "Saved as a draft at 3:26:19 PM." was shown. Last saved moved from Sun Sep 20 2026 15:26:15 GMT+0800 (Singapore Standard Time) to Sun Sep 20 2026 15:26:19 GMT+0800 (Singapore Standard Time) and the status stayed Draft. |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/C2/evidence/C2-T2.png · Defect: — |
| Executed By | Joash |
| Date of Execution | 2026-09-20 |
