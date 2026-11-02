# EN-18: load tests and autoscaling, with the results

**Run:** <https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41533430275> (workflow `Load and chaos`, head commit `faf5ebc`, 3 Nov 2026).
Every figure below is read from the files in this folder, which are the run's own outputs: `k6-summary.json` (k6's summary), `result.json` and `result.md` (the harness's verdict
and write-up) per scenario, and `usage-samples.json` (the service's memory and CPU, sampled every 10 s) for the soak and stress. Index of the whole reliability work: [`documentation/reliability.md`](../../reliability.md).

**Read this first.** These are measurements of the registration service on a shared 4-vCPU GitHub runner, with k6, the service and Postgres on the same machine, an identity stand-in in place of
planning-core, and the service run from source. They show the seat count is exact under load and give a measured CPU cost per request. They do not show how the system behaves in Kubernetes: **nothing here ran in a cluster, and the autoscaling is tuned from these single-machine figures and was not
demonstrated.** The runner's hardware also differs between jobs and between runs (the table below names the CPU model), which moves the latency figures.

## The spike: 500 requests a second for 100 seats

k6 sends `POST /api/v1/registrations` at a constant arrival rate of 500 a second for 10 seconds, each request from a different attendee, at one event with exactly 100 seats. The harness then reads the database.
It ran three times in the same job, each on a fresh event.

| Run | Requests | Rate achieved | k6 iterations dropped | p95, all | p95, the 100 registered | p95, the refused | Registered | Over-admission |
|---|---|---|---|---|---|---|---|---|
| spike-1 | 4,999 | 499.7 req/s | 2 | 463 ms | 729 ms | 425 ms | **100** | **0** |
| spike-2 | 5,001 | 499.9 req/s | 0 | 401 ms | 613 ms | 377 ms | **100** | **0** |
| spike-3 | 5,001 | 499.9 req/s | 0 | 411 ms | 612 ms | 376 ms | **100** | **0** |

In every run, exactly 100 registrations and 100 claimed seats, each a different attendee in a different seat; k6 saw exactly 100 responses with status 201; every other attempt got `409 REGISTRATION_FULL`, with no 429, no 5xx and no timeout; and
each registration has its confirmation message in the outbox. The runner held the rate in the sense that matters (499.7 to 499.9 req/s completed); the first run dropped two iterations while the process warmed up, so the harness reports "not sustained" for it, strictly.

**The 800 ms objective** (p95 of registration submit latency at 500 req/s) was met at the rate achieved in all three of these runs, on an Intel Xeon Platinum 8573C runner. It is not a comfortable margin, and it depends on the machine GitHub assigns.
A later run of the same code (run [41535317066](https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41535317066), files not kept here) landed on an AMD EPYC 7763 runner:

| Run (AMD EPYC 7763) | Rate achieved | k6 iterations dropped | p95, all | p95, the 100 registered | Registered |
|---|---|---|---|---|---|
| spike (run 1 of 3) | 494.7 req/s | 52 | 712 ms | 989 ms | 100 |
| spike-2 | 490.1 req/s | 98 | **798 ms** | 937 ms | 100 |
| spike-3 | 493.4 req/s | 65 | 736 ms | 1,007 ms | 100 |

There the rate was not held (about 490 req/s completed, with iterations dropped), p95 for all attempts was 712 to 798 ms, just inside the objective, and the p95 of the 100 attempts that actually register was 937 to 1,007 ms, over it. The invariant held all the same: exactly 100 registered, 0 over-admission.
Two earlier runs of the spike (runs [41530864706](https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41530864706) and
[41531666886](https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41531666886), on AMD EPYC 9V74 runners, files not kept here) gave p95 of 260 ms with the rate held, and 685 ms with 42 iterations dropped at 495.7 req/s.
**Across the eight spikes made, p95 for all attempts went from 260 to 798 ms.** So the honest statement is: the seat count is exact at 500 req/s every time; the 800 ms objective is met on every run, but on a slower runner by 2 ms, and a 10-second burst
in which 98% of the attempts are cheap refusals is the easy case. One process does not carry 500 req/s of registrations comfortably, which is what the autoscaling's minimum of two pods is for.

| Smoke (every pull request) | |
|---|---|
| Configuration | 20 seats, 40 req/s for 10 s |
| Result | 20 registered, 380 refused `REGISTRATION_FULL`, p95 6.3 ms (73 ms for the registered). The run fails if p95 exceeds 800 ms or any attempt is anything but 201 or `REGISTRATION_FULL`. |

## The soak: five minutes, mixed

100 requests a second for 5 minutes (about 36,000 requests) across 10 events of 3,000 seats: 50% browse the open events, 20% open an event's page (both with a Supabase-signed token from the CI-only fake auth), 10% list the attendee's own registrations, 20% register and then withdraw.

- 6,000 registered and 6,000 withdrawn, 24,000 reads, all answered; no 5xx, no 429, no timeout.
- p95: 8.7 ms to register, 7.5 ms to read (objectives: 800 ms and 400 ms).
- At the end, no seat was claimed without an active registration, and the registrations the database holds match the 201s k6 saw exactly.
- The service's resident memory was 151 MB in the second minute and 154 MB in the last (+1.9%, limit for the check 25%): no leak visible in five minutes.
- CPU: 87.5 CPU-seconds for 36,000 requests, **2.43 ms per request**, 0.29 cores on average.

Five minutes is a check for an obvious leak or error, not the hours the architecture's soak test means; a longer run is the same command with `SOAK_MINUTES` raised.

## The stress run: stepping the rate up until it breaks

The arrival rate holds 100, 250, 500, 750, 1,000, 1,500 and 2,000 requests a second for 30 seconds each (5 seconds of ramp before each), every request a registration by a new attendee at one event with 250,000 seats.

| Step | Target req/s | Sent (expected; k6 dropped the rest) | Failed | p95 | Held |
|---|---|---|---|---|---|
| 0 | 100 | 3,499 (3,500) | 0 | 7.1 ms | yes |
| 1 | 250 | 8,374 (8,375) | 0 | 9.2 ms | yes |
| 2 | 500 | 14,859 (16,875) | 0 | 6,001 ms | no |
| 3 | 750 | 14,569 (25,625) | 0 | 10,324 ms | no |
| 4 | 1,000 | 13,848 (34,375) | 0 | 10,296 ms | no |
| 5 | 1,500 | 13,953 (51,250) | 0 | 10,331 ms | no |
| 6 | 2,000 | 13,790 (68,750) | 0 | 10,191 ms | no |

**One registration process held 250 req/s and broke at 500** in this run: it completed about 14,000 registrations per 35-second step whatever the target (about 400 a second), and the queue in front of it grew until k6 used all 4,000 of its virtual users and began dropping iterations (125,850 over the run). With 4,000 requests always in flight and about 400 answered a second, p95 settles near 10 seconds: that is the queue, capped by k6's own limit, not a timeout.
Nothing failed outright: every request that was sent was eventually answered 201, and afterwards the database held 82,892 registrations, 82,892 claimed seats, no seat or attendee twice and no unmatched row.
CPU was 217 CPU-seconds for 82,892 requests, **2.62 ms per request**, about one core while saturated.

An earlier run of the same stress (run [41531666886](https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41531666886), on a different CPU model, files not kept here) held 500 req/s at p95 566 ms and broke at 750, at 2.02 ms per request.
Both are the same picture: **one Node process saturates one core at roughly 400 to 500 successful registrations a second**, and the point at which it breaks depends on the hardware under it. The planning figure used below is one core and 2.6 ms, about 385 req/s.

Reaching a break is the finding here, not a failure. The run fails only if an invariant fails, and none did.

## Autoscaling, tuned from these measurements

[`deploy/k8s/components/autoscaling`](../../../deploy/k8s/components/autoscaling) is a kustomize component that sets the registration service's autoscaling. [`sizing.json`](../../../deploy/k8s/components/autoscaling/sizing.json) holds its inputs and the runs they came from;
[`load/support/sizing.ts`](../../../load/support/sizing.ts) is the arithmetic; [`load/tests/autoscaling.unit.test.ts`](../../../load/tests/autoscaling.unit.test.ts) fails if the component drifts from them, or assumes a CPU cost lower than any measured.

**The arithmetic.**

1. CPU cost: the runs measured 1.7 to 2.6 ms of CPU per request (spike 1.96 to 2.00, soak 2.43, stress 2.62, and 1.7 to 2.3 in the earlier runs). The planning figure is **3.0 ms**, the worst measured, rounded up. The smoke run's 3.8 ms is not used: 400 requests in 10 seconds is mostly the process warming up.
2. At the load model's peak of 500 req/s (the SLO's test rate; the three-year design point is about 420) that is 1.5 cores.
3. A pod with a **500m CPU request** at a **70% target** carries 0.35 cores, about 117 req/s, so the peak needs **5 pods**.
4. Connections: **pods x pool size (5) must stay within 80% of the pooler's limit** (architecture section 6). With a 100-connection share, that allows 16 pods.
5. **Maximum 8** = the 5 pods the peak needs x 1.5 for pods that are starting, held to the 16 the connections allow. **Minimum 2**, so one pod can be lost or rolled with no outage; two pods alone carry about 770 req/s at one core each, more than the peak, so the first minutes of a registration opening do not wait for the autoscaler.

