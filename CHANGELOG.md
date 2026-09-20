# Changelog

> **Convention — read before editing this file:** entries are newest-first. When adding a new entry, insert it directly below this header, above every existing entry. Never append to the bottom. This header itself never moves and is never treated as an entry.

---

# Correct the Sprint 1 scope to A1–E2, and move F1 to Sprint 2

**Timestamp:** 2026-09-20T23:05+08:00 (SGT)
**Author:** Seann, via Claude
**Scope:** `documentation/sprint allocation.csv`, plan.md §9, definition-of-done.md, the traceability files, the notification cases.
**Reason:** The planning documents said Sprint 1 ran A1–E2 **plus F1**, at 52 points. Sprint 1 was
scoped to A1–E2 only. Every document that said otherwise now agrees.

## The allocation

| Sprint | Stories | Points |
|---|---|---|
| 1 (Weeks 4–5) | A1, A2, A3, B1, B2, C1, C2, C3, D1, D2, D3, D4, D5, E1, E2 | **47** |
| 2 (Weeks 6–7) | **F1**, F2, T2, F3, G1, H1, H2, I1, J1, J2, K1, O1, O2, P2 | **46** |
| 3 (Weeks 8–9) | unchanged | 55 |
| 4 (Weeks 10–11) | unchanged | 47 |

Still 195 points across 54 stories. The sprint table and the CSV were checked story-for-story
against each other after the change; all four sprints match.

**F1 needs saying plainly at the review.** B1, C2 and D1 all change an event's status, so the
transition rule had to be written inside Sprint 1 for those stories to work at all. Sprint 1 is
scoped to A1–E2, so **F1 is not counted there**: the story — the full lifecycle, its permitted
transitions and the history view — is Sprint 2 work. plan.md §9.1 says so rather than implying the
code appeared in Sprint 2.

## Changed to match

- **`sprint allocation.csv`:** F1 moves to Sprint 2 (weeks 6–7) with its reason rewritten. F2 is
  "Unchanged" (it was always Sprint 2, alongside F1), and T2 is "Moved earlier" from Sprint 4 —
  neither was ever Sprint 1 scope, so "Not delivered in Sprint 1" was the wrong reason for both.
- **plan.md §9:** the sprint table, the totals paragraph, the F1 and T2 entries in §9.1, the
  Sprint 1 outcome in §9.2, and the cross-sprint note that pairs F5 with F1.
- **definition-of-done.md:** its examples of Sprint 1 stories that cross a service boundary cited
  F1 and T2; they now cite D1's move to Under Review and B1's notification event.
- **Traceability:** `sprint-1.csv` holds all fifteen Sprint 1 stories (D2–D5 and E2 moved in from
  sprint 2), and `sprint-2.csv` now holds F1.
- **The six notification cases and `tests/T2/README.md`** said T2 "was planned for Sprint 1"; they
  say it is counted in Sprint 2.

Not touched: the meeting transcripts and the Superpowers spec and plan, which are dated records of
what was believed at the time.

---

# Split the blocked notification cases, and record T2 as descoped from Sprint 1

**Timestamp:** 2026-09-20T22:10+08:00 (SGT)
**Author:** Raphael, via Claude
**Scope:** A3, B1, D2, D3, D4, D5, E1, T2
**Reason:** Eleven cases were recorded `Blocked` on 2026-09-20. `Blocked` was doing two different
jobs: "this should run today and doesn't" and "this describes a story nobody has built". The second
kind isn't a defect and isn't this sprint's problem, but it read like one — and for the six
notification cases it also hid the fact that the half of each case B1/D2–D5/E1 actually own is
implemented and testable right now.

## Changed

- **Six notification cases now test the trigger they own**, against `event.outbox` via the SQL
  editor, and are `Not Executed` pending a run: B1-T5 (`event.submitted`), D2-T7
  (`event.clarification-requested`), D3-T8 (`event.clarification-responded`), D4-T5
  (`event.approved`), D5-T7 (`event.rejected`, carrying the reason), E1-T2
  (`event.coordinator-assigned`, naming the assigned coordinator). Each card carries a note saying
  what was split and where the other half went. Files were renamed to match the new scenarios.
- **D4-T6** ("approval creates no booking or reservation") no longer asks for two lists that don't
  exist. The outbox is the only way the Event service asks another service to act, so the assertion
  is now that approval emits exactly `event.submitted`, `event.coordinator-assigned` and
  `event.approved` — nothing that would book or reserve. It is executable today.
- **A3-T7, A3-T8 and A3-T9** are `Not Executed`, not `Blocked`, each naming the story and sprint it
  waits for (R1/F5, H1/L1, O1/Q1). These could not be split — no Sprint 1 surface, API or record
  carries an attendee, venue-staff or technical-support view, so no half of them runs today.
- **`tests/README.md`** now defines the boundary between `Blocked` and `Not Executed`, and says to
  split a case rather than block it when only part of it reaches into an unbuilt story.

## Added

- **`tests/T2/`** — the six reader-half cases, T2-T1 to T2-T6, all `Not Executed`, plus a README
  explaining what T2 needs (outbox relay, Notification Service, notifications screen), which case
  each was split from, and that nothing in the folder counts towards Sprint 1's Definition of Done.

## Noted, not changed

- **T2 is descoped from Sprint 1, not deferred quietly.** `plan.md` §9.1 pulled T2 *into* Sprint 1
  because removing T1 put notification ACs on B1, D2–D5, E1 and E2; §9.2 already records that it was
  not started and carried to Sprint 2. This entry makes the test cards agree with the plan. Building
  T2 now would mean the outbox relay, Kafka and a third service — Sprint 2 work, already priced
  there at 41 points.
- **The Sprint 1 Definition of Done is not met by A3, and the team should say so at the review.**
  It requires every case to Pass, and names "T2's notification trigger" as an example of the
  cross-cutting end-to-end bullet. The six trigger cases satisfy that bullet once run. A3-T7/T8/T9
  cannot be satisfied in Sprint 1 — that is a real gap in A3's role coverage, to be raised rather
  than papered over.
- **T2-T1 … T2-T6 do not exist in Jira.** `tests/README.md` ties a case ID to its Jira Test issue;
  these six issues still need creating under T2.

## Verified

- Markdown only; no source changed. `git diff --check` reports no whitespace errors.
- The six trigger expectations were read off the implementation, not assumed: `EVENT_PAYLOAD_SCHEMAS`
  in `backend/packages/contracts/src/eventEvents.ts` for the field names, and the `writeOutbox` calls
  in `submitEvent.ts`, `clarifications.ts` and `decisions.ts` for which message each flow emits.
  `review.ts` emits nothing, which is what makes D4-T6's three-message expectation exact.
- **Not executed.** Every revised card is left `Not Executed` for the sprint's runner; no card was
  marked Pass without a run.

---

# B1 and B2 functional test execution with screenshot evidence

