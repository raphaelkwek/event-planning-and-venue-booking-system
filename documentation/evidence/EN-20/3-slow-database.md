# Experiment 3: a slow database never causes over-admission

**Status:** Run in CI (Toxiproxy and k6): the seats stayed exact; the latency objective was not met
**Card:** EN-20-T3 · **Run:** https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41533430275 · **Commit:** `faf5ebc` · **Date:** 2026-11-03

## Hypothesis

With 500 ms of latency on every answer the registration service gets from its database, requests are far slower, but the seat count stays
exact: no more registrations than seats, and every 201 a client was told is a registration the database holds.

## Injection

The registration service (a real process) reaches Postgres only through Toxiproxy, with a `latency` toxic of 500 ms on the answers. A k6
closed-model burst (600 attempts from 600 distinct attendees, 100 in flight) goes at an event with 100 seats. The same burst shape
(300 attempts, 50 in flight, 100 seats) first runs with no toxic as the baseline. The pool is 50 connections for this run, so the burst is limited by the slow database and not by the
pool's queue. The database is read back directly, not through the proxy. Test: `chaos/experiments/03-slow-database.test.ts`; k6 script: `load/k6/burst.js`.
Staging manifest, not applied: [`deploy/chaos/03-registration-db-latency.yaml`](../../../deploy/chaos/03-registration-db-latency.yaml).

## Pass condition

Registrations never exceed 100; they equal the 201 responses and the claimed seats; no seat or attendee appears twice; each has its message in the outbox.

## Actual result

| Observation | Value |
|---|---|
| Attempts completed | 600 |
| 201 registered | 100 |
| 409 REGISTRATION_FULL | 500 |
| Server errors, timeouts, rate limits, anything else | 0 |
| Registrations in the database | 100 (seats claimed 100, distinct attendees 100, distinct seats 100, unmatched 0, outbox rows 100) |
| p95 latency of a register attempt, baseline (no toxic) | 472 ms |
| p95 latency of a register attempt, with the toxic | 15097 ms |
| The 800 ms objective with the toxic | NOT met |
| Duration of the slow burst | 57 s |

The seat invariant held: exactly 100 registrations for 100 seats, every one a distinct attendee in a distinct seat, and k6 saw exactly 100 201s.
The latency objective did not hold, and was not expected to: the design's pass condition also has the gateway shedding load and the burn-rate alert firing,
and neither exists on this branch (EN-12, EN-17). Only the seats half of that condition was testable.

Run: https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41533430275

## Fix log

- **Open, not fixed here: the service has no per-request time limit and sheds no load.** With every database answer 500 ms late, a request waited in the pool's queue
  and in its own transaction until it finished, so p95 was 15.1 s against 0.47 s without the toxic (k6 would have given up at 30 s). It was correct, but a person
  would have seen a spinner for 15 s. The cure is the one the architecture names (explicit timeouts, load shedding with 429 or 503 and Retry-After at the gateway, ADR-0011),
  which belongs to EN-12 and is more than a small change here.
- Not a defect: the default pool of 5 connections (`REGISTRATION_DB_POOL_MAX`) would make this worse, since each transaction holds a connection across several round trips (begin, check, claim, insert, outbox, commit), each 500 ms late. This run used 50.
