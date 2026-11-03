# Deploy: staging and production on one Azure VM (ADR-0016 amendment)

**Timestamp:** 2026-11-04T02:00+08:00 (SGT)
**Author:** Joash
**Scope:** deploy/azure (create-vm.sh, cloud-init.yaml, deploy-vm.mjs), deploy/space (REDPANDA_MEMORY),
.github/actions/sign-and-attest, .github/workflows/deploy.yml (Space image on arm64), frontend (Set your password),
deploy/scripts/create-lead.mjs, documentation/deploy/README.md, ADR-0016's amendment, tests/DEPLOY.

**Deploy:** `npm run deploy:vm -- --env staging && npm run deploy:vm -- --env production` (documentation/deploy/README.md).

## Added

- create-vm.sh: one `Standard_B2pls_v2` VM (arm64, 4 GB) in `connectsphere-rg`, every resource tagged
  `project=connectsphere`, with a static IP, an NSG for 22, 80 and 443, and Docker from cloud-init. It is
  idempotent and touches nothing outside its resource group.
- `npm run deploy:vm` does the following:
  - builds the single-container image of the commit on the VM;
  - runs it once per environment behind a host Caddy (TLS, sslip.io hosts);
  - writes each env file over SSH with mode 600;
  - deploys the SPA to Vercel and sets each Supabase project's Auth URLs;
  - smoke-tests the API, readiness, Cerbos and the SPA.

  Production goes only while staging answers. `--seed` adds the demo users to staging only, and `--lead`
  sends the first Lead's invite.
- A Set your password screen (`#/set-password`), where invite and password-reset links land. lead:create
  now uses Supabase Auth's admin invite and never handles a password, which fixes CodeQL's
  js/clear-text-logging.

## Fixed

- The sign-and-attest action failed on main when an image digest already carried an attestation:
  `verify-attestation` returned two, and the counts did not compare. It now accepts the one just made
  among them.
- cloud-init's usermod line is quoted. Unquoted, `cut -d: -f1` is a YAML mapping.

## Not done / limits

- Both environments share 4 GB on one VM, which is not high availability. The images run there are
  built from source, not the signed GHCR ones.

---

# Deploy: the backend on Hugging Face Spaces (ADR-0016 amendment)

**Timestamp:** 2026-11-03T21:50+08:00 (SGT)
**Author:** Joash
**Scope:** deploy/space (Dockerfile, start.sh, supervisord.conf, Caddyfile, Redpanda config, deploy-space.mjs),
deploy/ci/space-smoke.sh, .github/workflows/deploy.yml (Space image), .github/workflows/keep-awake.yml,
deploy/release/smoke-api.sh, documentation/deploy/README.md, ADR-0016's amendment, tests/DEPLOY.

