# Deploying ConnectSphere

> **The live staging and production environments follow `documentation/deploy/README.md`**
> (ADR-0016: a free Oracle k3s VM, Vercel and one Supabase project per environment). This page is
> EN-10's guide for the EKS path, kept as the scale-up path. Since ADR-0016 the images are pushed and
> signed by the Release workflow (`release.yml`), not the Deploy workflow.

This is the deploy guide for EN-10 (containers, Terraform, Kubernetes, GitOps) and EN-16 (canary
releases). The decision behind it is ADR-0012. Local development does not change: `npm run dev` and
the hosted Supabase and Kafka, with no Docker on a laptop. Containers are built **in CI only**.

**Read this first: what has and has not been run.** Everything below that CI can check is checked
on every relevant pull request (`.github/workflows/deploy.yml`, evidence in
`documentation/evidence/EN-10/` and `EN-16/`). Nothing has been deployed to a real cluster: the
team has no AWS account, so `terraform plan` and `apply` have never run, and no EKS cluster exists.
The steps for those parts are written from the manifests and the tools' documentation, and the
first person to follow them should expect to fix a detail or two.

| What | Where | Port | Health |
|---|---|---|---|
| planning-core API | `backend/services/planning-core/Dockerfile` | 8090 | `/healthz`, `/readyz` |
| planning-core Temporal worker | the same image, command `node dist/temporal/worker.js` | none | none (restarted when it exits) |
| registration | `backend/services/registration/Dockerfile` | 8092 | `/healthz`, `/readyz` |
| notification | `backend/services/notification/Dockerfile` | 8091 | `/healthz`, `/readyz` |
| web (nginx, static files) | `frontend/Dockerfile` | 8080 | `/healthz` |
| migrations | `backend/scripts/Dockerfile`, run as a Job | none | the Job completes |

`/readyz` needs the database; Kafka is reported but not required (implementation.md §10).

## 1. Build and push the images

Nobody builds an image by hand. The **Deploy** workflow does it:

- On every pull request it builds all five images with buildx (cached), starts each under the same
  restrictions the manifests impose (non-root, read-only root filesystem, no capabilities) against a
  throwaway Postgres, and checks the health endpoint. It pushes nothing.
- On a push to `main` it pushes `ghcr.io/raphaelkwek/connectsphere-<name>:<commit sha>` for
  `planning-core`, `registration`, `notification`, `web` and `migrate`. The job has
  `permissions: packages: write`. After the first push, open each package's settings once and
  confirm it is linked to this repository.
- The web image bakes in two **public** values the browser needs to sign in. Set the repository
  variables `SUPABASE_URL` and `SUPABASE_ANON_KEY` (Settings, Secrets and variables, Actions,
  Variables). One web image therefore serves one Supabase project; the team has one.

## 2. Secrets

No value is in git. Create the Secret by hand, once per namespace, **before** the first sync:

```bash
kubectl create namespace connectsphere-staging
kubectl -n connectsphere-staging create secret generic connectsphere-secrets \
  --from-literal=DATABASE_URL='<Supabase transaction pooler string, port 6543>' \
  --from-literal=SUPABASE_URL='https://<project-ref>.supabase.co' \
  --from-literal=SUPABASE_ANON_KEY='<anon key>' \
  --from-literal=SUPABASE_JWKS_URL='https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json' \
  --from-literal=SUPABASE_SERVICE_ROLE_KEY='<service role key>' \
  --from-literal=KAFKA_BROKERS='<bootstrap server:port>' \
  --from-literal=KAFKA_SASL_USERNAME='<username or API key>' \
  --from-literal=KAFKA_SASL_PASSWORD='<password or API secret>' \
  --from-literal=TEMPORAL_ADDRESS='<namespace>.<account>.tmprl.cloud:7233' \
  --from-literal=TEMPORAL_NAMESPACE='<namespace>.<account>' \
  --from-literal=TEMPORAL_API_KEY='<api key>'
```

Get the values from the team's password manager, never from git or chat (`.env.example` says
where each comes from). Each workload reads only the keys it needs (`secretKeyRef`, not
`envFrom`). The Kafka and Temporal keys are optional in the manifests: leave them out and the
process runs without its consumer, relay or worker, as it does on a laptop. Kafka's mechanism
(`KAFKA_SASL_MECHANISM`) is in the ConfigMap, set to `plain` for Confluent; change it in
`deploy/k8s/base/configmap.yaml` for Aiven (`scram-sha-256`, which also needs its CA file; that is
not mounted yet).

Instead of the command above, `deploy/k8s/optional/external-secret.yaml` fills the same Secret
from AWS Secrets Manager with the External Secrets Operator. It is validated but not part of the
base because it needs the operator's CRDs.

## 3. Provision the cluster (Terraform)

