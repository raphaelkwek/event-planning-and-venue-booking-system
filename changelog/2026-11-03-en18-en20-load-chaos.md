# EN-18 and EN-20: load tests, autoscaling and chaos experiments (PR #90, stacks on #80)

**Timestamp:** 2026-11-03T06:20+08:00 (SGT)
**Author:** Joash
**Scope:** registration service (two settings), `load/` (k6 harness), `chaos/` (experiments), `deploy/chaos`,
`deploy/k8s/components/autoscaling`, the `Load and chaos` workflow, `documentation/evidence/EN-18` and `EN-20`,
`documentation/reliability.md`.

**Deploy:** nothing to migrate. The registration service reads two new optional settings,
`REGISTRATION_DB_POOL_MAX` (default 5) and `REGISTRATION_RATE_LIMIT_PER_MINUTE` (default 120); with neither
set it behaves as before. The autoscaling component is not wired into an overlay until #75 merges.

## Added

- **EN-18:** a k6 harness (`tsx load/support/run.ts smoke|spike|soak|stress`) that boots the registration service on
  the runner's throwaway Postgres, seeds events through its consumer handlers, runs k6 in the `grafana/k6`
  image and checks the database afterwards. In CI: 500 req/s for 100 seats registered exactly 100 attendees, with 0
  over-admission and the rest refused `REGISTRATION_FULL`, in every spike run made (eight; p95 for all attempts 260 to 798 ms, the
  slow end on a slower runner where about 490 req/s were completed); a 5-minute soak (36,000 requests, no errors, memory +1.9%); and a stress ramp that broke one process at
  500 req/s with every invariant intact. Results and run URLs are in `documentation/evidence/EN-18`.
- **Autoscaling** (`deploy/k8s/components/autoscaling`): the registration HPA's minimum, maximum and CPU target, and the
  pod's CPU request, limit and pool size, worked out from the measured CPU per request, the design peak and the
  connection budget (pods x pool at most 80% of the pooler). Rendered and validated in CI; **not run under load in
  Kubernetes**.
- **EN-20:** experiments 2 (broker outage), 3 (slow database), 4 (public outage) and 5 (duplicate delivery) run in CI
  with Toxiproxy, Redpanda and k6, and all four held their pass condition (the seats-exact half, for 3). Each has a
  hypothesis, injection, pass condition, result with the run URL and a fix log in `documentation/evidence/EN-20`.
  Experiments 1 and 6 are written up but **not run** (they need F3/F4 and the ReduceCapacity workflow). Chaos Mesh manifests
  for the staging runs are validated against the Chaos Mesh CRDs, not applied.
- `documentation/reliability.md`, the index and the how-to-run.

## Changed

- The registration service's database pool size and its interim per-address rate limit are settings, with the old
  values as defaults. The load tests raise the limit (one generator is one address); the autoscaling sizing depends
  on the pool size.

## Found, not fixed

- The registration service has no per-request time limit and sheds no load: with 500 ms added to every database answer,
  p95 was 15 s (seats stayed exact). The design leaves shedding to the gateway (EN-12).
- The per-address rate limit would throttle every attendee together behind a Kubernetes ingress (`trust proxy` is off, so
  every request comes from the ingress's address): about 2 requests a second for the whole public edge. A deployment must
  set `REGISTRATION_RATE_LIMIT_PER_MINUTE` high, or key the limit on the forwarded address, until the gateway exists.

## Not done

- Kubernetes under load, and the HPA reacting (no cluster; the kind job is in #75). The pooler's connection limit is an
  assumption in `sizing.json` to confirm.
- The identity lookup (planning-core's `users/me`) is a stand-in in the load runs, so planning-core's share of each
  request is not in the numbers.
- Experiments 1 and 6, the staging Chaos Mesh runs, the browse-from-cache half of experiment 4, and the gateway and
  burn-rate alert in experiment 3.
