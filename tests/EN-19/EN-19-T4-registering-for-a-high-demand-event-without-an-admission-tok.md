# EN-19-T4 — Registering for a high-demand event without an admission token is refused with ADMISSION_REQUIRED, and nothing is stored

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-19-T4 |
| Test Scenario | Registering for a high-demand event without an admission token is refused with ADMISSION_REQUIRED, and nothing is stored |
| Pre-conditions | 1. Dependencies installed (`npm ci`); `DATABASE_URL` pointing at a Postgres whose schemas are migrated with `npm run migrate:all` (in CI, the runner's throwaway Postgres, never the shared database). Run from the repository root.<br>2. A Confirmed, open event with 3 seats, flagged high-demand. |
| Test Steps | 1. Run `npm test -w @connectsphere/registration`.<br>2. Find the test named `EN-19-T4` in `backend/services/registration/tests/api/en19Cards.test.ts`. |
| Test Data | POST /api/v1/registrations as an attendee with no X-Admission-Token header, then with an empty one |
| Expected Result | 403 `ADMISSION_REQUIRED`, a message that says to join the waiting room first. No registration, no seat claimed (3 places remain), no outbox message. |
| Acceptance criterion | For a high-demand event the register route requires a short-lived signed admission token; a register without one is refused with a clear code. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result |  |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By |  |
| Date of Execution |  |
