# EN-16 — Canary releases

EN-10 and EN-16 are enablers: they have no screens. Their cards check the delivery pipeline, and each
is checked by a job of the Deploy workflow (`.github/workflows/deploy.yml`) rather than by a
vitest test. The workflow is not a required check; its cluster jobs run when `deploy/`, a Dockerfile
or the workflow changes, and on main.

| Criterion | Card | Status |
|---|---|---|
| An Argo Rollouts canary at 10, 50 and 100%. | EN-16-T1 | Pass |
| Prometheus analysis of error rate and p95 gates the canary steps. | EN-16-T2 | Pass |
| Automatic rollback demonstrated. | EN-16-T3 | Pass |
| The queries depend on EN-17's metric names (`http_request_duration_seconds`, `http_requests_total{status}`). | EN-16-T4 | Not Executed |

**What no card here shows**, on purpose: a real cluster, a real cloud account (`terraform plan` and
`apply` were never run), Kafka or Supabase inside the kind cluster, or planning-core's own `/metrics`
(EN-17). The text of each card says what its run did and did not cover.
