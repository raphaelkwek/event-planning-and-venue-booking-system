# EN-19-T12 — Joining again keeps the attendee's place, even when many requests arrive at once

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-19-T12 |
| Test Scenario | Joining again keeps the attendee's place, even when many requests arrive at once |
| Pre-conditions | 1. Dependencies installed (`npm ci`); `DATABASE_URL` pointing at a Postgres whose schemas are migrated with `npm run migrate:all` (in CI, the runner's throwaway Postgres, never the shared database). Run from the repository root.<br>2. A high-demand event; two attendees. |
| Test Steps | 1. Run `npm test -w @connectsphere/registration`.<br>2. Find the test named `EN-19-T12` in `en19Cards.test.ts`. |
| Test Data | One attendee joins, then joins again; another sends 20 joins at once |
| Expected Result | The second join returns 200 with the same entry id and the same position as the first (the first was 201). The 20 simultaneous joins make exactly one entry, and every response names it. |
| Acceptance criterion | Each attendee gets a queue position: one place per attendee, not one per click. |
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