**Timestamp:** 2026-09-20T16:48+08:00 (SGT)
**Author:** Joash Lau Rong Wei, via Hermes
**Scope:** B1, B2
**Reason:** Re-run every event-request creation and validation functional test against the hosted
Supabase-backed application, preserve one screenshot per case, and replace the cards' execution
records with the latest verified observations.

## Added

- **21 dated screenshots** under `tests/B1/evidence/` and `tests/B2/evidence/`, one for every B1/B2
  functional test card.

## Changed

- **All 21 B1/B2 execution records** now identify the tested commit, evidence file, executor and
  execution date. Twenty cases passed. B1-T5 remains Blocked because the Notifications/T2
  user-facing feature is not implemented.
- **B2-T14** was reconciled with the latest card specification: the successful request detail shows
  `Equipment requirements — None required`, so the case passes. The temporary wording-mismatch issue
  raised against the superseded expectation was closed.

## Verified

- The full `npm test` suite and `npm run build` both pass after synchronising with `origin/main`.
- Test data was reset after the run, and `git diff --check` reports no whitespace errors.

---

# Sprint 1 Definition of Done

**Timestamp:** 2026-09-19T21:24+08:00 (SGT)
**Author:** Sahanya, via Claude
**Scope:** none (process document, no story).
**Reason:** Sprint 1's gradable evidence is manual functional test cases, not the automated suite
implementation.md §8.3 assumes — the curriculum hasn't covered scripted testing yet. The team needed
a written, Sprint 1-specific Done bar rather than deferring to §8.3.

## Added

- **`documentation/planning/definition-of-done.md`** — the Sprint 1 Definition of Done. Marked
  *Proposed*, pending team sign-off. Explains why it differs from implementation.md §8.3 (manual test
  cases as the primary gate, automated tests a bonus); a per-story Done checklist (merged to `main`,
  a test case per acceptance criterion written before it's run, happy-path plus a negative case,
  end-to-end coverage for cross-cutting stories, every case executed and Pass, demoed to the PO, Jira
  moved to Done); the professor's test case template split into a written-once spec and a per-run
  execution record; a placeholder location for the cases (`documentation/test-cases/sprint-1.csv`,
  pending the repo cleanup pass); and a note that implementation.md §8.1–§8.3 take over from Sprint 2
  once scripted testing is covered.

---

# Coordinator reassignment (E2), and finishing E1's remaining ACs

**Timestamp:** 2026-09-18T11:36+08:00 (SGT)
**Author:** Shawmya, via Claude
**Scope:** E1, E2
**Reason:** E2 (propose/accept/decline reassignment of an event's coordinator) was built inside the
Event Service, following the same domain → repo → api → outbox pattern the rest of the service
already uses.

## Added

- **E2 — propose/accept/decline reassignment.** New table `event.reassignment_proposals`
  (migration `0004`), with a partial unique index enforcing "only one pending proposal per event" at
  the database level rather than a read-then-write check — the same technique as E1's
  `assignments_one_active_per_event`. New endpoints under
  `/api/v1/events/:id/reassignment-proposals` (list, propose, accept, decline) in a new
  `api/reassignments.ts`, and three new event types/topics
  (`reassignment-proposed`/`-accepted`/`-declined`) plus five error codes in `@connectsphere/contracts`.
- **E1 domain coverage:** `canProposeReassignment` and `isSelfNomination` pure functions, unit-tested
  alongside `allocateCoordinator`.
- Reassignment UI in `ReviewDetail.tsx` (propose modal, pending state, accept/decline for the
  nominee) and a read-only pending-reassignment note in `RequestDetail.tsx`, using Atlaskit
  components throughout (implementation.md §7.1) rather than the discarded banner's inline styles.
- Functional test cases `/tests/E1/` (4 cases) and `/tests/E2/` (8 cases), and their rows in
  `documentation/traceability/sprint-2.csv`. `EVENT_COORDINATOR_POOL` in `.env.example` now lists
  both seeded coordinator accounts so E1's round-robin and E2's reassignment are both demonstrable
  against the standard test environment.

## Fixed

Found by running the migration and the automated suite, then clicking through the app against the
real Supabase project — not by reading the code.

- `tests/fixtures/reset-test-data.sql` deleted an event's `event_history`, `clarifications`,
  `assignments` and `outbox` rows before deleting the event itself, but never deleted its
  `reassignment_proposals` rows. Since that table has a foreign key back to the event, resetting
  test data for an event with a proposal on it would have failed outright. Added the missing
  `delete` line, in the same position the other child tables already had one.
- `repo/events.ts`'s `claimForReview` — run the first time any coordinator opens a Submitted
  request — always returned a hardcoded `null` for `assigned_coordinator_id` instead of the real
  value, a pre-existing quirk from before E2. It never mattered until now, because nothing
  previously depended on that field being correct in that one response. E2's "Propose reassignment"
  button does depend on it (it only renders for whoever the assigned coordinator actually is), so
  the bug surfaced immediately on first click-through: the request showed "Awaiting assignment" and
  no reassignment button, even though `event.assignments` had the correct row all along. Fixed the
  query to correlate against `event.assignments` instead of hardcoding the column.
- The shared `.env` used for manual testing predated `EVENT_COORDINATOR_POOL` existing at all, so
  the pool was empty and every submission sat at "Awaiting assignment." Added the same value
  `.env.example` already carries. Not a code change — `.env` isn't committed — but recorded here
  because it's why the `claimForReview` bug above wasn't caught until now; anyone whose local `.env`
  predates this story needs the same line added by hand.

## Changed

- `ReviewDetail.tsx` — "Propose reassignment" moved out of its own "Coordinator assignment" section
  and into the same button group as Approve/Reject. Product feedback after clicking through it live:
  as a separate, differently-styled button below a second heading, it read as a lesser, secondary
  action, when it's a peer action a coordinator chooses between, same as the other two. The
  pending-proposal state and the nominee's Accept/Decline stayed where they were, since those
  describe a different actor's decision, not a peer action of the current coordinator's.

## Known gap, raised rather than silently built around

- E2's "the nominee does not gain coordinator actions until they accept" is not actually enforced
  for Approve/Reject/clarification: D1–D5 already let *any* `EVENT_COORDINATOR` act on a request
  regardless of who is assigned to it (only accept/decline of the reassignment proposal itself is
  nominee-scoped). Restricting D4/D5 to the assigned coordinator would change D1's existing
  open-queue review model and is outside E2's stated scope — see `/tests/E2/E2-T8-...md`.

---

# Run the functional test cases automatically, and correct the Sprint 1 allocation

**Timestamp:** 2026-09-20T15:20+08:00 (SGT)
**Author:** Seann, via Claude
**Scope:** `tests/` (A1–E2), `documentation/sprint-reallocation.csv`, plan.md §9, the review screen (E2).
**Reason:** The 123 written test cases had never been executed, and the sprint record still showed
what was planned rather than what Sprint 1 delivered.

## Sprint 1, as delivered

`sprint-reallocation.csv` now records the actual allocation, and plan.md §9 matches it:

- **D2, D3, D4, D5 and E2 moved into Sprint 1** — the whole review workflow and the reassignment
  handshake were finished there, though D2–D5 and E2 had been planned for Sprint 2.
- **F2 and T2 moved out to Sprint 2** — neither was built. F1 records the status history, but
  nothing shows it (F2); submission and decisions write notification events to the outbox, but
  there is no notification record, read model or screen (T2).
- **Sprint 1 delivered 52 points against a planned 44**, and Sprint 2 now carries 41. §9.2 records
  the outcome: more points than committed, while still missing two committed stories.
- Fixed a pre-existing inconsistency: **R1 sat in Sprint 4 in the CSV** but in Sprint 3 in plan.md
  §9.1 and its table. The CSV now says Sprint 3, which is what made the totals agree (195 across
  54 stories).

## The cases now run themselves

`npm run test-cases:run` executes all 123 cases against the running app in real Chrome and **writes
each result into that case's own execution record** — actual result, status, the commit it ran
against, the evidence screenshot and the date. A full run takes about seven minutes.

- **One script per story**, beside its cases: `tests/<story-id>/<story-id>.spec.ts`.
- **Shared harness** in `tests/support/`: the accounts and standard request of `tests/README.md` as
  constants, the FX-… fixtures, screen helpers, and the reporter that writes the records.
- **`tests/playwright.config.ts`** — one worker (the cloud database and seeded accounts are
  shared), test data reset before every case, and it starts `npm run dev` itself if the stack is
  not already up.
- Three deliberate differences from a person doing it by hand, all documented in `tests/README.md`:
  pre-conditions are built through the API rather than by clicking; cases that are not about
  signing in start with the session already seeded (signing in 120-odd times trips Supabase's rate
  limit on password grants); and where a case says to wait a minute for a timestamp to move, the
  script waits seconds and compares the stored timestamps.

## This run: 112 Pass, 0 Fail, 11 Blocked

**One defect was found and fixed.** E2-T7 says "Propose reassignment" is not shown once a request is
Rejected. The server refused correctly (`409 REASSIGNMENT_NOT_PERMITTED`), but the review screen
still rendered the button — disabled — on any decided request, promising an action that can never
be taken. `frontend/src/screens/ReviewDetail.tsx` now leaves it out entirely once a decision exists,
and `frontend/tests/reassignmentOffer.test.tsx` holds it there: offered while under review, absent
once approved or rejected. E2-T7 passes on the re-run.

**Eleven cases are Blocked**, each with its reason in the record — they describe screens that
Sprint 1 never built: the notification cases (B1-T5, D2-T7, D3-T8, D4-T5, D5-T7, E1-T2) need T2;
A3-T7 needs the attendee surface, A3-T8 venues, A3-T9 and D4-T6 equipment. E1-T3 needs the Event
service restarted with an empty coordinator pool, which a shared run cannot do — run it by hand.

## Also changed

- **Four case specifications were corrected**, each noted in the case file: A1-T1/T2/T3 expected the
  header to show the role code (`EVENT_ORGANISER`), which became "Event Organiser" on 2026-09-17;
  B2-T14 expected "Equipment required: No", which became "Equipment requirements: None required"
  when requirements were added the same day.
- **Every card's "Created By" now names a person alone** — "Seann" (and "Shawmya" on the twelve she
  wrote) rather than "…, via Claude" — and **"Executed By" reads "Joash"**, who owns the runs this
  sprint. The runner writes that name; it is a sprint-level convention, deliberately not written
  into implementation.md, because the test workflow changes next sprint.
