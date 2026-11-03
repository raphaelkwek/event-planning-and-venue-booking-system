# EN-14-T2 — The fake Supabase Auth server refuses to run outside the test harness

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-14-T2 |
| Test Scenario | The fake Supabase Auth server refuses to run outside the test harness |
| Pre-conditions | Dependencies installed. No database is needed. |
| Test Steps | 1. Run `npx tsx --test tests/e2e/support/fake-supabase-auth.test.ts` (also run by `npm run test:scripts` in the unit job).<br>2. Read the `assertTestHarnessOnly` cases. |
| Test Data | The literal environments in the test: no flag, a wrong flag value, a Supabase-hosted `DATABASE_URL`, an empty and a malformed one, and `NODE_ENV=production`. |
| Expected Result | Each of those environments is refused with an error and the server does not start. Only the exact flag with a database on `127.0.0.1` or `localhost` is accepted. The server listens on `127.0.0.1` only. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Every listed environment was refused and only the exact flag with a loopback database was accepted; the server's URL was http://127.0.0.1:<port>. |
| Status | Pass |
| Remarks | Automated in CI (unit job and e2e job). Commit: 6080462 · Evidence: tests/e2e/support/fake-supabase-auth.test.ts (unit job, npm run test:scripts) › assertTestHarnessOnly: allows the harness; refuses without the flag, or with any other value; refuses a shared or remote database, a missing one, and a malformed one; refuses a production process; listens on the loopback address only, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
