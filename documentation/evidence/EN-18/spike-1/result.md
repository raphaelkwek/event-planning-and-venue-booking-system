## Load run: spike — all checks held

- Runner: 4 logical CPUs (INTEL(R) XEON(R) PLATINUM 8573C), 15.6 GB, Node v20.20.2, `grafana/k6:1.4.0`
- Run: https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41533430275 at `2335890`
- Configuration: seats=100, targetRate=500, duration=10s, dbPoolMax=5, distinctAttendees=one per attempt
- Duration: 10 s

| Figure | Value |
|---|---|
| Target arrival rate | 500 req/s |
| Requests completed | 4999 |
| Rate achieved (completed requests over the run) | 499.7 req/s |
| Iterations k6 had to drop (no free VU) | 2 |
| Target rate sustained | NO — the runner or the service did not hold it |
| p95, all attempts | 463.5 ms |
| p95, registered (201) | 729.3 ms |
| p95, refused (409) | 424.9 ms |
| SLO 800 ms | met at the rate achieved |

Responses: 100 registered (201), 4899 refused REGISTRATION_FULL, 0 other refusals, 0 rate-limited, 0 server errors, 0 other (timeouts); 0 withdrawals, 0 reads ok, 0 reads or withdrawals failed.

CPU used by the registration process during the load: 9.95 CPU-seconds, 1.990 ms per request, 0.95 cores on average.

| Check | Result | Detail |
|---|---|---|
| every seat is registered | held | 100 REGISTERED registrations for 100 seats |
| every seat is claimed | held | 100 seats CLAIMED of 100 |
| no over-admission | held | 100 registered, 100 seats |
| each registration has its own attendee | held | 100 distinct attendees in 100 registrations |
| each registration has its own seat | held | 100 distinct seats in 100 registrations |
| registrations and claimed seats match one to one | held | 0 registrations or seats without a match |
| one confirmation message per registration is in the outbox | held | 100 outbox rows for 100 registrations |
| k6 saw exactly as many 201s as there are registrations | held | 100 responses with status 201 |
| every other attempt was refused REGISTRATION_FULL | held | 4899 refused REGISTRATION_FULL, 0 anything else (429: 0, 5xx: 0, other: 0) |
| more attempts than seats, so the invariant was really tested | held | 4999 attempts for 100 seats |
| k6 ran to the end | held | k6 exit code 0 |

- The registration service ran from source with tsx (as `npm run dev` does), not from the container image. Steady-state CPU should be close; start-up is not.
- Identity was a stand-in that answers from the token (`load/support/identity-stub.ts`). The real hop, planning-core's GET /api/v1/users/me, adds a network call and its own CPU to every register, withdraw and my-registrations request, and is not in these numbers.
- The service's interim 120-requests-a-minute-per-address limit (ADR-0011) was raised for the run: one load generator is one address. The gateway (EN-12) owns rate limiting; it was not under test.
- k6, the service and Postgres shared one runner, so the figures are a floor for what a dedicated machine could do, not the production cluster's.
- The 500 req/s target was not sustained on this runner: k6 completed 499.7 req/s and dropped 2 iterations. The invariants above held at the rate that was achieved.