- **`EVENT_COORDINATOR_POOL` now lists both seeded coordinators** in `.env.example` (and locally in
  `.env`). `tests/README.md` already assumed this — A3-T5 and the E2 handshake need two.
- **`.gitignore`**: Playwright's `test-results/`, `playwright-report/`, and `tests/*/evidence/`,
  which every run rebuilds.
- **New dev dependency:** `@playwright/test`. It drives the installed Chrome, so no browser
  download.

---

# Drop Docker; plan for one hosted Kafka cluster

**Timestamp:** 2026-09-18T00:35+08:00 (SGT)
**Author:** Seann, via Claude
**Scope:** whole repository — setup, run instructions and the architecture documents. No app behaviour change.
**Reason:** Nobody ran Docker: every service, test and the web app already ran as plain Node against
the hosted Supabase project, and no script or README step used the compose file. Its only real
future use was running Kafka, and a single hosted cluster serves the team without anyone installing
Docker or Java. Recorded as **ADR-0003**.

## Removed

- `docker-compose.yml` and the Identity and Event `Dockerfile`s.

## Added

- **`npm run dev` at the repo root** starts Identity (`:8081`), Event (`:8082`) and the web app
  (`:5173`) together in one terminal, each line prefixed with its source. It replaces three separate
  terminals. Uses `concurrently` 9 (a new root dev dependency; version 10 needs Node 22 and the
  project pins Node 20).
- **`documentation/adr/0003-no-docker-hosted-kafka.md`**, and its row in the ADR index.

## Changed

- **`.env.example`:** Kafka is now a hosted bootstrap server with `KAFKA_SASL_MECHANISM`,
  `KAFKA_SASL_USERNAME` and `KAFKA_SASL_PASSWORD`. The Supabase values are placeholders for the
  hosted project, including the transaction pooler for `DATABASE_URL`, instead of a local Supabase
  that needed Docker.
- **`plan.md`:** §2 Messaging and Deployment rows, the Kafka row in §3, the §8 topology and how the
  stack starts, and the Sprint 1 risk note in §9.2.
- **`implementation.md`:** §1 stack table (database, messaging, testing), the §2 root listing, the
  §8.1 E2E row, the §10 required variables and cloud-readiness rule, and the open items in the
  appendix: choosing the Kafka provider, and naming consumer groups so teammates sharing the cluster
  don't consume each other's messages.
- **README:** setup no longer runs `supabase start`, and uses `npm test` and `npm run dev`.
- **`CLAUDE.md`:** agents are told the project has no Docker.
- A comment in the Event service's `config.ts` that referred to Docker.

## Not yet done

- **No Kafka provider is chosen and no cluster exists.** No service publishes to Kafka yet, so
  nothing breaks in the meantime.
- **`backend/supabase/config.toml` is still in the repo.** It only configures `supabase start`, which
  needs Docker, so it is now unused.

---

# Reorganise the repository into frontend, backend, documentation and tests

**Timestamp:** 2026-09-17T23:45+08:00 (SGT)
**Author:** Seann, via Claude
**Scope:** whole repository — no behaviour change.
**Reason:** Implements `documentation/proposals/2026-09-17-repository-reorganisation.md`. The root
mixed the app, the services and their data, and writing about the project, and had both `docs/`
and `documentation/` doing the same job. Everything is now grouped by what it is.

