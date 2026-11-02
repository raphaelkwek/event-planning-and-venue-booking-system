# EN-18 — Load tests and autoscaling

EN-18 is an enabler, so it has no screens. Its cards check the k6 load tests of the registration service and
the autoscaling settings. Everything runs in CI (the `Load and chaos` workflow): the team has no local
Postgres, k6 or Docker. The evidence, with the run URLs, is in `documentation/evidence/EN-18/`.

| Area | Card | Latest result |
|---|---|---|
| Spike: 500 req/s for 100 seats | EN-18-T1, T2, T3 | Pass |
| Smoke on every pull request | EN-18-T4 | Pass |
| Soak (5 minutes) and stress (ramp to breaking) | EN-18-T5, T6 | Pass |
| Autoscaling tuned | EN-18-T7 | Pass |
| Results committed | EN-18-T8 | Pass |

**Not covered, on purpose.**
- **Kubernetes under load.** The HPA is tuned from single-node measurements and was not demonstrated; the kind job is in #75.
- **Planning-core's share of each request.** The load runs answer the identity lookup with a stand-in.
- **Hours-long soak.** The soak ran 5 minutes; the command takes any length.
