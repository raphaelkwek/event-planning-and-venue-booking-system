# ADR-0016: Deploy staging and production on a free single-node k3s and Vercel

**Status:** Accepted. Narrows ADR-0012 for now: ADR-0012's EKS, RDS and ElastiCache stay written (EN-10's Terraform) as the scale-up path.
**Date:** 2026-11-03
**Owner:** Joash, who decided it on 3 Nov 2026 and presents it in the Week 13 Q&A.
**Approval:** Joash's decision (3 Nov 2026), recorded with the pull request that builds it.

## Context

ADR-0012 put ConnectSphere on EKS in ap-southeast-1 across three zones, with RDS and ElastiCache, and EN-10 (#75) wrote that as Terraform, Kubernetes manifests and Argo CD Applications. Nothing was ever deployed: the team has no AWS account, and the idle cost of that design is about USD 150 a month (an EKS control plane, NAT gateways, ElastiCache). The course grades a running system and the pipeline that ships it, and the showcase needs real URLs.

The constraint is money: only free tiers. What is free and enough:

- **Oracle Cloud Always Free** gives one tenancy up to 4 Ampere A1 cores and 24 GB of memory, in ap-singapore-1, indefinitely. That is one arm64 VM large enough for both environments.
- **Vercel Hobby** serves a static single-page app from a CDN with TLS.
- **Supabase's free plan** gives each project its own Postgres and Auth; a free account may hold two active projects.
- **GitHub** gives a public repository free Actions minutes (including arm64 runners), GHCR storage, and environments with required reviewers.

What is not free with enough headroom: hosted Kafka (Aiven's free plan has five topics and powers off when idle; Confluent's credit runs out) and hosted Temporal (Temporal Cloud has no free plan). ADR-0008 and ADR-0009 keep those for development; a deployment needs its own.

## Decision

**One Oracle Always Free Ampere VM runs k3s (single node) with two namespaces, `connectsphere-staging` and `connectsphere-production`. Vercel serves the web app, one project per environment. Each environment has its own Supabase project.** Staging and production differ only in credentials and hostnames: the same images (by digest), the same manifests (one overlay per environment, checked to be identical apart from namespace, hostnames and Secret names) and the same workflow.

- **In-cluster Kafka and Temporal, one of each per namespace.** A single-node Redpanda (the Kafka API, no ZooKeeper) with SASL/SCRAM on its only listener and TLS from a per-namespace cert-manager CA, and the Temporal CLI's dev server with its SQLite file on a PersistentVolumeClaim. The services reach them through the same `KAFKA_*` and `TEMPORAL_*` variables they already read: `KAFKA_SSL_CA_PATH` names the internal CA, and an empty `TEMPORAL_API_KEY` means a plain connection.
- **A Cerbos PDP per namespace** (for EN-07, ADR-0010), from an image with `policies/` compiled into it, at `CERBOS_URL`. Nothing calls it yet.
- **Traefik**, k3s's bundled ingress controller, exposes only `/<prefix>/api/v1` on one API host per environment, with the prefix stripped as Kong (EN-12) does; Kong is not on main, so Traefik routes straight to the services. **cert-manager** issues Let's Encrypt certificates over HTTP-01. Hostnames are free from **sslip.io** (`api.staging.<ip>.sslip.io`), or DuckDNS if Let's Encrypt's shared limit for sslip.io is exhausted.
- **CORS:** the SPA on Vercel is another origin, so each backend allows exactly its own environment's Vercel origin, read from `CORS_ALLOWED_ORIGINS`; the SPA calls the API at `VITE_API_BASE_URL`.
- **Images are built once per merge** for linux/amd64 and linux/arm64 on native runners, joined into one index per image in GHCR, signed keylessly with cosign and given a signed SBOM attestation (EN-21). The web image is not released: the SPA is built by Vercel's build step per environment.
- **Promotion is git:** the Release workflow commits the release (the commit and its digests) to `environments/staging` on a `deploy-state` branch, which Argo CD follows; after staging's smoke tests pass and the GitHub `production` environment's required reviewer approves, it commits the same commit and digests to `environments/production`. Rolling back is a revert on `deploy-state`, or a dispatch of the workflow with an earlier commit. CI never pushes to main.
- **Secrets** live only in the GitHub environments `staging` and `production`. The workflow writes each namespace's Secret over SSH, through a forced-command gate that accepts a fixed list of keys and talks to the cluster as a ServiceAccount limited to its own namespace.
- **Migrations** run as #75's migrate Job (an Argo CD PreSync hook) against the environment's Supabase **session pooler**, not the transaction pooler (the migrator uses prepared statements) and not the direct host (IPv6-only, and the VM is IPv4).

## Alternatives considered

- **ADR-0012 as written (EKS, RDS, ElastiCache).** About USD 150 a month idle, and nobody has the account. Kept as code, marked as the scale-up path, not used.
- **A free PaaS per service (Render, Railway, Fly.io).** Free plans sleep after idle minutes, cap hours or no longer exist, and none runs Kafka or Temporal. Each would also be a different deployment model from the one the team has built and tested (images, manifests, Argo CD).
- **Hosted Kafka and Temporal for the deployed environments too.** Aiven's free Kafka powers off after a day idle and allows five topics; Temporal Cloud has no free plan. Two environments would also share one cluster.
- **One namespace, or one Supabase project, for both environments.** Then staging could touch production data, and a staging migration would be a production migration.
- **The web app as the nginx image in the cluster.** It would work (EN-10 built it), but Vercel gives a CDN and TLS for nothing, and the VM's capacity goes to the backends.

## Consequences

**What we get:**
- Two real, always-on environments for nothing, deployed by the same pipeline on every merge, with production gated by an approval and receiving exactly the images staging tested.
- The deployment exercises what EN-10, EN-16 and EN-21 built: the images, the kustomize base, Argo CD, the migrate Job and keyless signing.

**What it costs (be honest about these in the Q&A):**
- **No high availability.** One VM, one node. If it stops, both environments stop; a k3s upgrade or a reboot is downtime. The pod replicas protect against a crashed process, not a lost machine.
- **In-cluster Kafka and Temporal instead of hosted ones.** One Redpanda broker and one Temporal dev server per environment, each with one replica and local storage: no broker replication, no Temporal history beyond the VM's disk, no Temporal UI exposed. Losing the VM's disk loses unconsumed messages and running workflows (the outbox and the database are in Supabase, so committed state is not lost). ADR-0008 and ADR-0009 now say development keeps the hosted cluster and namespace.
- **Staging and production share one machine.** A runaway staging workload can starve production; the namespaces, requests and limits are the only separation.
- **No canary on the VM.** EN-16's analysis needs EN-17's Prometheus, which the VM does not run, so the k3s overlays use rolling updates. The canary component stays in the EKS overlays.
- **Free-tier limits.** Supabase pauses a free project after a week without activity; Let's Encrypt's per-domain limit for sslip.io is shared with everyone who uses it; Oracle may reclaim an Always Free VM that stays idle, and new Ampere capacity in Singapore is often exhausted.
- **Owner steps.** GitHub environments need repository admin (Raphael), and the GHCR packages must be made public once by their owner.

**What a reviewer should watch for:** a change that makes staging and production differ in anything but credentials and hostnames (the Manifests job's parity check fails on it); a workflow step that prints a secret (the repository and its logs are public); and anything that makes the cluster reach the team's shared Supabase project.

**Implemented by:** the pull request "feat(deploy): free staging and production on k3s and Vercel", stacked on EN-21 (#85) and EN-10 (#75). Runbook: `documentation/deploy/README.md`.

## Amendment, 3 Nov 2026: Hugging Face Spaces instead of the Oracle VM (Joash)

**Context.** Oracle's Always Free tier needs a payment card to sign up, and Joash will not give one.
Hugging Face's free CPU Basic Docker Spaces (2 vCPU, 16 GB) need none, and Joash has an account.

**Decision.** Each environment's backend is one public Docker Space, `connectsphere-staging` and
`connectsphere-production`; they differ only in their Space secrets and variables. One container runs
everything: the four Node processes, Redpanda, the Temporal dev server and Cerbos under supervisord,
with Caddy on the one public port (7860) routing the same public prefixes as the k3s Ingress.
Migrations run at container start, against the session pooler. Joash deploys from his laptop with
`npm run deploy:space`, which reads the values from a folder outside the repository and never prints
one. A GitHub Actions cron keeps the Spaces awake. The k3s and Oracle path stays in the repository,
validated in CI, as the scale-up option; `release.yml` runs it once Raphael grants Admin.

**Consequences, beyond the ones above.**
- **Ephemeral disk.** Redpanda and Temporal lose their state on every restart and rebuild. Supabase
  holds the data, and the outbox republishes; timers scheduled before a restart are lost.
- **Egress.** A Space's outbound ports are filtered. Supabase's 5432 is reported open, and 6543 may not
  be, so the services fall back to the session pooler.
- **No signed images.** The Space is built by Hugging Face from the committed source, not from the
  signed GHCR images, so EN-21's signatures do not cover it.
- **Deploys are not gated by GitHub.** Production waits for a healthy staging Space, not for a
  reviewer's approval.
- **Sleep.** A Space sleeps after about 48 hours idle and takes a minute or two to wake.
