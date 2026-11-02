# EN-19-T6 — The waiting room admits no more than N attendees per second for an event, however many join at once

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-19-T6 |
| Test Scenario | The waiting room admits no more than N attendees per second for an event, however many join at once |
| Pre-conditions | 1. Dependencies installed (`npm ci`); `DATABASE_URL` pointing at a Postgres whose schemas are migrated with `npm run migrate:all` (in CI, the runner's throwaway Postgres, never the shared database). Run from the repository root.<br>2. A high-demand event; the admission rate set to 50 per second. |
| Test Steps | 1. Run `npm test -w @connectsphere/registration`.<br>2. Find the test named `EN-19-T6` in `en19Cards.test.ts`, and the pure rules in `tests/domain/waitingRoom.test.ts`. |
| Test Data | 500 attendees join in the same instant (50 connections); a second event is joined alongside |
| Expected Result | All 500 get a place; their admission times are at least 20 ms apart; in every one-second window at most 50 are admitted; the last is admitted about 10 seconds after the first; the second event's first attendee is admitted at once (events do not share a queue). |
| Acceptance criterion | A waiting-room endpoint admits N per second per event. |
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