## Moved (all with `git mv`, so history follows each file)

| From | To |
|---|---|
| `apps/web/` | `frontend/` |
| `services/identity/`, `services/event/` | `backend/services/identity/`, `backend/services/event/` |
| `packages/contracts/` | `backend/packages/contracts/` |
| `scripts/migrate.ts` | `backend/scripts/migrate.ts` |
| `supabase/` | `backend/supabase/` — run the CLI as `npx supabase … --workdir backend` |
| `tsconfig.base.json` | `backend/tsconfig.base.json` |
| `Planning/` | `documentation/planning/` |
| `docs/superpowers/` | `documentation/superpowers/` |
| `packages/testkit/sprint-<n>/traceability.csv` | `documentation/traceability/sprint-<n>.csv` |
| `scripts/confluence-digest.ts` and its test | `documentation/scripts/` |

`tests/` stays at the root. The sprint flow tests of implementation.md §8.2 will go in
`tests/flows/sprint-<n>/` when they are written.

## Changed to match

- **Root `package.json`:** workspaces are `frontend`, `backend/services/*`, `backend/packages/*`;
  the `migrate*`, `seed:auth`, `confluence:digest` and `test:scripts` paths. `package-lock.json`
  regenerated, a pure rename of the four workspace entries — no dependency versions changed.
- **`backend/scripts/migrate.ts`** reads `backend/services/<name>/migrations`.
- **Each service:** the `--env-file` in `dev` and the `.env` path in `vitest.config.ts` gain one
  `../`. The `tsconfig.json` `extends` paths did not need changing, because the base config moved
  into `backend/` along with them.
- **Both Dockerfiles and `docker-compose.yml`:** every `COPY`, `CMD` and `dockerfile:` path. Not
  built here — Docker was not run, so check the images before relying on them.
- **`frontend/vite.config.ts`** reads `.env` from one level up instead of two.
- **Docs:** implementation.md §2 layout rewritten, plus its path mentions in §1, §3, §4, §7, §8
  and §11; plan.md's `sprint-reallocation.csv` link; the ADR README; README (new folder table,
  Supabase and seed paths); `tests/README.md` and `tests/TEMPLATE.md`; the traceability files'
  `test_file` column. The proposal's status now says it is implemented.
- **New `CLAUDE.md`** at the root. It points agents at implementation.md §2 and tells the
  Superpowers plugin to write specs and plans under `documentation/superpowers/`.

Not changed: the entries below in this file, and the dated spec and plan under
`documentation/superpowers/`. They are records of what happened, so they keep the paths of their
time.

## Before you pull

This renames nearly every file. Push any open work first, pull before touching the repo again, and
tell your Claude session the layout changed.

---

# Fix what a browser click-through of the web app found

**Timestamp:** 2026-09-17T23:27+08:00 (SGT)
**Author:** Seann, via Claude
**Scope:** web app (D5, C3, A2 screens).
**Reason:** The earlier fixes were checked by jsdom tests and API calls only. Clicking through the
new request form, review, rejection dialog and All events screens in a real browser (Chrome, driven
by Playwright) found one broken action and three smaller issues.

## Fixed

1. **The rejection dialog now opens** (D5). In the browser, clicking Reject did nothing: the app was
   mounted in React `StrictMode`, whose development-only effect replay makes `@atlaskit/portal`
   detach its container, so every Atlaskit modal rendered into a node that was not on the page. The
   jsdom test missed it because it rendered `<App />` without `StrictMode`. The mounted tree now
   lives in `apps/web/src/Root.tsx` (no `StrictMode`, with the reason in a comment), `main.tsx`
   renders it, and `tests/root.test.tsx` renders the same `Root` so this cannot regress unseen.
2. **"New request" on My requests is one button, not a button inside a link.** Nested interactive
   elements are invalid HTML and screen readers announce them twice.
3. **The header shows the role in words** ("Event Coordinator") instead of its code
   (`EVENT_COORDINATOR`).
4. **Spacing under the All events and Review queue headings**, which sat flush against the controls
   below them.

## Checked, no change needed

- Venue requirements and equipment lines on the new request form, including the refusal of a zero
  quantity shown under the line, and both shown on the request and review pages.
- All events with "Every event" and "Assigned to me"; the review queue's "Assigned to" column; a
  second coordinator sees the first reviewer by name.
- "Last saved" shows "—" on submitted rows in My requests, as C3 specifies.

---

# Fix the six defects the A1–D5 test cases found

**Timestamp:** 2026-09-17T10:06+08:00 (SGT)
**Author:** Seann, via Claude
**Scope:** A3, B1, B2, C1, C2, D1, D3, D5.
**Reason:** Writing the functional test cases from the stories surfaced six places where the build
didn't meet its acceptance criteria. Each fix started with a failing test.

## Fixed

1. **A blocked submission from a draft no longer saves the edits** (B2-T15). The editor used to save
   the draft and then submit it as two calls, so a refused submission kept the edits.
   `POST /api/v1/event-drafts/:id/submit` now accepts the values on screen, validates them, and
   stores and submits them in one statement — or, if refused, writes nothing. With no body it still
   submits the draft as last saved. The editor now makes the single call.
2. **A draft name of only spaces is refused** (C1-T5). The name is still stored exactly as typed,
   not trimmed, because C2 restores "the exact value that was saved".
3. **The rejection refusal now shows inside the rejection dialog** (D5-T2, D5-T3), with the reason
   error under the reason box, and is cleared each time the dialog opens. It used to render on the
   page behind the dialog.
4. **People are shown by name, not user id** (B1-T1, D1-T2, D1-T6) — the organiser on the request
   page and in the queue, the reviewer, the assigned coordinator, and who decided.
   - **Identity:** new `display_name` column (migration `0002`), names for every seed account (seed
     `0003`), and **`GET /api/v1/users?ids=…`**, returning only `id`, `displayName` and `email`. Staff
     only — attendees get 403. At most 100 ids per call.
   - **Web app:** a shared `useUserNames` hook fetches each name once and falls back to the email,
     then to the id, so a failed lookup never breaks a screen.
   - Event service unchanged: it still stores and returns ids only (plan.md §4).
5. **Venue and equipment requirements can be entered and are shown** (B1-T2, D1-T4). Their shape is
   now in `packages/contracts`: venue requirements are `{ layout, facilities[], notes }`, equipment
   requirements are lines of `{ equipmentType, quantity, notes }`, and the Event service validates
   both, naming the bad line (e.g. `equipmentRequirements.0.quantity`). Layout, facility and
   equipment type are **free text on purpose**: that vocabulary belongs to the Venue (H1) and
   Equipment (P2) owners (implementation.md §11, rule 3). Both fields can also be amended when
   answering a clarification (D3).
6. **A coordinator can tell which events are theirs** (A3-T5). The review queue has an "Assigned to"
   column showing "You" for their own, and a new **"All events"** screen for coordinators lists every
   event whatever its status, with an "Assigned to me" filter — A3 says a coordinator's list is
   every event, and the queue only holds undecided ones.

