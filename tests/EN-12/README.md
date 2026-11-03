# EN-12 — API gateway, rate limits, CDN

EN-12 is an enabler, so it has no screens. Its criterion (Jira plan, §5): **Kong with the JWT plugin
against the Supabase JWKS; per-user and per-IP rate limits backed by Redis; trace headers; separate
staff and public routes; a CDN in front of the SPA and the browse API.**

The cards run in the `Gateway` workflow (`.github/workflows/gateway.yml`): unit checks of the files,
`kong config parse`, and an integration job that starts a throwaway Postgres, Redis, the services and
two Kong containers. Containers are used in CI only (ADR-0012).

| Acceptance criterion | Cards |
|---|---|
| Kong in DB-less mode, declarative config in `gateway/kong.yml`, validated | EN-12-T1, T14 |
| Routes to planning-core, notification and the registration service | EN-12-T2 |
| JWT plugin against the Supabase JWKS | EN-12-T3, T4 |
| Separate staff and public routes | EN-12-T5, T14 |
| Per-IP limit on public routes, backed by Redis, 429 with Retry-After | EN-12-T6, T7 |
| Per-user limit on staff routes | EN-12-T8, T9 |
| Trace headers (`traceparent`, `x-correlation-id`) | EN-12-T10 |
| A CDN in front of the SPA and the browse API, never caching personal data | EN-12-T11, T12 |
| Deployable as code (Kubernetes manifests) | EN-12-T13 |

**What the cards do not prove.**
- **No CDN is deployed.** T12 proves the CloudFront configuration is well formed and caches only what
  the contract allows. No AWS account was used and nothing was applied.
- **No cluster.** T13 validates manifests; nothing was deployed to Kubernetes.
- **The real Supabase JWKS.** CI signs tokens with a fake JWKS server (the pattern of EN-14's fake
  Supabase Auth, CI-only). Key rotation on the real project is the same code path (T4) but was not run.
- **Production limits.** CI renders the configuration with small limits (20 and 15 a minute) so a test
  can cross them; the committed 600 and 300 a minute are checked in the file (T14), not by traffic.
- **Load.** EN-18 measures throughput. The gateway has not been load tested.
