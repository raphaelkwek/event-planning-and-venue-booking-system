# EN-15-T8 — The flagd provider reads a real flagd (CI service container)

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-15-T8 |
| Test Scenario | The flagd provider reads a real flagd (CI service container) |
| Pre-conditions | 1. CI only: ghcr.io/open-feature/flagd as a service container with the committed flag file mounted. Not run locally (no Docker). |
| Test Steps | 1. Start the flag service with FLAGD_HOST=127.0.0.1 and FLAGD_PORT=8013.<br>2. Evaluate change-approval. |
| Test Data | flags/flags.flagd.json served by flagd. |
| Expected Result | Source 'flagd'; change-approval is true, read from flagd rather than the in-code default. |
| Acceptance criterion | flagd integration as the acceptance criterion names it. |
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
