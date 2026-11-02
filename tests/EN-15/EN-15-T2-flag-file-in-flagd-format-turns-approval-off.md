# EN-15-T2 — A committed flagd-format flag file drives evaluation; off means off

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-15-T2 |
| Test Scenario | A committed flagd-format flag file drives evaluation; off means off |
| Pre-conditions | 1. Dependencies installed. |
| Test Steps | 1. Start the flag service with FLAGD_OFFLINE_FLAG_SOURCE_PATH pointing at a file whose defaultVariant for change-approval is 'off'.<br>2. Evaluate change-approval.<br>3. Repeat with the committed flags/flags.flagd.json.<br>4. Point it at a missing file. |
| Test Data | A temp file in flagd format with change-approval off; the committed file flags/flags.flagd.json. |
| Expected Result | With the temp file: false, source 'file'. With the committed file: true (the committed default is on). A missing file falls back to the default (true) without crashing. |
| Acceptance criterion | Flag is read from a file in flagd format when flagd is not configured. |
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