## Changed

- **Functional test cases** that expected a user id on screen now expect the display name (B1-T1,
  D1-T2, D1-T5, D1-T6, D1-T8, D4-T1). A2-T2's coordinator navigation includes "All events"; A3-T4 and
  A3-T5 use the new screen; B1-T2 and D1-T4 enter requirements. `tests/README.md` lists every
  account's display name.
- Traceability rows added for the 16 new automated tests.

## Verified

Every suite green: Event 156, Identity 38, contracts 15, web 19; every build clean. Also driven
against the live project with real sign-ins: names resolve and an attendee is refused; a
spaces-only draft name is refused; a blocked submission leaves the stored value at 100, a valid one
stores 200 and keeps the draft's id; requirements round-trip and a zero quantity names its line; a
reason-less rejection is refused on `reason`. Test data was reset afterwards. **The rendered screens
have still not been checked by eye.**

## Needs review by other owners

- **Identity (your friend's service):** the `display_name` column, seed `0003`, and the new
  `GET /api/v1/users` endpoint.
- **`packages/contracts`:** `eventRequirements.ts` and `userSummarySchema`.
- **A3 is your friend's story:** the "All events" screen and the "Assigned to" column implement part
  of it.

---

# Functional test cases for A1–D5, two test accounts, and a reorganisation proposal

**Timestamp:** 2026-09-17T09:11+08:00 (SGT)
**Author:** Seann, via Claude
**Scope:** A1, A2, A3, B1, B2, C1, C2, C3, D1, D2, D3, D4, D5 (functional test cases); process —
repository layout proposal.

## Added

- **111 functional test cases in `tests/<story-id>/`**, one file per case, in the implementation.md
  §8.4 format: A1 11 · A2 7 · A3 9 · B1 6 · B2 15 · C1 10 · C2 7 · C3 6 · D1 8 · D2 8 · D3 9 · D4 8 ·
  D5 7. Each story has happy-path, negative and story-specific cross-cutting cases, plus boundaries
  wherever a criterion has a threshold (attendance 0/1, end time at/after start, registration closing
  at/after the event start, reason of nothing/spaces/one character). **102 are `Not Executed`; 9 are
  `Blocked`**, each saying why — the services they need (Notification, Venue, Equipment,
  Registration) don't exist yet.
- **Expected results were written from the acceptance criteria, not the implementation**
  (implementation.md §11, rule 12),
  so the cases under Known gaps below are expected to fail as built. **A1–A3 cases need their
  owner's review** before they're relied on; B1–D5 need Seann's.
- **`tests/README.md` now holds what every case shares:** the standard environment, all accounts with
  their ids, the standard request data, and six named setup procedures (`FX-DRAFT` through
  `FX-REJECTED`). Pre-conditions name a procedure instead of repeating it.
- **`npm run test-cases:reset`** (`tests/fixtures/`) resets data before a run. The database is shared,
  so it deletes only requests owned by the two seeded organisers and what hangs off them. Its first
  run removed 4 leftover requests from earlier smoke tests.
- **Two seeded accounts: `organiser2@` and `coordinator2@connectsphere.test`**, in a new
  forward-only seed `services/identity/migrations/seed/0002_…sql` and in `seed-auth-users.ts` — both
  Identity's files, so **flagged for its owner's review**. Without them, "another organiser cannot
  see this" (A3, C1, C2, D3, D5) and "a second coordinator opening it" (D1) could not be executed.
  Applied to the shared project; both accounts sign in with the right role. Also listed on the web
  app's sign-in screen.
- **`documentation/proposals/2026-09-17-repository-reorganisation.md`** — the proposed
  frontend / backend / documentation / tests layout, what must stay at the root, every path that has
  to change, how to carry it out without breaking open branches, and three open questions. **Nothing
  has moved**; it needs team agreement first.

## Changed

- `implementation.md` §8.4 — points to `tests/README.md` and the reset command; the worked D5-T1
  example now matches the real file.

## Known gaps found while writing the cases

These cases are expected to **fail** against the current build. They are defects to fix, not
mistakes in the cases:

1. **B1-T1, D1-T2, D1-T6** — the app shows user **ids** where the criteria want the person: the
   submitting organiser isn't shown on the request page, the queue's Organiser column holds a uuid,
   and "already under review" names the other coordinator by id. One root cause: Identity has no way
   to look up a user's name.
2. **B1-T2, D1-T4** — the request form has **no inputs for venue requirements or equipment
   requirements**, so they can't be entered, and a coordinator can't see them.
3. **B2-T15** — a blocked submission from a saved draft **still saves the edits**, because the
   editor saves the draft before submitting it. B2 says a blocked submission changes no stored value.
4. **C1-T5** — a draft name of **only spaces is accepted**.
5. **A3-T5** — a coordinator **can't tell which events are assigned to them**; the queue has no such
   marker.
6. **D5-T2, D5-T3** — when a rejection reason is missing, the refusal renders **behind the rejection
   dialog**, so the coordinator sees nothing happen.

Also a question for the Product Owner, not a case: D2 says multiple clarifications are "retained in
order", but not whether a coordinator may ask a second one before the organiser answers the first.
The service currently refuses that, and no case asserts either way.

---

# Event history table, web app sign-out fix, and functional test case standard

**Timestamp:** 2026-09-17T08:33+08:00 (SGT)
**Author:** Seann, via Claude
**Scope:** F1, D3 (history table); A1, A2 (sign-out and route guard); process — functional test
cases for every story.

## Changed

- **`event.status_history` and `event.event_field_edits` merged into one `event.event_history`
  table** (migration `0003_merge_history_tables.sql`, forward-only, existing rows carried across).
  Both were append-only records of what happened to one event. `entry_type` is `STATUS_CHANGE` or
  `FIELD_CHANGE`, and a check constraint per type makes sure each row carries the columns its kind
  needs. The `event` schema is down from 7 tables to 6; G1 and S2 will write field changes into the
  same table rather than adding another.
- **Field changes now record the actor's role**, which `event_field_edits` never did. Migrated D3
  rows are given `EVENT_ORGANISER`, which is certain: answering a clarification is organiser-only.
- `repo/statusHistory.ts` is replaced by `repo/eventHistory.ts` (`recordStatusChange`,
  `recordFieldChanges`); callers updated. 147 event tests pass (6 new, covering the table's shape
  and that it refuses a malformed entry).
- **Web app: signing out and in as a different role no longer lands the new user on the previous
  user's screen.** The hash router kept the old address (`#/queue`) across sign-out. Sign-out now
  resets to `#/`, and every route is guarded by role, so a pasted or bookmarked link to a screen the
  role may not use redirects to the user's own landing screen. Navigation and guards read one
  permitted-role list, so they cannot drift.
- **Web app: user story IDs removed from buttons, headings and descriptions.** Code comments keep
  them, since implementation.md §11 wants code traceable to its story. The API console's "no token"
  preset used to detect itself by searching its own label for "unauthenticated"; renaming the label
  would have silently broken it, so it now carries an explicit flag.
- **`Planning/plan.md` §4** — the Event row names `event_history`, and a note explains both merges.
  Commit `7a8f54a` had rewritten plan.md from an older copy and dropped the earlier drafts-merge
  fix; this re-applies it on top of that commit without undoing any of its other changes.

## Added

- **`Planning/implementation.md` §8.4 — functional test cases.** Every story gets functional test
  cases in `/tests/<story-id>/`, one file per case, ID `<story-id>-T<n>` matching the Jira test
  issue. Format is the IS212 Week 4 template: a specification written once, and an execution record
  replaced on every run, with status `Pass` / `Fail` / `Not Executed` / `Blocked` and the commit SHA
  in Remarks. Cases are derived in five steps — visualise the workflow, happy path, story-specific
  cross-cutting checks, negative, boundary — with a worked D5 example. Also: §2 layout gains
  `/tests`, the Definition of Done requires the cases, and §11 rule 12 says cases are written from
  the story before the code, never from the implementation.
- **`tests/TEMPLATE.md`** and **`tests/README.md`** — the blank template and a one-screen summary.
- **`apps/web` has tests now** (`npm test -w @connectsphere/web`, Vitest + Testing Library + jsdom).
  Two regression tests for the sign-out bug. Both failed against the previously committed code,
  which is what shows they test the right thing.

## Worth knowing

**The regression test caught a bug in the first fix.** That fix also made the login screen navigate
to `#/` after sign-in. The second navigation raced the redirect from `#/` to the user's landing
screen and left them on a blank page, which the test reproduced and a manual click-through probably
wouldn't have. Only sign-out resets the address now; the route guard covers every other way in.

## Known gaps

1. **D5-T6 in the worked example cannot be executed yet.** It needs a second active organiser to
   show that another organiser cannot see the request, and the identity seed has only one (the
   other organiser account is deactivated). Add one to the seed before writing that case.
2. **No functional test case files exist yet.** `/tests` holds the standard, the template and the
   README. The cases for A1–D5 are still to be written, by the story owners from the stories.
3. The rendered UI has still not been checked by eye. The sign-out tests exercise the real app in
   jsdom, but layout and Atlaskit styling remain unverified.

---

# Architecture decision records + Confluence sprint-log digest

**Timestamp:** 2026-09-17T01:03+08:00 (SGT)
**Author:** Chai, via Claude
**Scope:** none (docs/tooling, no story) — written ahead of the Week 13 Q&A.

## Added

- **`documentation/adr/0001-microservices-schema-per-service-cp-consistency.md`** — records *why*
  microservices with schema-per-service boundaries and CP-over-AP were chosen: boundaries are drawn
  around transactional invariants (venue hold exclusivity, equipment reservation, registration
  capacity, the Confirmed gate), not around team headcount or the customer's ~500-staff scale,
  which alone wouldn't justify the choice. Names the trade-off explicitly rather than only the
  benefit, so it can be defended rather than just asserted.
- **`documentation/adr/0002-orchestrated-saga-for-cross-service-cancellation.md`** — records the
  saga-with-compensation approach for F4 cancellation as a *direct, expensive consequence* of
  ADR-0001: three schemas means no single Postgres transaction can release venue, equipment, and
  registration atomically. States the actual weak point (a window of inconsistent state; compensation
  can itself fail) instead of glossing over it — this is the answer plan.md §7 already commits to
  giving, now written down once instead of re-derived live.
- **`scripts/confluence-digest.ts`** (+ test) — turns `CHANGELOG.md` into a Confluence-pasteable
  table, wired up as `npm run confluence:digest` and documented in `README.md`. Exists so the sprint
  log isn't hand-typed a second time into Confluence from what's already written here.

---

# Local dev environment — port collision, missing migration, secrets hygiene, commit standard

**Timestamp:** 2026-09-16T20:15+08:00 (SGT)
**Author:** Chai, via Claude
**Scope:** none (infra/devex, no story).

## Fixed

- **`event-service` was silently binding Identity's port.** `services/event/src/config.ts` falls
  back to the shared `PORT` env var when `EVENT_PORT` is unset; the local `.env` only defined
  `PORT=8081` for Identity. Whichever service lost the resulting bind race never listened where
  Vite's proxy expected it, surfacing as a 404 with a real `x-correlation-id` (the request *did*
  reach a service — just the wrong one) or an `ECONNREFUSED` once the loser crashed outright.
  Added `EVENT_PORT=8082` to `.env`, matching `.env.example`, which already documented this.
