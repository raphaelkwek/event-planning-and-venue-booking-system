# EN-18 — Load tests and autoscaling

EN-18 is an enabler, so it has no screens. Its cards check the k6 load tests of the registration service and
the autoscaling settings. Everything runs in CI (the `Load and chaos` workflow): the team has no local
Postgres, k6 or Docker. The evidence, with the run URLs, is in `documentation/evidence/EN-18/`.

| Area | Cards |
|---|---|
| Spike: 500 req/s for 100 seats | EN-18-T1, T2, T3 |
| Smoke on every pull request | EN-18-T4 |
| Soak and stress (workflow_dispatch) | EN-18-T5, T6 |
| Autoscaling tuned | EN-18-T7 |
| Results committed | EN-18-T8 |
