# Experiment 4: a public outage does not reach staff

**Status:** Run in CI (process stop): staff were unaffected; the browse-from-cache half is not built
**Card:** EN-20-T4 · **Run:** https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41533430275 · **Commit:** `faf5ebc` · **Date:** 2026-11-03

## Hypothesis

With the registration service down, every staff function in planning-core answers exactly as before, as fast as before; the public registration routes are refused at the connection;
and when the registration service starts again the public routes work.

## Injection

Real processes on one throwaway Postgres: the registration service, planning-core, and the CI-only fake Supabase Auth (EN-14). The registration process is killed with `SIGKILL`, then started again.
Staff calls, signed in as the seeded accounts: `organiser GET /api/v1/users/me`, `organiser GET /api/v1/events`, `coordinator GET /api/v1/events`, `venuestaff GET /api/v1/venues`. Test: `chaos/experiments/04-public-outage.test.ts`.
Staging manifest, not applied: [`deploy/chaos/04-registration-down.yaml`](../../../deploy/chaos/04-registration-down.yaml).

## Pass condition

During the outage the staff calls return the same status and the same body as before, with p95 inside the objective of 400 ms for reads; the public routes fail to connect; after the restart they answer 200.

## Actual result

| Observation | Value |
|---|---|
| Staff statuses before / during / after | [200, 200, 200, 200] / [200, 200, 200, 200] / [200, 200, 200, 200] |
| Staff answers during the outage identical to before | yes |
| Staff p95 before / during | 4.3 ms / 3.3 ms (objective 400 ms) |
| Public routes while down (`/healthz`, browse, register) | ECONNREFUSED, ECONNREFUSED, ECONNREFUSED |
| Browse after the restart | 200 |

The hypothesis held for the staff half.

**Not shown, and not claimed:** "browsing works from cache". That needs the CDN (EN-12), which does not exist yet. With the registration service down, attendees cannot browse. The staff latency figures
are one request at a time on an idle machine, not staff under load.

Run: https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41533430275

## Fix log

None needed. The experiment found no defect. Open item: the browse-from-cache half stays open until EN-12 lands.
