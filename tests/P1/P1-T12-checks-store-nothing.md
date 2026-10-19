# P1-T12 — Repeated successful and shortage checks store nothing

## Specification

| Item | Content |
|---|---|
| Test Case ID | P1-T12 |
| Test Scenario | Repeated successful and shortage checks store nothing; automated real API/database verification |
| Pre-conditions | 1. Clean throwaway Postgres with all migrations applied, using the isolated environment in `tests/P1/README.md`.<br>2. The test sets technical support actor `ae111111-0000-0000-0000-000000000001`; JWT and actor resolution are stubbed. Real sign-in is outside this procedure.<br>3. Before each case the suite clears only its own fixture rows and creates the exact data below. |
| Test Steps | 1. Record `git rev-parse HEAD`.<br>2. Run `npm test -w @connectsphere/planning-core -- tests/equipment/api/p1Cards.test.ts -t 'P1-T12 '`, or run the entire suite using `npm test -w @connectsphere/planning-core` / `npm run test:coverage -w @connectsphere/planning-core` and find its named `P1-T12 ` result.<br>3. Inspect the selected test result and capture the complete output under `tests/P1/evidence/P1-T12-YYYY-MM-DD.txt`.<br>4. Compare actual assertions/results with the expected quantities and update this execution record. |
| Test Data | Check window: 2026-12-15 10:00–14:00 UTC (18:00–22:00 Asia/Singapore). Total 10; reserved 4 at 10:00–12:00; unavailable 2 at 11:00–13:00; requests 0, 4, 5, 0, 5. Fixture construction: `backend/services/planning-core/tests/equipment/api/p1Cards.test.ts`. |
| Expected Result | All five GET requests return 200. Complete before/after rows of equipment_types, equipment_units, bulk_reservations, unit_reservations and unavailability are identical, including quantity, status, timestamps and actor fields. No reservation is created. The selected test passes; the date/time identity and each stated quantity are checked against the real route response. |
| Created By | Yichen, via Codex |
| Date of Creation | 2026-10-08 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | All five requests returned 200 with availability 4 and shortfalls 0, 0, 1, 0, 1. Complete before/after rows of all five equipment tables were identical. |
| Status | Pass |
| Remarks | Commit: `a00b6bf3e17ddcd4db343e9e15e5495f61ac6c57` · Evidence: [complete planning-core output](evidence/P1-CI-2026-10-08.txt), named `P1-T12 ` case in `p1Cards.test.ts` (15/15 passed) · Defect: none observed · Story: P1, Sprint 2 · Scope: real API/Postgres with authentication stubbed |
| Executed By | Codex / GitHub Actions (throwaway Postgres) |
| Date of Execution | 2026-10-08 (Asia/Singapore) |
