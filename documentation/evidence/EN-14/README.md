# EN-14 — Browser tests on an ephemeral CI stack

**Task:** EN-14 (SPM-132), Preview environments and browser tests. **Owner:** Joash.
**Criteria (plan §5):** a per-PR preview, or an ephemeral CI stack · Playwright E2E tagged with story
test ids · axe accessibility checks · visual snapshots at 360, 768 and 1280 px.

**Built:** the ephemeral CI stack, not a per-PR preview. A hosted preview needs a hosting account and a
database per pull request, and every database the team has is the shared Supabase project, which CI must
never touch (EN-06). The stack below gives every pull request the same thing a preview would, the real
web app against the real services, and throws it away when the job ends.

**Evidence run:** [run 41513983925](https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925) on commit 6080462 (and run [41516713095](https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41516713095) on b91681d after the 2030 date move): 101 test runs passed (83 journeys at 1280 px, 6 visual tests at each of 3 widths), none flaky, no axe violation.

## The stack

```mermaid
flowchart LR
  subgraph runner["GitHub Actions runner (the e2e job)"]
    PW["Playwright<br/>Chromium · 3 widths<br/>axe · toHaveScreenshot"]
    WEB["web app<br/>vite build + vite preview<br/>127.0.0.1:4173"]
    AUTH["fake Supabase Auth<br/>tests/e2e/support<br/>127.0.0.1:9999"]
    CORE["planning-core<br/>:8090"]
    NOTIF["notification<br/>:8091"]
    REG["registration<br/>:8092"]
    PG[("postgres:17 service container<br/>built by npm run migrate:all")]
  end
  PW -->|drives| WEB
  PW -. seeds through the API, from 127.0.0.2 .-> CORE
  WEB -->|"/identity /event /venue /equipment (proxy)"| CORE
  WEB -->|"/notification (proxy)"| NOTIF
  WEB -->|"password grant (browser)"| AUTH
  CORE -->|"password grant, logout"| AUTH
  CORE -->|JWKS| AUTH
  CORE --> PG
  NOTIF --> PG
  REG --> PG
```

`tests/playwright.config.ts` starts every process (Playwright's `webServer` list) and waits for each one's
readiness URL before the first test:

| Process | Command | Ready when |
|---|---|---|
| Fake Supabase Auth | `tsx tests/e2e/support/start-fake-auth.ts` | `GET /auth/v1/health` |
| planning-core | `tsx src/index.ts` | `GET /readyz` (needs the database) |
| notification | `tsx src/index.ts` | `GET /readyz` |
| registration | `tsx src/index.ts` | `GET /readyz` |
| web app | `vite build`, then `vite preview` | the page answers |

The web app is built inside the run, so its bundle always points at the fake auth server; `vite preview`
proxies the API prefixes to the services as the dev server does.

### Authentication without Supabase

`tests/e2e/support/fake-supabase-auth.ts` stands in for Supabase Auth (GoTrue). It implements only what
ConnectSphere calls:

| Endpoint | Called by |
|---|---|
| `POST /auth/v1/token?grant_type=password` | the browser (`frontend/src/api/session.ts`) and identity's login route (`supabaseAuthClient.ts`) |
| `POST /auth/v1/logout` | identity's logout route |
| `GET /auth/v1/user` | nothing yet; GoTrue's own check of a token, kept so the fake behaves like Supabase after logout |
| `GET /auth/v1/.well-known/jwks.json` | every service's `verifyJwt` (`SUPABASE_JWKS_URL`) |

At start it makes a new ES256 key pair, and it issues access tokens with Supabase's claims (`sub` = the
Supabase user id, `aud` and `role` `authenticated`, `email`, `session_id`, `aal`, `amr`, `iss`) for the
nine seeded accounts and their published test password. A wrong password and an unknown email get the
same refusal, so A1's rules are still enforced by identity, not by the fake.

**It can't run anywhere else.** It refuses to start without `E2E_FAKE_AUTH` set to its exact value, with
`NODE_ENV=production`, or with a `DATABASE_URL` that isn't on this machine; it listens on `127.0.0.1`
only and answers CORS only for the web app's origin. No service imports it, and nothing outside
`tests/` starts it. Its unit tests (`fake-supabase-auth.test.ts`) run in the unit job and verify its
tokens with `jose`, exactly as `shared/auth/verifyJwt.ts` does.

### Kafka and Temporal are left out

The services start without either. With `KAFKA_*` blank, planning-core's outbox relay doesn't start and
messages wait in the outboxes, and notification and registration don't start their consumers; each
answers `/readyz` with `kafka: not_configured`. No journey here needs a message to arrive. Temporal's
worker is a separate process the API doesn't call. So these are **not** covered in the browser:
notifications appearing (T2), seats being built from an approval (EN-13), and hold expiry (L6). A
Redpanda container could be added as a CI service later; the services' Kafka client needs TLS, which
is why it isn't a one-line change.

## How to run it

**In CI:** every pull request runs the `e2e` job. It isn't a required check. Artifacts:

| Artifact | What's in it |
|---|---|
| `playwright-report` | the HTML report: each test, its steps, and on failure its trace, video and screenshot |
| `playwright-test-results` | traces, videos and screenshots of failures; `axe-findings/` (every violation); `results.json` |
| `e2e-stack-logs` | each process's log |
| `visual-baselines` | the snapshots this run compared against, or wrote when one was missing |