- **The `event` schema was never migrated locally.** `npm run migrate:event` (README step 6) had
  not been run, so `event`-schema queries 500'd — not an empty-table/seed problem, the schema
  didn't exist. Running it created all seven tables. `git pull` only updates files; nothing in the
  repo runs migrations automatically, so this needs re-running by hand whenever a pull adds
  migration files for a service already set up locally.

## Changed

- **`Planning/implementation.md` §11.1** — added a commit-message standard for agents committing
  to this shared repo: Conventional Commits (`type(scope): summary`), commit early and often, and
  a bad/good example pair. Not itself a code change, but affects every commit after it.

---

# Identity Service — A1 (login/logout) and A3 (access-scope resolution)

**Timestamp:** 2026-09-16T16:23+08:00 (SGT)
**Author:** Chai, via Claude
**Scope:** A1, A3.

## Added

**`services/identity` — login, logout, and access-scope resolution.**

- **Schema migration + seed data** for the identity schema, covering the accounts and login-audit
  rows A1 and A3 need.
- **Login outcome policy** (`domain` layer, pure): the login rules — active/deactivated account,
  bad credentials, audit outcome — decided independently of any transport or storage concern.
- **Repo layer**: user lookup and login-audit queries.
- **API**: `POST` login and logout endpoints (A1), and the `GET /api/v1/access-scope/events`
  endpoint (A3) resolving what a caller's role is permitted to see.
- **Docs**: `packages/testkit/sprint-1/traceability.csv` rows for A1/A3, and a `README.md` "Local
  development" section (`supabase start` → migrate → seed → `npm test --workspaces` → run the
  service).

27 tests pass, all against the real database (per the Event Service entry below, which confirms
this suite was left untouched by that later work).

## Fixed

- **`services/identity/package.json`'s `dev` script** now runs
  `tsx watch --env-file=../../.env src/index.ts`. This resolves the gap the "Web app" entry below
  flagged — `npm run dev -w @connectsphere/identity-service` was failing to load `.env`, forcing
  the `npx tsx --env-file=.env ...` workaround.

---

# Web app — a testable surface for A1 to D5

**Timestamp:** 2026-09-16T09:05+08:00 (SGT)
**Author:** Seann, via Claude
**Reason:** A1–D5 could only be exercised with curl. `apps/web` makes them clickable, for manual
testing and for the sprint review.

