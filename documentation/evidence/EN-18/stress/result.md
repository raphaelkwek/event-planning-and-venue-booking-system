## Load run: stress — all checks held

- Runner: 4 logical CPUs (AMD EPYC 7763 64-Core Processor), 15.6 GB, Node v20.20.2, `grafana/k6:1.4.0`
- Run: https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41533430275 at `2335890`
- Configuration: seats=250000, steps=100,250,500,750,1000,1500,2000, holdSeconds=30, rampSeconds=5, dbPoolMax=5
- Duration: 252 s

Responses: 82892 registered (201), 0 refused REGISTRATION_FULL, 0 other refusals, 0 rate-limited, 0 server errors, 0 other (timeouts); 0 withdrawals, 0 reads ok, 0 reads or withdrawals failed.

| Step | Target req/s | Requests (expected) | Failed | p95 ms | Held |
|---|---|---|---|---|---|
| 0 | 100 | 3499 (3500) | 0 | 7.1 | yes |
| 1 | 250 | 8374 (8375) | 0 | 9.2 | yes |
| 2 | 500 | 14859 (16875) | 0 | 6001.3 | no |
| 3 | 750 | 14569 (25625) | 0 | 10323.8 | no |
| 4 | 1000 | 13848 (34375) | 0 | 10295.5 | no |
| 5 | 1500 | 13953 (51250) | 0 | 10331.2 | no |
| 6 | 2000 | 13790 (68750) | 0 | 10190.7 | no |

Highest step that held before the first break: 250 req/s. First step that broke: 500.

CPU used by the registration process during the load: 217.33 CPU-seconds, 2.622 ms per request, 0.86 cores on average.

| Check | Result | Detail |
|---|---|---|
| no seat is held twice | held | 82892 distinct seats in 82892 registrations |
| no attendee holds two seats | held | 82892 distinct attendees in 82892 registrations |
| registrations equal claimed seats | held | 82892 registered, 82892 claimed, 0 unmatched |
| no over-admission | held | 82892 registered, 250000 seats |
| every 201 k6 saw is a registration in the database | held | k6 saw 82892, the database holds 82892 |
| k6 ran to the end | held | k6 exit code 99 |

- The registration service ran from source with tsx (as `npm run dev` does), not from the container image. Steady-state CPU should be close; start-up is not.
- Identity was a stand-in that answers from the token (`load/support/identity-stub.ts`). The real hop, planning-core's GET /api/v1/users/me, adds a network call and its own CPU to every register, withdraw and my-registrations request, and is not in these numbers.
- The service's interim 120-requests-a-minute-per-address limit (ADR-0011) was raised for the run: one load generator is one address. The gateway (EN-12) owns rate limiting; it was not under test.
- k6, the service and Postgres shared one runner, so the figures are a floor for what a dedicated machine could do, not the production cluster's.
- Reaching a break is a finding, not a failure: the run fails only if an invariant failed. A step's first five seconds are the ramp up from the step before.
