# EN-20 — Chaos experiments

EN-20 is an enabler. Its cards are the six experiments of architecture §7, each with a hypothesis, a result and a
fix log in `documentation/evidence/EN-20/`, plus the checks that Toxiproxy and the Chaos Mesh manifests work.
Toxiproxy runs experiments 2, 3 and 5 in CI; 4 is run in CI too (it needs no injection tool). Experiments 1 and 6
depend on work not on this branch and are designed, not run.

| Experiment | Card | Where |
|---|---|---|
| 1 A crash mid-cancellation | EN-20-T1 | staging (Chaos Mesh); needs F3 and F4 |
| 2 A broker outage | EN-20-T2 | CI (Toxiproxy, Redpanda) |
| 3 A slow database | EN-20-T3 | CI (Toxiproxy, k6) |
| 4 A public outage | EN-20-T4 | CI (process stop) |
| 5 Duplicate delivery | EN-20-T5 | CI (Toxiproxy, Redpanda) |
| 6 A partition | EN-20-T6 | staging (Chaos Mesh); needs ReduceCapacity |
| Toxiproxy works | EN-20-T7 | CI |
| Manifests valid | EN-20-T8 | CI (kubeconform) |