The job summary lists every test with its tags, and every accessibility violation.

**Visual baselines** are made on the Linux runner, never on a laptop. A run with a missing baseline
writes it, fails that test softly and uploads `visual-baselines`; commit it with
`gh run download <run-id> -n visual-baselines -D tests/e2e/__screenshots__`. After a deliberate UI
change, run the workflow by hand (Actions → CI → Run workflow, tick `update_snapshots`, from `main`) and
commit the artifact the same way.

**Locally:** not possible without a database of your own. The config refuses any `DATABASE_URL` that
isn't on your machine, so it can never run against the shared Supabase database, and there is no local
Docker (ADR-0012). With a throwaway Postgres on your machine:

```bash
DATABASE_URL=postgres://<user>:<pw>@127.0.0.1:<port>/<db> npm run migrate:all
npx playwright install chromium
DATABASE_URL=postgres://<user>:<pw>@127.0.0.1:<port>/<db> npm run test:e2e        # or test-cases:run
DATABASE_URL=... npm run test:e2e -- --grep @D4                                   # one story
```

Visual comparisons are skipped off Linux. `E2E_PORT_OFFSET=10` moves every port if something already
listens on 8090, 9999 or 4173; the config never reuses a running server, since that could be a
teammate's `npm run dev` pointed at the shared database.

## What is covered

83 journeys at 1280 px, in `tests/e2e/`, plus the visual tests. Each is titled with its card id and tagged with its story and card.

| Area | Spec | Cards it runs |
|---|---|---|
| Sign-in and access | `a-sign-in-and-access.spec.ts` | A1-T1, T2, T3, T4, T5, T6, T9, T10, T11 · A2-T4 · A3-T1, T2, T4, T5 |
| Event requests and drafts | `b-event-requests.spec.ts` | B1-T1 (with B2-T14), B1-T6 · B2-T1, T3, T7, T12, T13, T15 · C1-T1, T3, T9, T10 · C2-T1, T3, T4 |
| Review and decisions | `d-review.spec.ts` | D1-T1, T2, T4, T6, T8 · D2-T1, T2, T5, T8 · D4-T1, T2, T4, T7 · D5-T1, T2, T6 |
| Venues and search | `h-venues.spec.ts` | H1-T1 · H2-T1 · J1-T1, T20 · J2-T3, T8 · K1-T12 |
| Bookings, holds, calendar, blocks | `l-bookings.spec.ts` | L1-T1 · M1-T1*, T3 · M2-T1, T2 · L3-T1, T5 · I1-T2*, T3*, T8* · I2-T1, T4, T6* |
| Equipment | `o-equipment.spec.ts` | P2-T1 to T8 · O1-T26 · Q1-T14* |
| Status, details, confirmation | `f-status-and-confirmation.spec.ts` | F2-T1, T2, T3, T5, T6 · G1-T1, T5 · F5-T21 |
| Changes | `s-changes.spec.ts` | S1-T13* · S2-T12* |
| Visual (360, 768, 1280 px) | `visual.spec.ts` | sign-in, new request, request detail, review, venue detail, availability week |

* Runs the card's steps but doesn't prove its whole expected result, so the card was not changed:
M1-T1 (the "other venue isn't listed" half needs a venue Venue Staff don't look after), I1-T2/T3/T8 (own
data rather than FX-CALENDAR's exact rows; I1-T8's "free periods unchanged" doesn't hold for an L1 request,
which has no setup or turnaround while pending), I2-T6 (who flagged it and when isn't exposed), and Q1-T14,
S1-T13, S2-T12 (their notifications need Kafka).

**Cards recorded as Pass from this run:** 78 story cards and EN-14-T1 to T8 (listed in the pull request).
Their records cite the spec, the exact test name and the run.

**Deviations from the cards, for a reviewer:** names carry a unique suffix; the venue cards' December 2026
dates move to 2027 (O1-T26, G1-T5 and P2-T4 to T8 move from December 2026 to December 2030, same times); since E3
a coordinator's queue holds only assigned requests, so D1's journeys start from an assigned request; checks
the cards make in the SQL editor run against the job's own database or the API the screen uses.

**Rate limits.** planning-core limits requests per address. Journeys start signed in the way the web app
records a sign-in (only A1's use the form), seeding comes from 127.0.0.2, and the preview proxy spreads the
browser's requests over 32 loopback addresses (`tests/e2e/support/vite-preview.config.ts`), as real users
have their own. The notification service still asks identity `GET /users/me` from one address, and the logs
show it refused about 90 times in a run, so the unread-count badge can be missing; no journey asserts it.

## Accessibility

Every screen a journey visits is checked with axe (`@axe-core/playwright`, WCAG 2.1 A and AA). Serious
and critical violations fail the test; no rule is switched off. Findings: [axe-findings.md](axe-findings.md).

## Not done

- **A hosted per-PR preview.** See above; the ephemeral stack is the criterion's alternative.
- **Flows that need Kafka or Temporal** (notifications, seat building, hold expiry), as above.
- **Cards only partly proven** by a journey stay as they were; the list is in the pull request.