AWS ap-southeast-1, three availability zones (ADR-0012). The modules are `network`, `eks` and
`redis` (ElastiCache, for EN-12's rate limits); the decision note is in `deploy/terraform/README.md`.

```bash
cd deploy/terraform/environments/staging
cp backend.hcl.example backend.hcl            # fill in the state bucket and lock table; never commit it
cp terraform.tfvars.example terraform.tfvars  # and your values
terraform init -backend-config=backend.hcl
terraform plan -out plan.tfplan
terraform apply plan.tfplan
aws eks update-kubeconfig --name <cluster name from the outputs> --region ap-southeast-1
```

CI runs `terraform fmt -check`, `init -backend=false`, `validate` and `tflint` for both
environments. **`plan` and `apply` have not been run** (no account, no credentials, none committed).
Budget first: three zones, a NAT gateway and an EKS control plane cost money while idle.

Then install what the manifests assume is there: ingress-nginx, cert-manager, metrics-server, a
CNI that enforces NetworkPolicy (the VPC CNI's network policy agent), Prometheus (EN-17), Argo
Rollouts and Argo CD.

## 4. Bootstrap Argo CD

```bash
kubectl create namespace argocd
kubectl apply -n argocd --server-side -f https://raw.githubusercontent.com/argoproj/argo-cd/v2.14.11/manifests/install.yaml
kubectl create namespace argo-rollouts
kubectl apply -n argo-rollouts -f https://github.com/argoproj/argo-rollouts/releases/download/v1.8.3/install.yaml

kubectl apply -f deploy/argocd/appproject.yaml
kubectl apply -f deploy/argocd/application-staging.yaml
```

This repository is the config repo and it is public, so Argo CD reads it with no credentials. If
it becomes private, add a read-only deploy key as an Argo CD repository credential (in the cluster,
never in git). Staging then follows `deploy/k8s/overlays/staging` on `main` with automated sync,
prune and self-heal. Production (`application-production.yaml`) has no automated policy: a person
presses Sync.

CI installs Argo CD in a kind cluster and watches it sync the staging overlay and heal a deleted
ConfigMap (`argocd-sync` job).

## 5. Promote a release

The overlays name the image tags. A release is a pull request that changes them:

1. Merge your change to `main`. The Deploy workflow pushes images tagged with the merge commit's sha.
2. Open a pull request that sets that sha in the overlay:

   ```bash
   cd deploy/k8s/overlays/staging
   for n in planning-core registration notification web migrate; do
     kustomize edit set image ghcr.io/raphaelkwek/connectsphere-$n=ghcr.io/raphaelkwek/connectsphere-$n:<sha>
   done
   ```

3. Merge it. Argo CD syncs staging: the `migrate` Job runs first (a PreSync hook), then the web,
   notification and worker Deployments roll, and planning-core and registration start a **canary**.
4. For production, make the same change in `overlays/production`, merge, and press Sync in Argo
   CD (or `argocd app sync connectsphere-production`).

Schema changes are expand, then migrate, then contract (ADR-0012), so the old pods keep working
against the migrated schema while a canary is running.

## 6. The canary (EN-16)

planning-core and registration are Argo Rollouts in both overlays. A new version goes to **10%**,
is analysed, then **50%**, analysed again, then **100%**. Without a traffic router the percentages
are met by pod counts, so with 2 replicas 10% is one pod; adding an ingress-nginx
`trafficRouting` block gives exact weights, and EN-18 sets the replica counts.

The analysis (`deploy/k8s/analysis/error-rate-and-p95.yaml`) queries Prometheus for the canary's
own pods: an error rate above 2% or a p95 above 0.5 s fails it. **The queries depend on the metric
names EN-17 adds: `http_requests_total{status}` and `http_request_duration_seconds`** (a histogram),
and on a `pod` label on each series. If EN-17 names them differently, change the two queries in that
one file. Until EN-17 merges, a canary has no data to be judged on and its analysis fails, so
nothing can be promoted past 10% in a real cluster until then.

```bash
# the kubectl plugin: https://argo-rollouts.readthedocs.io/en/stable/installation/#kubectl-plugin-installation
kubectl argo rollouts get rollout planning-core -n connectsphere-staging --watch
kubectl argo rollouts promote planning-core -n connectsphere-staging     # skip the remaining analysis
```

## 7. Roll back

- **Automatically:** a failed analysis aborts the Rollout and scales the canary down; the stable
  version never stopped serving. The Rollout shows `Degraded` until you fix forward or undo.
- **By hand:** `kubectl argo rollouts abort planning-core -n connectsphere-staging`, then
  `kubectl argo rollouts undo planning-core -n connectsphere-staging`.
- **Properly:** revert the overlay change in git. Argo CD's self-heal puts back whatever git says,
  so a `kubectl` fix that is not in git is undone.
- A migration is not rolled back; that is why schema changes are additive first.

CI shows the automatic path in a kind cluster (`canary-rollback` job): a good release is promoted
through both analyses, and a bad one that passes its health check but answers 500 is aborted. It
used a stand-in service that exposes the two metric names, not planning-core.

## 8. What CI shows and what it does not

| Shown in CI | Not shown |
|---|---|
| Every image builds, starts hardened and answers its health endpoint | A push to GHCR (it runs on `main`, after the merge) |
| Manifests render, validate with `kubeconform -strict` (CRDs included) and pass the hardening policy | A real cluster, a real ingress controller, TLS |
| The staging overlay deploys to kind and every service is ready, with the migration Job | Kafka consumers and the outbox relay, Supabase token checks, the Temporal worker (the cluster has none of them) |
| Terraform is formatted, valid and lint-clean | `terraform plan` and `apply`: no cloud account |
| Argo CD syncs the overlay from this repository and self-heals | Argo CD against `main` and the production Application |
| A good canary is promoted and a bad one rolled back, on Prometheus data | The same on planning-core (needs EN-17's `/metrics`) |

The `NetworkPolicy` default deny is applied in the kind runs; whether kind's network plugin enforced
it is stated in the job summary of each run, not assumed.
