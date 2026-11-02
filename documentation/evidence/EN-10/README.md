# EN-10 evidence: containers, Terraform, Kubernetes, GitOps

Run: https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41511260190 (Deploy workflow, commit `7f31fe5f8158bc75ca285a38e4ccca713e778a9f`, all jobs green). Raw job summaries are the artifacts
`evidence-kind-deploy` and `evidence-argocd-sync` of that run; they are copied below.

| Acceptance criterion | Status | Card | Job |
|---|---|---|---|
| Images built in CI only, hardened, smoke-tested | Validated in CI | EN-10-T1 | Image (x5) |
| Images pushed to GHCR from main, tagged with the sha | Built, **not run** (runs only on main after merge) | EN-10-T2 | Push to GHCR step |
| Kubernetes manifests, kubeconform -strict with CRD schemas | Validated in CI | EN-10-T3 | Manifests |
| kind smoke deploy of the staging overlay | Demonstrated in kind | EN-10-T4 | kind smoke deploy |
| Migration Job using `npm run migrate` | Demonstrated in kind and in the image job | EN-10-T5 | Image (migrate), kind |
| Terraform for cluster, network, Redis | Built; fmt, validate, tflint in CI. **plan/apply not run** (no cloud account) | EN-10-T6 | Terraform |
| Argo CD syncs staging from the config repo | Demonstrated in kind (public repo, no credentials) | EN-10-T7 | Argo CD syncs |
| README deploy steps | Written (documentation/deploy.md); not followed on a real cluster | EN-10-T8 | not run |

## kind smoke deploy

## EN-10 kind smoke deploy: staging overlay

Kubernetes v1.33.1 on kind. Namespace labels (the restricted Pod Security Standard is enforced):

    {"kubernetes.io/metadata.name":"connectsphere-staging","pod-security.kubernetes.io/enforce":"restricted","pod-security.kubernetes.io/enforce-version":"latest"}

| Workload | Kind | Result |
|---|---|---|
| migrate | Job | completed |
| planning-core | Rollout (canary) | Healthy |
| registration | Rollout (canary) | Healthy |
| notification | Deployment | rolled out |
| web | Deployment | rolled out |
| planning-core-worker | Deployment | scaled to 0 for this test (no Temporal namespace) |

| Health check | Answer |
|---|---|
| `planning-core/healthz` | `{"status":"ok"}` |
| `planning-core/readyz` | `{"status":"ready","checks":{"database":"ok","kafka":"not_configured"}}` |
| `registration/readyz` | `{"status":"ready","checks":{"database":"ok","kafka":"not_configured"}}` |
| `notification/readyz` | `{"status":"ready","checks":{"database":"ok","kafka":"not_configured"}}` |
| `web/healthz` | `ok` |
| `web/some/client/route` | the app shell (SPA fallback) |

NetworkPolicy: enforced here. A pod in `default` was refused by the default deny; a pod in `ingress-nginx` reached planning-core through the explicit allow.

## Argo CD sync

## EN-10 Argo CD sync: staging overlay

Argo CD v2.14.11 on kind synced `deploy/k8s/overlays/staging` from this repository (public, no credentials) at revision `7f31fe5f8158bc75ca285a38e4ccca713e778a9f`.

| Application | Sync | Health | Policy |
|---|---|---|---|
| connectsphere-staging | Synced | Healthy | automated, prune, self-heal |

Resources Argo CD created: ConfigMap/connectsphere-config, Namespace/connectsphere-staging, Service/notification, Service/planning-core, Service/registration, Service/web, Deployment/notification, Deployment/planning-core-worker, Deployment/web, AnalysisTemplate/error-rate-and-p95, Rollout/planning-core, Rollout/registration, HorizontalPodAutoscaler/notification, HorizontalPodAutoscaler/planning-core, HorizontalPodAutoscaler/registration, HorizontalPodAutoscaler/web, Job/migrate, Ingress/notification, Ingress/planning-core, Ingress/web, NetworkPolicy/allow-dns, NetworkPolicy/allow-from-ingress-controller, NetworkPolicy/allow-hosted-dependencies, NetworkPolicy/allow-notification-to-planning-core, NetworkPolicy/allow-planning-core-from-notification, NetworkPolicy/allow-prometheus-scrape, NetworkPolicy/default-deny, PodDisruptionBudget/notification, PodDisruptionBudget/planning-core, PodDisruptionBudget/planning-core-worker, PodDisruptionBudget/registration, PodDisruptionBudget/web

Self-heal: the ConfigMap `connectsphere-config` was deleted by hand and recreated by Argo CD (uid `1439ddbe` to `1586cfa9`).

## Not shown

Kafka consumers and the outbox relay, Supabase token verification and the Temporal worker (the kind cluster
has none of them; the worker ran at zero replicas), a real ingress controller and TLS, any cloud resource.
