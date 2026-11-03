## Load run: smoke — all checks held

- Runner: 4 logical CPUs (INTEL(R) XEON(R) PLATINUM 8573C), 15.6 GB, Node v20.20.2, `grafana/k6:1.4.0`
- Run: https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41533430275 at `2335890`
- Configuration: seats=20, targetRate=40, duration=10s, dbPoolMax=5, distinctAttendees=one per attempt
- Duration: 12 s

| Figure | Value |
|---|---|
| Target arrival rate | 40 req/s |
| Requests completed | 400 |
| Rate achieved (completed requests over the run) | 40.0 req/s |
| Iterations k6 had to drop (no free VU) | 0 |
| Target rate sustained | yes |
| p95, all attempts | 6.3 ms |
| p95, registered (201) | 73.4 ms |
| p95, refused (409) | 3.9 ms |
| SLO 800 ms | met at the rate achieved |

Responses: 20 registered (201), 380 refused REGISTRATION_FULL, 0 other refusals, 0 rate-limited, 0 server errors, 0 other (timeouts); 0 withdrawals, 0 reads ok, 0 reads or withdrawals failed.

CPU used by the registration process during the load: 1.51 CPU-seconds, 3.775 ms per request, 0.13 cores on average.

| Check | Result | Detail |
|---|---|---|
| every seat is registered | held | 20 REGISTERED registrations for 20 seats |
| every seat is claimed | held | 20 seats CLAIMED of 20 |
| no over-admission | held | 20 registered, 20 seats |
| each registration has its own attendee | held | 20 distinct attendees in 20 registrations |
| each registration has its own seat | held | 20 distinct seats in 20 registrations |
| registrations and claimed seats match one to one | held | 0 registrations or seats without a match |
| one confirmation message per registration is in the outbox | held | 20 outbox rows for 20 registrations |
| k6 saw exactly as many 201s as there are registrations | held | 20 responses with status 201 |
| every other attempt was refused REGISTRATION_FULL | held | 380 refused REGISTRATION_FULL, 0 anything else (429: 0, 5xx: 0, other: 0) |
| more attempts than seats, so the invariant was really tested | held | 400 attempts for 20 seats |
| p95 is at most 800 ms | held | p95 6.3 ms |
| k6 ran to the end | held | k6 exit code 0 |

- The registration service ran from source with tsx (as `npm run dev` does), not from the container image. Steady-state CPU should be close; start-up is not.
- Identity was a stand-in that answers from the token (`load/support/identity-stub.ts`). The real hop, planning-core's GET /api/v1/users/me, adds a network call and its own CPU to every register, withdraw and my-registrations request, and is not in these numbers.
- The service's interim 120-requests-a-minute-per-address limit (ADR-0011) was raised for the run: one load generator is one address. The gateway (EN-12) owns rate limiting; it was not under test.
- k6, the service and Postgres shared one runner, so the figures are a floor for what a dedicated machine could do, not the production cluster's.
