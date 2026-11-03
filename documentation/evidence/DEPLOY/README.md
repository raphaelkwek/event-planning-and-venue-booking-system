# Evidence: free staging and production on k3s and Vercel (ADR-0016)

What CI showed for the deployment on pull request #95, and what it could not show. The cards are in
`tests/DEPLOY/`, and the runbook is `documentation/deploy/README.md`.

**Run:** Deploy workflow https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41614563160 (commit `f76866586a318aa5852f75edab518cb95ffd7690`); CI https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41614563224; Supply chain https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41614563166.

## The k3s staging overlay on kind (`kind: k3s staging overlay`, deploy/ci/kind-k3s.sh)

Kubernetes v1.33.1 on kind, Traefik chart 40.1.0, cert-manager v1.21.3. Deploy state rendered from this commit's overlay on GitHub (`?ref=f76866586a318aa5852f75edab518cb95ffd7690`), identical under quay.io/argoproj/argocd:v2.14.11's kustomize.

| Check | Result |
|---|---|
| Deploy gate | wrote connectsphere-secrets (key names only), then unchanged; refused an unknown key, a malformed line, a missing key, an unknown verb, a short commit |
| Deployer RBAC | may not read production's or kube-system's Secrets, create pods or delete Secrets |
| Certificates | the API certificate (self-signed stand-in for Let's Encrypt) and Redpanda's internal-CA certificate Ready |
| Redpanda, Temporal, Cerbos | ready, under the restricted Pod Security Standard |
| migrate Job | complete through MIGRATE_DATABASE_URL (52 files), then 0 on a second run |
| `planning-core` | `/healthz {"status":"ok"}` |
| `planning-core` | `/readyz {"status":"ready","checks":{"database":"ok","kafka":"reachable"}}` |
| `registration` | `/healthz {"status":"ok","service":"registration"}` |
| `registration` | `/readyz {"status":"ready","checks":{"database":"ok","kafka":"reachable"}}` |
| `notification` | `/healthz {"status":"ok","service":"notification"}` |
| `notification` | `/readyz {"status":"ready","checks":{"database":"ok","kafka":"reachable"}}` |
| `cerbos` | `/_cerbos/health {"status":"SERVING"}` |
| Temporal worker | logged 'Temporal worker started' (connected to temporal:7233 and its Kafka consumers) and stayed up |
| TLS | Traefik presents the certificate for api.staging.ci.invalid; plain HTTP does not reach the API |

| Request | Status | Expected |
|---|---|---|
| `GET /identity/api/v1/users/me` (no token) | 401 | 401 with the error envelope |
| `GET /notification/api/v1/notifications` (no token) | 401 | 401 with the error envelope |
| `GET /registration/api/v1/...` | 404 | answered by registration, not Traefik |
| `GET /healthz` | 404 | not routed |
| `GET /readyz` | 404 | not routed |
| `GET /metrics` | 404 | not routed |
| `GET /identity/healthz` | 404 | not routed |
| `GET /identity/readyz` | 404 | not routed |
| `GET /registration/healthz` | 404 | not routed |
| `GET /notification/metrics` | 404 | not routed |
| `OPTIONS` from https://web.staging.ci.invalid | allowed | its own origin |
| `OPTIONS` from https://not-connectsphere.invalid | no CORS header | any other origin |

The run also caught a defect in EN-10's worker manifest. `planning-core-worker` exited at start-up
because it loads the identity module's `SUPABASE_URL` and `SUPABASE_ANON_KEY`, which its Deployment did
not pass. This was the first run with Temporal configured; the earlier jobs kept the worker at zero
replicas. The base is fixed, and the gate's health check now fails on a worker that restarts while it
watches.

## Images (DEPLOY-T1)

`Image (<name>)` on linux/amd64 and `Image arm64 (<name>)` on a native `ubuntu-24.04-arm` runner passed
for planning-core, registration, notification, migrate and cerbos. Each image started read-only,
non-root and with no capabilities, and answered its health check. Cerbos also allowed Venue Staff and
denied an attendee creating a venue, which proves the policies are compiled in.

## Manifests (DEPLOY-T3)

`Manifests (kustomize and kubeconform)` rendered `overlays/k3s-staging` and `overlays/k3s-production`.
Both passed `kubeconform -strict`, with the Traefik Middleware and cert-manager Issuer and Certificate
schemas from the CRDs catalog, and `check-rendered.py --no-canary`. `check-parity.py` found them
identical once the namespace, API host, TLS Secret name and middleware reference were normalised. The
deployer RBAC rendered for both environments also validated.

## Not shown, and why

| Not shown | Why | Card |
|---|---|---|
| The push to GHCR, the multi-arch index, the signature on it | `release.yml` runs only on main | DEPLOY-T2 |
| Let's Encrypt's HTTP-01 exchange, the Oracle firewall, Argo CD following `deploy-state`, Supabase Auth, Vercel | The accounts do not exist yet | DEPLOY-T12 |
| `bootstrap.sh` on a VM | No VM yet; CI runs shellcheck on it | DEPLOY-T13 |
| `npm run lead:create` against a project | No projects yet; its guard is unit-tested | DEPLOY-T14 |
