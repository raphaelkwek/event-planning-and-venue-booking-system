# EN-10 — Containers, Terraform, Kubernetes, GitOps

EN-10 and EN-16 are enablers: they have no screens. Their cards check the delivery pipeline, and each
is checked by a job of the Deploy workflow (`.github/workflows/deploy.yml`) rather than by a
vitest test. The workflow is not a required check; its cluster jobs run when `deploy/`, a Dockerfile
or the workflow changes, and on main.

| Criterion | Card | Status |
|---|---|---|
| Images built in CI only (EN-10), each non-root, multi-stage, on a pinned base, with no secrets baked in. | EN-10-T1 | Not Executed |
| Images are pushed to GHCR from main only, with permissions: packages: write, tagged with the commit sha. | EN-10-T2 | Not Executed |
| Kubernetes manifests: Deployments with probes, resources and a restrictive securityContext; Services; Ingress; HPAs; PodDisruptionBudgets; default-deny NetworkPolicy plus allows; ConfigMaps; Secrets only as references; validated with kubeconform -strict including CRD schemas. | EN-10-T3 | Not Executed |
| A kind smoke deploy in CI: the staging overlay, rollouts awaited, health endpoints curled. | EN-10-T4 | Not Executed |
| A migration Job or initContainer using `npm run migrate`. | EN-10-T5 | Not Executed |
| Terraform for the cluster, network and Redis; validated in CI with fmt, init -backend=false, validate and tflint. | EN-10-T6 | Not Executed |
| Argo CD Application manifests syncing the staging overlay from the config repo, validated with kubeconform and, where practical, shown syncing in kind. | EN-10-T7 | Not Executed |
| README deploy steps. | EN-10-T8 | Not Executed |

**What no card here shows**, on purpose: a real cluster, a real cloud account (`terraform plan` and
`apply` were never run), Kafka or Supabase inside the kind cluster, or planning-core's own `/metrics`
(EN-17). The text of each card says what its run did and did not cover.
