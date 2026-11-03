## Load run: soak — all checks held

- Runner: 4 logical CPUs (AMD EPYC 7763 64-Core Processor), 15.6 GB, Node v20.20.2, `grafana/k6:1.4.0`
- Run: https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41533430275 at `2335890`
- Configuration: events=10, seatsPerEvent=3000, rate=100, minutes=5, dbPoolMax=5, mix=50% browse, 20% event page, 10% my registrations, 20% register then withdraw
- Duration: 301 s

Responses: 6000 registered (201), 0 refused REGISTRATION_FULL, 0 other refusals, 0 rate-limited, 0 server errors, 0 other (timeouts); 6000 withdrawals, 24000 reads ok, 0 reads or withdrawals failed.

CPU used by the registration process during the load: 87.53 CPU-seconds, 2.431 ms per request, 0.29 cores on average.

Resident memory: 151 MB in the second minute, 154 MB in the last minute (1.9%).

| Check | Result | Detail |
|---|---|---|
| no 5xx, 429 or timeouts on register | held | 429: 0, 5xx: 0, other: 0 |
| every read answered 200 | held | 24000 reads ok, 0 failed |
| every withdrawal answered 200 | held | 6000 withdrawn, 0 failed |
| every seat claimed has an active registration, and the reverse | held | 0 without a match |
| registrations in the database match the 201s k6 saw | held | 0 registered + 6000 withdrawn = 6000, k6 saw 6000 |
| withdrawals in the database match the 200s k6 saw | held | 6000 withdrawn rows, k6 saw 6000 |
| register p95 is at most 800 ms | held | p95 8.7 ms |
| read p95 is at most 400 ms | held | p95 7.5 ms |
| resident memory grew by at most 25% from minute 1 to the last minute | held | 151 MB to 154 MB (1.9%) |
| k6 ran to the end | held | k6 exit code 0 |

- The registration service ran from source with tsx (as `npm run dev` does), not from the container image. Steady-state CPU should be close; start-up is not.
- Identity was a stand-in that answers from the token (`load/support/identity-stub.ts`). The real hop, planning-core's GET /api/v1/users/me, adds a network call and its own CPU to every register, withdraw and my-registrations request, and is not in these numbers.
- The service's interim 120-requests-a-minute-per-address limit (ADR-0011) was raised for the run: one load generator is one address. The gateway (EN-12) owns rate limiting; it was not under test.
- k6, the service and Postgres shared one runner, so the figures are a floor for what a dedicated machine could do, not the production cluster's.
