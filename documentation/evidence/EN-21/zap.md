# EN-21: ZAP baseline findings

The job `ZAP baseline (web app and planning-core API)` in `.github/workflows/supply-chain.yml` starts the
`web` (nginx) and `planning-core` images from this run, read-only with all capabilities dropped as in the
cluster, against a Postgres 17 service container that `connectsphere-migrate` has filled from every
migration. Then `zap-baseline.py` from `ghcr.io/zaproxy/zaproxy:2.17.0` (pinned by digest) spiders each
target for a minute. It is passive: it reads headers, cookies, error pages and scripts and sends no attack
traffic. No shared database is reachable from the job, and the Supabase values are `.invalid` placeholders
that cannot resolve.

Run with the figures below: <https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41519057637>
(commit `0e5d08b`). The HTML, JSON and Markdown reports and both services' logs are the `zap-report`
artifact of that run.

## Threshold

The job fails only on a rule that `.zap/rules.tsv` sets to **FAIL**. Nothing else fails it (`-I`).

- **FAIL** (eight rules): clickjacking header (`10020`), `X-Content-Type-Options` (`10021`), server
  version banner (`10036`), the three cookie flags (`10010`, `10011`, `10054`), permissive CORS (`10098`) and
  application error disclosure (`90022`, stack traces in a response). Both targets pass every one of them
  today, so a change that breaks one is a regression and is stopped.
- **WARN** (everything not listed): reported in the job summary and the report, not failing. The first scan
  found Medium and Low items on headers that other people own, so a red build would only have blocked
  this change on decisions that are not mine to make. Each is listed below.
- **IGNORE** (three rules), each with its reason on the line in the rules file.

The gate has been seen to work: commit `27f85bd` set `10038` (CSP not set) to FAIL for one commit, and the web
scan reported `FAIL-NEW: 1`, exited 1 and failed the job with the error from `run-zap-baseline.sh`
(<https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41520365688>). The next
commit reverts it.

## Result

| Target | PASS | WARN | IGNORE | FAIL |
|---|---|---|---|---|
| Web app, `http://127.0.0.1:8080` | 63 | 2 rules | 3 | 0 |
| planning-core API, `http://127.0.0.1:8090` | 64 | 3 rules | 1 | 0 |

### Web app

| Rule | Risk | What ZAP saw | Disposition |
|---|---|---|---|
| `10038` Content Security Policy header not set | Medium | `index.html` and every client-side path answer with `Content-Security-Policy-Report-Only`, not an enforcing header. ZAP also lists the informational "Report-Only header found". | Expected, WARN. `frontend/security-headers.inc` says the policy stays report-only until it has been walked through on staging. When it is promoted to `Content-Security-Policy` this clears. Owner: whoever promotes it (EN-10 follow-up, EN-23). |
| `90004` Cross-Origin-Embedder-Policy, Cross-Origin-Opener-Policy and Cross-Origin-Resource-Policy missing | Low | None of the three headers is sent. | WARN, not changed. `COOP: same-origin` can break a sign-in that uses a popup and `COEP: require-corp` blocks cross-origin resources that do not opt in; both need checking against the Supabase sign-in flow before they are added. For EN-23 to decide. |
| `10096` Timestamp disclosure (Unix) | Low | `1540483477` in the bundled JavaScript. | IGNORE. A constant inside a bundled library (in 2018), not a server clock or user data. |
| `10049` Storable and cacheable content | Informational | Fingerprinted assets with `max-age=31536000`, and `no-cache` on `index.html`. | IGNORE. That is the intended caching; an unauthenticated scan sees no user data. |
| `10109` Modern web application | Informational | The spider found no links, only a script. | IGNORE. See the limits below. |

### planning-core API

| Rule | Risk | What ZAP saw | Disposition |
|---|---|---|---|
| `10055` CSP: failure to define directive with no fallback | Medium (ZAP's rating) | The refusals carry `Content-Security-Policy: default-src 'none'` without `frame-ancestors` or `form-action`. | WARN, not changed. The responses are JSON and plain error pages that are never framed or posted to, so the practical risk is small. Adding the two directives is a one-line change to the API's header middleware, in code other pull requests are editing. |
| `10037` `X-Powered-By: Express` | Low | The header on every response. | WARN, not changed. Fix: `app.disable("x-powered-by")` in each service's `app.ts`; left out to keep this diff to its package. |
| `10063` Permissions-Policy header not set | Low | Not sent by the API (the web app sends it). | WARN, not changed. Same place as `10055`. |
| `10049` Storable and cacheable content | Informational | The 404 for `/`, `/robots.txt` and `/sitemap.xml`. | IGNORE, as above. |

## Limits of this scan

- **Unauthenticated.** It sees the web app's public shell and the API's refusals, not what a signed-in user
  can reach. The API answered `4xx` to everything the spider found (`/`, `/robots.txt`, `/sitemap.xml`), so
  the routes behind sign-in were not exercised. An authenticated scan needs a way to sign in on a throwaway
  stack; EN-14 (PR #79) has a fake Supabase Auth server for its browser tests that could be reused, but it is
  not merged. A natural next step is `zap-api-scan.py` in safe mode against `documentation/api/*.openapi.yaml`,
  which would put every documented route in front of the passive rules.
- **Few pages.** The web app is a single-page application and the standard spider follows links, so it saw
  four URLs (the shell, `robots.txt`, `sitemap.xml` and the assets). The client-side screens were not visited;
  the browser tests of EN-14 cover those functionally.
- **Passive only.** The baseline does not look for injection or access-control flaws. That is the job of
  the unit and integration tests, CodeQL, and the authorisation tests of each story.
- **Plain HTTP on 127.0.0.1.** Transport headers such as HSTS are not judged here; they belong to the Ingress
  and are checked by the EN-10 manifests.
