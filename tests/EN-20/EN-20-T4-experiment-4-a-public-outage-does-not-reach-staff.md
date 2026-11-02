# EN-20-T4 — Experiment 4: a public outage does not reach staff

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-20-T4 |
| Test Scenario | Experiment 4: a public outage does not reach staff |
| Pre-conditions | 1. Run in the `Load and chaos` workflow: throwaway Postgres, the CI-only fake Supabase Auth, planning-core and the registration service as real processes. |
| Test Steps | 1. Sign in as a staff member and call staff endpoints; record status and body.<br>2. Stop the registration service (kill the process).<br>3. Call the same staff endpoints again, and the public registration endpoints.<br>4. Start the registration service again. |
| Test Data | The seeded organiser and coordinator accounts. |
| Expected Result | With registration down, the staff endpoints answer exactly as before (same status, same body) and the public endpoints are refused at the connection. After the restart the public endpoints answer again. The browse-from-cache half needs the CDN (EN-12) and is not claimed. |
| Acceptance criterion | Experiment 4: registration service down; staff functions unaffected. Run in CI if simple. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | With the registration process killed, the four staff calls returned 200 with bodies identical to before (p95 3.3 ms during the outage, 4.3 ms before); the three public calls failed with ECONNREFUSED; after the restart browsing answered 200 and the staff calls were unchanged. The browse-from-cache half is not claimed (no CDN). |
| Status | Pass |
| Remarks | Automated (load and chaos run in CI) · Commit: faf5ebc · Evidence: `chaos/experiments/04-public-outage.test.ts` › Experiment 4: a public outage does not reach staff › staff functions answer exactly as before while registration is down, and the public routes return when it is back (EN-20-T4), CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41533430275 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