| | Before (the defaults in #75) | Now |
|---|---|---|
| CPU request / limit | 100m / 500m | 500m / 1000m |
| HPA target | 70% of the request (70m) | 70% of the request (350m) |
| HPA minimum / maximum | 2 / 6 | 2 / 8 |
| Pool size | 5 (implicit) | 5 (set, so the budget is visible) |
| Scale-up | the default | at once, 2 pods or 100% every 30 s, whichever is more |
| Scale-down | the default | after 5 minutes, 1 pod a minute |

Why the request changes: at 100m, 70% is 70m, which one pod passes at about 35 req/s, so the pods would scale to their maximum at a fraction of the load. Why the limit changes: at 500m a pod is throttled at about half of the one core a saturated Node process uses.
The production overlay in #75 sets minimum 3 and maximum 10 for every API after its components; production keeps those two numbers, and 10 pods x 5 connections is still inside the connection budget.

**What is assumed and what was not shown.**

- **The pooler's limit is an assumption.** The team's Supabase plan limit is not known; 100 connections for registration is a figure to confirm, and `sizing.json` says so.
- **The HPA was not demonstrated.** Kubernetes was not run under load. How fast pods start, and whether the 70% target keeps p95 down as pods are added, are untested. The component is rendered with `kubectl kustomize` against a copy of #75's manifests and validated with kubeconform in CI (job `Manifests`); it is not wired into an overlay, because the base manifests are in #75.
- **Identity is a stand-in.** Registering also calls planning-core's `GET /api/v1/users/me`. That call's client side is in the CPU figures (the registration process makes it); planning-core's work, and its latency, are not. The real cost per request, and so the pod count, will be higher by an amount not measured.
- **The in-app rate limit would defeat all of this behind an ingress.** The service limits each client address to 120 requests a minute, and with `trust proxy` off every request behind a Kubernetes ingress comes from the ingress's address, so the whole public edge would share about 2 requests a second. The runs raise the limit (`REGISTRATION_RATE_LIMIT_PER_MINUTE`). The gateway (EN-12) is meant to replace this limit; until it exists a deployment must set the variable high or key the limit on the forwarded address. Found by reading the code, not by a run; not fixed here.
- **KEDA** for the Kafka consumers is not built.

## How to rerun

- Pull requests run the smoke and the three spikes, on their own.
- The soak and the stress run when the pull request's title carries `[full-load]`, or from the Actions tab (`Load and chaos`, "Run workflow") once the workflow is on the default branch.
- Locally, with a throwaway Postgres built by `npm run migrate:all`, Docker for the k6 image and `DATABASE_URL` pointing at it: `npx tsx load/support/run.ts spike` (or `smoke`, `soak`, `stress`). Nothing needs a `.env`, and the harness refuses any database that is not on the machine it runs on.

| Folder | What it is |
|---|---|
| `smoke/`, `spike-1/`, `spike-2/`, `spike-3/` | the smoke and the three 500 req/s spikes |
| `soak/` | the five-minute mixed soak, with `usage-samples.json` |
| `stress/` | the stepped ramp, with `usage-samples.json` |
