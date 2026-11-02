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
| Actual Result | Against a flagd container serving flags/flags.flagd.json, the provider returned true with variant 'on' for a default of false, so the value came from flagd. |
| Status | Pass |
| Remarks | Commit: 62a261e · Evidence: backend/services/planning-core/tests/shared/flagdProvider.test.ts › reads change-approval from flagd, not from the default in the code (EN-15-T8), CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41512676026 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
