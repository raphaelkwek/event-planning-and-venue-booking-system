# Reliability: load tests, autoscaling and chaos experiments

This is the index for EN-18 (load tests and autoscaling) and EN-20 (chaos experiments). It says what exists, what ran and
where to read the result. It claims only what a run measured; what did not run is marked **Not run**.

Everything runs in CI, in the [`Load and chaos`](../.github/workflows/load-chaos.yml) workflow, on a GitHub-hosted runner with a
throwaway Postgres. Nothing here touches the team's Supabase project or Kafka cluster, and the harness refuses to start against
any database that is not on the machine it runs on. Containers are used only in CI (ADR-0012); there is nothing to run locally except the
harness's unit tests.

## At a glance

| Item | State | Where |
|---|---|---|
| k6 spike: 500 req/s, 100 seats, exactly 100 registered | Run in CI on every pull request (three times) | [EN-18 evidence](evidence/EN-18/README.md) |
| k6 smoke on every pull request | Run in CI | [EN-18 evidence](evidence/EN-18/README.md) |
| k6 soak | Run in CI (5 minutes, started from the pull request title or by hand) | [EN-18 evidence](evidence/EN-18/README.md) |
| k6 stress (ramp to breaking) | Run in CI (about 4 minutes, started the same way) | [EN-18 evidence](evidence/EN-18/README.md) |
| Autoscaling tuned | Numbers derived from the measurements, rendered and validated in CI. **Not run under load in Kubernetes.** | [`deploy/k8s/components/autoscaling`](../deploy/k8s/components/autoscaling) |
| Experiment 1, a crash mid-cancellation | **Not run.** Designed; blocked by F3 and F4 | [evidence](evidence/EN-20/1-crash-mid-cancellation.md) |
| Experiment 2, a broker outage | Run in CI (Toxiproxy, Redpanda) | [evidence](evidence/EN-20/2-broker-outage.md) |
| Experiment 3, a slow database | Run in CI (Toxiproxy, k6) | [evidence](evidence/EN-20/3-slow-database.md) |
| Experiment 4, a public outage | Run in CI (process stop); the browse-from-cache half is not built | [evidence](evidence/EN-20/4-public-outage.md) |
| Experiment 5, duplicate delivery | Run in CI (Toxiproxy, Redpanda) | [evidence](evidence/EN-20/5-duplicate-delivery.md) |
| Experiment 6, a partition during a capacity reduction | **Not run.** Designed; blocked by the ReduceCapacity workflow | [evidence](evidence/EN-20/6-partition-and-reduced-capacity.md) |
| Chaos Mesh manifests for staging | Validated with kubeconform against the Chaos Mesh CRDs. **Not applied** (no staging cluster) | [`deploy/chaos`](../deploy/chaos) |

Test cards: [`tests/EN-18`](../tests/EN-18) and [`tests/EN-20`](../tests/EN-20). Traceability: `documentation/traceability/sprint-4.csv`.

## How the load tests work

`tsx load/support/run.ts <smoke|spike|soak|stress>` (from the repository root, with `DATABASE_URL` set to a throwaway Postgres that
`npm run migrate:all` has built, and Docker available for k6):

1. starts the real registration service as a process, plus an identity stand-in and, for the soak, the CI-only fake Supabase Auth (EN-14);
2. seeds events through the service's own consumer handlers (a listing and an approval), so the seats exist as they do in production;
3. runs a k6 script in the `grafana/k6` image against the service, with each attempt from a different attendee;
4. reads the database back and checks the invariants: registrations equal seats, no seat or attendee twice, every 201 k6 saw is a row, every
   other attempt refused `REGISTRATION_FULL`, one confirmation message per registration in the outbox;
5. writes `load/out/<scenario>/` (the k6 summary, `result.json`, `result.md`, the service's log) and exits non-zero if an invariant failed.

Latency and rate are reported next to the verdict and never invented: if the runner cannot hold 500 req/s the result says what it held.
The p95 objective fails the smoke run (and the soak); the spike reports it without failing, because a shared runner is not the production cluster.

**What the stand-in changes.** Registering, withdrawing and "my registrations" ask planning-core who a token belongs to
(`GET /api/v1/users/me`, ADR-0005). That route allows 120 requests a minute per address, which one load generator would exhaust, so the
runs answer it with a stand-in (`load/support/identity-stub.ts`) that reads the attendee from the token. The numbers therefore leave out
planning-core's share of each request. The service's own interim limit (120 a minute per address, ADR-0011) is raised for the run for the same reason.
The registration service runs from source with tsx, as `npm run dev` does, not from its container image.

## How the chaos experiments work

`npx vitest run --config chaos/vitest.config.ts` with `DATABASE_URL` set as above, a Toxiproxy on `127.0.0.1:8474` and a Redpanda broker as the workflow
starts them. Toxiproxy sits between a service and its database or broker and breaks the connection on command. Each experiment writes its numbers to
`chaos/out/` and fails if its pass condition does not hold. Experiment 4 needs no injection tool: it kills the registration process.

Each write-up in `documentation/evidence/EN-20/` has the same parts: hypothesis, injection, pass condition, actual result with the run URL, and a fix log.

## What the runs found

- **One registration process saturates one core at roughly 400 to 500 registrations a second.** In the stress run it held 250 req/s and broke at 500 (p95 6 s,
  about 400 a second completed); in an earlier run, on a different CPU model, it held 500 and broke at 750. The cost is 2.0 to 2.6 ms of CPU per registration.
  Two pods are enough for the 500 req/s peak; the autoscaling is sized from the cost per request, not from the ceiling of one.
- **The 10-second 500 req/s spike meets the 800 ms objective in all five runs made, with p95 from 260 to 685 ms.** That is a short burst in which 98% of attempts are cheap
  refusals; the margin is smaller than one run suggests, and 500 req/s of successful registrations held for 30 seconds is more than one process carries.
- **A slow database makes the service slow, not wrong.** With 500 ms added to every database answer the seats stayed exact (experiment 3), but p95 was many
  seconds: the service has no per-request time limit and sheds no load, which the design leaves to the gateway (EN-12, not built).
- **The interim per-address rate limit would throttle every attendee together behind an ingress.** The service keys its limit on the client address and keeps
  Express's `trust proxy` off, so behind a Kubernetes ingress every request arrives from the ingress's address and shares one budget of 120 a minute. That is
  about 2 requests a second for the whole public edge, far below the 500 the load tests carry. The gateway (EN-12) is meant to replace this limit; until it exists,
  a deployment needs `REGISTRATION_RATE_LIMIT_PER_MINUTE` set high, or the limit keyed on the forwarded client address. This was found by reading the code while
  planning the load test, not by a run, and is not fixed here.

## Not done, and why

- **Kubernetes was not run under load.** The HPA's numbers come from single-node measurements and arithmetic; its behaviour (how fast pods start, whether the
  CPU target holds p95) was not demonstrated. The kind job that PR #75 adds would be the place, and this branch does not contain it.
- **Experiments 1 and 6** need F3, F4 and the ReduceCapacity workflow, none of which are on this branch.
- **The staging Chaos Mesh runs** (all six, in staging) need a staging cluster the team does not have.
- **The browse-from-cache half of experiment 4, the gateway shedding load and the burn-rate alert in experiment 3** need EN-12 and EN-17.
- **KEDA** for the Kafka consumers is not built; the HPA covers the HTTP service only.