## Added

**`apps/web`** — React 18 + TypeScript + Vite, with Atlassian Design System components per
implementation.md §7.1 (un-restyled). This fills the `apps/*` workspace slot that has been in the
root `package.json` since the skeleton commit.

- **No CORS anywhere.** The Vite dev server proxies `/identity/*` → `:8081` and `/event/*` → `:8082`,
  so the browser talks to one origin. Neither service needed changing.
- **Login (A1) is two calls.** Identity's `/auth/login` owns A1's rules but returns no token, so the
  app asks Identity first — a refusal stops there, which is what keeps a deactivated account from
  ever reaching Supabase for one — then fetches the access token for the `Bearer` calls to `:8082`.
- **Screens:** login with the seeded accounts listed; role-driven nav (A2); My Requests (C3, with the
  draft/submitted filter); the request editor (C1 save, C2 resume and submit, B1/B2 refusals bound
  to their fields); request detail with the clarification thread and D3 reply; the review queue (D1);
  and the review screen (D2 clarify, D4 approve, D5 reject behind a confirmation modal).
- **Refusals render inline** as section messages carrying the server's own `code`, `message` and
  `fields[]`, per implementation.md §7.1 — so B2's "names every field" is visible rather than
  swallowed.
- **A direct API console.** A2's "the refusal applies to a direct URL or API call, not only to hidden
  menu items" and A3's "returns no event data at all" cannot be shown by clicking around, because
  both are about what happens when the UI is bypassed. The console fires raw requests with the
  signed-in user's token, with presets for each.
- Status colours are defined once in `src/shared/status.ts`, never inlined (implementation.md §7.1).

## Verified

Typecheck and production build clean. Both services and the dev server were started together and
the full journey driven through the proxy exactly as the browser makes it: sign in as three roles →
save a draft (no reference) → C3 list → B2 refusal naming 7 fields → submit in place keeping the
same id → attendee gets 404 → organiser's approve gets 403 → coordinator opens, clarifies, organiser
responds with an amendment → empty rejection reason refused → approved.

**Not verified: the rendered UI itself.** I have no browser automation in this environment, so while
every request path behind the screens is confirmed against the live services, nobody has yet looked
at the pages. Expect to find layout and Atlaskit-prop details to fix on first run.

## Follow-ups

1. The Playwright flow test implementation.md §8.2 asks for (`packages/testkit/sprint-1/flow.spec.ts`)
   now has a UI to drive. That is the missing deliverable, not more unit tests.
2. Attendee, Venue Staff and Tech Support have no screens — correctly, since no story in A1–D5 gives
   them one. They land on the console.
3. `npm run dev -w @connectsphere/identity-service` still fails to load `.env`; use
   `npx tsx --env-file=.env services/identity/src/index.ts` until its owner adds the flag.

---

# Event Service — drafts merged into the events table

**Timestamp:** 2026-09-16T00:20+08:00 (SGT)
**Author:** Seann, via Claude
**Reason:** The separate `event_drafts` table was a wrong call, corrected. A draft is an event at
status Draft — which is what F1's status list says by naming Draft among the ten statuses.

## Changed

- **Migration `0002_merge_drafts_into_events.sql`** — forward-only. Relaxes the NOT NULL columns a
  draft may leave empty, adds `last_saved_at`, carries the existing unsubmitted drafts into
  `event.events` at status `DRAFT`, drops `source_draft_id`, and drops `event_drafts`.
- **Submitting a draft now updates that row in place.** It keeps its id, its history and everything
  entered, and gains a reference and submission timestamp. Previously submission copied the draft
  into a new `events` row, so the submitted event had a different id from the draft the organiser
  had been working on. `converted_to_event_id` is gone with the table.
- **`ends_after_start` and `attendance_positive` are now conditional on the status**, because C1
  says the B2 rules are not applied on save — a draft may legitimately hold an attendance of zero.
  A new check holds the other line: anything past Draft has a reference and a submission time.
- **C3's list is one query instead of a `union all`.**

## The one thing to watch

Drafts now share a table with events, so **the A3 scope filter is what keeps a draft private**,
where before it was the table boundary. A coordinator's scope is every event, which would have
exposed other organisers' drafts; the filter now reads "every event, plus my own drafts". Four
tests in `tests/api/review.test.ts` cover it — a coordinator gets `404` on someone's draft, it stays
out of their list, opening it does not move it to Under Review, and the owner still sees their own.

139 tests pass (was 134). The end-to-end smoke run against the live project was repeated.

---

# Event Service — B1 to D5

**Timestamp:** 2026-09-15T23:40+08:00 (SGT)
**Author:** Seann, via Claude
**Scope:** B1, B2, C1, C2, C3, D1, D2, D3, D4, D5. E1 stubbed. Design spec in
`docs/superpowers/specs/2026-09-15-event-service-b1-d5-design.md`.

## Added

**`services/event` — a new service, schema `event`, port 8082.**

- **Migration** `0001_init_event_schema.sql`: `event_drafts`, `events`, `assignments`,
  `assignment_cursor`, `status_history`, `clarifications`, `event_field_edits`, `outbox`, and an
  `EVT-000000` reference sequence. Nothing is ever hard-deleted; a submitted draft is marked
  converted, not removed.
