# DEPLOY — free staging and production on k3s and Vercel (ADR-0016)

An enabler with no screens. Its cards check the release pipeline: `.github/workflows/release.yml`
(main only), the Deploy workflow's pull-request jobs (`.github/workflows/deploy.yml`) and the unit
tests. No Jira key is assigned yet; the folder is named DEPLOY until one is.

| Criterion | Card | Status |
|---|---|---|
| Images are built multi-arch (linux/amd64 and linux/arm64) with buildx in CI. | DEPLOY-T1 | Pass |
| Every merge to main builds the images once, signs them (cosign keyless) and attests an SBOM. | DEPLOY-T2 | Not Executed |
| Staging and production overlays are identical apart from namespace, hostnames and Secret names. | DEPLOY-T3 | Pass |
| Redpanda (SASL/SCRAM), the Temporal dev server and a Cerbos PDP run in each namespace; their addresses and credentials arrive through KAFKA_*, TEMPORAL_* and CERBOS_URL. | DEPLOY-T4 | Pass |
| Expose only planning-core's public API and registration's public routes (and notification's, which the SPA calls), routed straight to the services while Kong is not on main. | DEPLOY-T5 | Pass |
| Traefik ingress with cert-manager and Let's Encrypt. | DEPLOY-T6 | Pass |
| Secrets live only in the GitHub Environments; the workflow reads them and writes the Kubernetes Secrets over SSH. | DEPLOY-T7 | Pass |
| Production deploys the SAME image digests as staging, after approval. | DEPLOY-T8 | Pass |
| CORS: the backends allow the Vercel origin of their own environment only, read from env. | DEPLOY-T9 | Pass |
| The web app is deployed to Vercel per environment with the VITE_* values per environment. | DEPLOY-T10 | Pass |
| Migrations run with the migrate Job against each environment's Supabase (session pooler, not the transaction pooler). | DEPLOY-T11 | Pass |
| Staging deploys automatically on every merge; production deploys the same digests after approval; smoke tests pass. | DEPLOY-T12 | Blocked |
| An idempotent bootstrap.sh run once on the VM over SSH, opening only 80 and 443 (plus 22). | DEPLOY-T13 | Blocked |
| Creating the first Lead user in each environment with that environment's service-role key and the identity tables. | DEPLOY-T14 | Blocked |
| documentation/deploy/README.md is the runbook and Joash's checklist. | DEPLOY-T15 | Blocked |
| Creating the first Lead user in each environment: the Lead sets their own password from the invite. | DEPLOY-T16 | Not Executed |

**What no card here shows on a pull request:** the Oracle VM, the two Supabase projects, the two Vercel
projects, Let's Encrypt and the GitHub environments do not exist until Joash creates them
(documentation/deploy/README.md). DEPLOY-T2 runs on the first merge to main; DEPLOY-T12 to T15 need
the accounts.