**Deploy:** fill `C:\Users\Joash Lau\connectsphere-secrets\` (two Supabase projects, the HF and Vercel tokens),
then `npm run deploy:space -- --env staging`, then `--env production` (documentation/deploy/README.md).

## Added

- One free CPU Basic Docker Space per environment, public. One container runs planning-core, its worker,
  registration and notification, plus Redpanda (SASL/SCRAM over TLS), the Temporal dev server and Cerbos,
  under supervisord. Caddy on port 7860 routes the k3s Ingress's public prefixes, plus a static /healthz.
- start.sh runs the migrations against the session pooler before anything starts. It falls back to the
  session pooler for the services if the transaction pooler's port is blocked on the Space.
- `npm run deploy:space -- --env staging|production` deploys from the laptop and never prints a value. It
  builds the SPA on Vercel, creates the Space, sets its secrets and its CORS origin, pushes the committed
  source, waits for it to run and smoke-tests it. Production goes only while staging is up.
- CI's Space image job builds the image from the same Space repository and runs it as a Space would,
  against a throwaway Postgres. A cron hits each listed Space's /healthz every 6 hours to keep it awake.
- DEPLOY-T17 and T18, with traceability rows.

## Changed

- The runbook leads with the Hugging Face path and a short checklist. The Oracle k3s path and
  `release.yml` stay as the documented scale-up option.

## Not done / limits

- **Blocked: Hugging Face refused the probe Space with HTTP 402.** Docker Spaces on free cpu-basic now need
  a PRO subscription. Nothing was created. The single-container image stays host-independent and proven in CI.
  The egress probe (`npm run deploy:space -- --probe`) is ready for whichever host Joash chooses.
- Ephemeral disk: Redpanda and Temporal start empty after a restart. The Space is built from source, so
  EN-21's image signatures do not cover it.

---

# Deploy: free staging and production on k3s and Vercel (ADR-0016)

**Timestamp:** 2026-11-03T17:35+08:00 (SGT)
**Author:** Joash
**Scope:** .github/workflows/release.yml, .github/workflows/deploy-environment.yml, .github/workflows/deploy.yml,
deploy/k8s/components/k3s, deploy/k8s/overlays/k3s-staging and k3s-production, deploy/argocd/k3s, deploy/oracle,
deploy/release, deploy/scripts, deploy/cerbos, vercel.json, CORS in planning-core, registration and notification,
the SPA's API base URL, documentation/deploy/README.md, ADR-0016 and notes on ADR-0008, 0009 and 0012.

**Deploy:** nothing deploys until the accounts exist. Follow documentation/deploy/README.md steps 1 to 8 (Oracle VM,
two Supabase projects, two Vercel projects, the deploy keys and bootstrap.sh, the GitHub environments, which Raphael
creates, the first release, the first Lead in each environment).

## Added

- ADR-0016 (decided by Joash, 3 Nov 2026): staging and production on one Oracle Cloud Always Free Ampere VM (k3s,
  one namespace each), the web app on Vercel (one project each), one Supabase project each. They differ only in
  credentials and hostnames: the same image digests, manifests and workflow. EN-10's EKS Terraform stays, marked
  as the scale-up path.
- A k3s component over EN-10's base. A Traefik Ingress exposes only `/<prefix>/api/v1` on the API host, with the
  prefix stripped as the dev proxy and Kong do (Kong is not on main). cert-manager issues TLS from Let's Encrypt.
  Each namespace also runs its own Redpanda (SASL/SCRAM over TLS from a cert-manager CA), a Temporal CLI dev server
  (SQLite on a PVC) and a Cerbos PDP built from policies/ (for EN-07; nothing calls it yet). The services reach them
  through the KAFKA_*, TEMPORAL_* and CERBOS_URL variables they already read. NetworkPolicies cover each path.
- release.yml. Each merge to main builds every image once per architecture, on native amd64 and arm64 runners, and
  joins each into one GHCR index that is signed keylessly and gets an SBOM attestation (EN-21's action). It then
  deploys staging, and production with the same commit and digests once the `production` environment's reviewer
  approves. A dispatch with an earlier commit redeploys that release's signed images.
- deploy-environment.yml, one reusable workflow for both environments:
  - checks the environment is complete and verifies every signature;
  - writes the namespace's Secret over SSH through a forced-command gate (deploy/oracle/connectsphere-deploy) that
    accepts only known keys, prints key names only and acts as a ServiceAccount limited to its namespace;
  - commits the release to environments/<env> on the deploy-state branch, which Argo CD follows;
  - waits for Synced and Healthy, then smoke-tests the services, the public API over TLS and CORS;
  - builds and deploys the SPA to Vercel and smoke-tests it.
- deploy/oracle/bootstrap.sh installs k3s, cert-manager, Argo CD, the namespaces, the Applications and the gate on
  the VM. It opens 80 and 443 next to 22 and fixes Oracle's iptables REJECT rules, and is safe to run twice.
- `npm run lead:create` creates an environment's first Event Coordinator Lead with that project's service-role key:
  Supabase Auth's admin invite and the identity tables. The invite's link opens a new Set your password screen
  (`#/set-password`, which password-reset links reach too), so the Lead sets their own password and the script
  never handles or prints one. It refuses unless both URLs belong to the project ref you typed.
- CORS from CORS_ALLOWED_ORIGINS in the three services (exact https origins only, nothing changes when it is unset),
  and VITE_API_BASE_URL in the SPA (relative paths stay the default).
- CI on pull requests: arm64 builds and smoke checks of the five released images; the k3s overlays rendered,
  kubeconform-validated and checked for staging/production parity; a kind run of the k3s staging overlay with
  Traefik, cert-manager, the gate, the deploy state rendered from the commit's overlay on GitHub, Redpanda, Temporal,
  Cerbos and the smoke tests; actionlint and shellcheck. tests/DEPLOY/ holds 15 cards and the traceability rows.

## Changed

- deploy.yml no longer pushes or signs images. The Release workflow does, so the signing identity is now
  release.yml@refs/heads/main (documentation/supply-chain.md, EN-10-T2 and EN-21-T4 point there). The web image is
  still built and checked on pull requests but is not released: Vercel builds the SPA per environment.
- check-rendered.py checks StatefulSets and init containers too, and takes --no-canary for the k3s overlays. The
  canary needs EN-17's Prometheus, which the VM does not run, so the k3s overlays use rolling updates.
- The deploy tests build every fake credential at run time, so CI's gitleaks scan (which covers every fetched
  branch) never sees a credential-shaped literal.

## Not done / limits

- Nothing has been deployed. There is no Oracle VM, Supabase or Vercel project, GitHub environment or run of
  release.yml on main yet. DEPLOY-T2 and T12 to T15 wait on them.
- No high availability: one VM for both environments, with one broker and one Temporal process per namespace.
- Let's Encrypt is not exercised in CI; kind uses a self-signed issuer of the same name. sslip.io is not on the
  Public Suffix List, so its certificate limit is shared with everyone; the runbook gives DuckDNS as the fallback.
- The GHCR packages must be made public once by their owner (Raphael) after the first release.
