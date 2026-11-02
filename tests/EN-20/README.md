# EN-20 — Chaos experiments

EN-20 is an enabler. Its cards are the six experiments of architecture §7, each with a hypothesis, a result and a
fix log in `documentation/evidence/EN-20/`, plus the checks that Toxiproxy and the Chaos Mesh manifests work.
Toxiproxy runs experiments 2, 3 and 5 in CI; 4 is run in CI too (it needs no injection tool). Experiments 1 and 6
depend on work not on this branch and are designed, not run.

| Experiment | Card | Where | Latest result |
|---|---|---|---|
| 1 A crash mid-cancellation | EN-20-T1 | staging (Chaos Mesh); needs F3 and F4 | Blocked |
| 2 A broker outage | EN-20-T2 | CI (Toxiproxy, Redpanda) | Pass |
| 3 A slow database | EN-20-T3 | CI (Toxiproxy, k6) | Pass (seats exact; the 800 ms objective was not met under the toxic) |
| 4 A public outage | EN-20-T4 | CI (process stop) | Pass (staff half) |
| 5 Duplicate delivery | EN-20-T5 | CI (Toxiproxy, Redpanda) | Pass |
| 6 A partition | EN-20-T6 | staging (Chaos Mesh); needs ReduceCapacity | Blocked |
| Toxiproxy works | EN-20-T7 | CI | Pass |
| Manifests valid | EN-20-T8 | CI (kubeconform) | Pass |

**Not covered, on purpose.** Experiments 1 and 6; the staging Chaos Mesh runs (no cluster); browsing from cache (needs the CDN, EN-12);
the gateway shedding load and the burn-rate alert (EN-12, EN-17). The write-ups in `documentation/evidence/EN-20/` say so for each.
