# EN-17 — SLOs, alerts, dashboards, runbooks

| Acceptance criterion | Cards |
|---|---|
| SLOs written down, each with an SLI over emitted telemetry | EN-17-T1, T2, T3, T4, T5, T6 |
| Burn-rate alerts | EN-17-T7, T8, T9 |
| A runbook per alert, and dashboards | EN-17-T10 |

T1 to T4 are vitest unit tests. T5 has a unit test (stubbed database) and an integration test that CI runs
against its throwaway Postgres. T6 is a unit test. T7 to T9 run `promtool` in a CI job that uses the
`prom/prometheus` image. T10 is a `node:test` file.

**Not covered.** No Prometheus or Grafana server runs anywhere: the rules, config and dashboards are
validated, not deployed. The registration latency SLI has no data until R2 adds the registration route.