- **Domain layer** (pure, no I/O): `validation.ts` (B2, reporting *every* failing field),
  `statusMachine.ts` (F1's permitted transitions for this slice), `assignment.ts` (E1 round-robin).
- **Repo layer**: drafts, events, clarifications, status history, assignments. The A3 scope rule is
  applied inside the query, so an out-of-scope event returns no row rather than a filtered result.
- **API**: draft save/open/edit/submit (C1, C2), direct submission (B1), the combined
  draft-and-submitted list (C3), the review queue and open-for-review (D1), clarification request
  and response (D2, D3), approve (D4) and reject (D5).
- **Outbox**: six event types written in the same transaction as their state change. No Kafka relay
  runs yet, so rows accumulate unpublished — the correct resting state for a transactional outbox.
- **Tests**: 134, all against the real database. Written test-first; every one was watched failing
  before the code existed.

**`packages/contracts`** gained `eventStatus.ts` (the ten F1 statuses), `errorCodes.ts`,
`envelope.ts` (implementation.md §3.3), `eventEvents.ts` (six payload schemas + topic names), and
`user.ts`.

**`packages/testkit/sprint-2/traceability.csv`** — new, covering D2–D5. Sprint 1's file gained rows
for B1–C3, D1, E1, F1 and the A2/A3 checks the Event Service enforces itself.

**Deployment**: `services/event/Dockerfile`, a compose block, `.env.example` entries, a
`migrate:event` script, README steps.

## Changed

- **`services/identity/src/api/usersMe.ts` — new endpoint `GET /api/v1/users/me`, in another
  owner's service.** Raphael/whoever owns Identity should review this. It was needed because the
  Event Service may not query `identity`'s tables (plan.md §2) and `GET /api/v1/access-scope/events`
  returns no user id for a coordinator (`{scopeType:"ALL"}`) — but D1/D4/D5 must record *which*
  coordinator reviewed, approved or rejected. Three tests accompany it; Identity's existing 27 tests
  are untouched and still pass.

## Decisions worth knowing

- **Two tables for drafts and events**, as `plan.md` §4 lists them, rather than one table with a
  Draft status. `events.status` still lists all ten F1 statuses for completeness, but no row is ever
  inserted at `DRAFT`; the first history entry records `DRAFT` as the previous state.
- **Identity owns the access-scope rule; the JWT proves the subject.** The Event Service verifies
  the token itself (`jose` + JWKS, mirroring Identity) and then makes one synchronous call per
  request for the caller's identity and scope — the hop `plan.md` §5 permits. `resolveAccessScope`
  is not duplicated here. If Identity is unreachable the request is refused with `503` and nothing
  is written, which is the CP posture `plan.md` §2 requires.
- **`prepare: false` on the postgres client.** The hosted `DATABASE_URL` points at Supabase's
  transaction-mode pooler, which hands a different backend to each transaction and cannot keep named
  prepared statements alive. This surfaced only under concurrent load. `services/identity/src/db.ts`
  does not set it and may hit the same failure — flagged, not changed, since it is another owner's
  file.

## Known gaps

1. **E1 is a stub.** The eligible coordinator pool is `EVENT_COORDINATOR_POOL` in the environment,
   not a live Identity query, because no endpoint lists active coordinators. The allocation rule
   itself (round-robin, recorded per assignment, explainable) is real. Marked `TODO(E1)` throughout.
2. **No Kafka relay.** Outbox rows are written correctly but nothing publishes them, and the
   Notification service does not exist yet, so T2's records are not created downstream.
3. **`packages/contracts` is shared** — its additions need a second service owner's review before
   merge, per implementation.md §2.
4. D1's "the name of that coordinator is displayed" returns the coordinator's id; resolving ids to
   names is the SPA's job via Identity.

---

# Jira changes

**Timestamp:** 2026-09-15T16:30+08:00 (SGT)
**Author:** Chai, via Claude
**Reason:** Live-Jira cross-reference of the Rovo agent's first pass against `Jira__2_.md`'s 23-item instruction set found a missed edit and two missing links; naming-convention drift on Sprint 1's test issues was found separately. `Jira__2_.md` sections 0–0e cover both. All have now been applied in Jira.

## `Jira__2_.md` sections 0–0e — applied

1. **Section 0 (rectification)** — R1's REPLACE LINE, missed in the first pass, applied. F5's missing "relates to" links to M1 and Q1 added (only the F1 link had been created).
2. **Section 0c** — SPM-61 (T2, a Story issue) renamed to fix its dash: `T2 - ...` → `T2 — ...`.
3. **Section 0d** — SPM-86–107, the 22 Test issues for Sprint 1's stories (A1–E2), renamed from their legacy ticket-number prefix (`SPM-11:`, `SPM-12:`, …) to `<code>-T<n> — <title>` (e.g. `A1-T1 — Valid login (Organiser)`), so a test case's summary can never be mistaken for its story's.
4. **Section 0e** — SPM-82–85, four shared service-test subtasks that each span more than one story, tagged to their parent feature letter only, no story number: `R-T1`, `F-T1`, `E-T1`, `E-T2`.

## Sprint 1 point total — unchanged at 35

All Sprint 1 test issues (SPM-86–107, plus the shared SPM-82–85) have been moved into the Sprint 1 to-do list. The Sprint 1 story-point total is **not** increased for this: each story's original point estimate is taken to have already factored in the effort of testing that story, so the tests are additional *issues* tracked in the sprint, not additional *scope* against the estimate.

## Net effect

`Jira__2_.md` and the live Jira board are now consistent with each other and with `Final_User_Stories__2_.md`'s naming convention, including the test-issue layer that convention didn't originally cover. Sprint 1's committed points remain 35 across its 15 stories; the 26 test issues now sitting in the Sprint 1 to-do list are covered by that existing estimate.

---

# Changelog — Stale Cross-Reference Fixes (Revision 3 follow-up)

**Timestamp:** 2026-09-15T05:19:53Z
**Author:** Chai, via Claude
**Reason:** The F1/F5 and F3/F4 story splits in Revision 3 left several cross-references pointing at the wrong story. These are corrections only — no acceptance criteria were changed in substance, only which story they cite.

---

## `Final_User_Stories__2_.md`

1. **B2** — `(F1)` → `(F5)` in the equipment-required-flag bullet. The confirmation-readiness rule it cites lives in F5, not F1.
2. **L3** — `(F1)` → `(F5)` in the "does not by itself allow the event to become Confirmed" bullet. Same reason as #1.
3. **L3** — `(F3)` → "as part of the release run in F4" in the "released automatically when the event is cancelled" bullet. F3 only records the cancellation decision; F4 owns the actual release.
4. **S3** — `(F1 readiness rule)` → `(F5 readiness rule)` in the Confirmed-status refusal bullet. Same reason as #1.
5. **Q2** — `(F3)` → "as part of the release run in F4" in the reservation-release bullet. Same reason as #3. Q2 was not in Revision 3's official revised-stories list, so this reference was never revisited when F3 split.
6. **R1** — Reworded "when a registration capacity is set — the number of places remaining" to "the number of places remaining, derived from the capacity of the booked venue for the booked layout (R2)." R1's sibling story R2 already states capacity is always derived from the booked venue, never a separate optional field; R1 was not updated to match when R2 changed.

## `Jira__2_.md`

1. **Header** — Scope updated from "21 changes — 5 new work items, 1 deletion, 15 edits" to "23 changes — 5 new work items, 1 deletion, 17 edits" to account for the two added items below. Out-of-scope note reworded: A3/B2/E1/E2 are now marked as already completed rather than "handled separately," since that work is done.
2. **Item 11 (L3)** — Same fix as source-doc change #2 above, applied to the CREATE block's description.
3. **Item 21 (S3)** — Same fix as source-doc change #4 above, applied to the REPLACE DESCRIPTION block.
4. **New item 15 (Q2)** — Added, carrying source-doc change #5 above as a REPLACE LINE instruction, with a "Why" note explaining the knock-on effect.
5. **New item 16 (R1)** — Added, carrying source-doc change #6 above as a REPLACE LINE instruction, with a "Why" note explaining the knock-on effect.
6. **Renumbering** — Items formerly numbered 16–21 (R4, R6, R7, S3, T1, T2) shifted to 18–23 to make room for the two insertions.

---

## Net effect

Every stale F1/F3 cross-reference introduced by the Revision 3 story splits is now resolved across both files. Sprint 1 stories (A3, B2, E1, E2) were confirmed already correct and are untouched by this pass.
