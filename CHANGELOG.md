# Changelog

> **Convention — read before editing this file:** entries are newest-first. When adding a new entry, insert it directly below this header, above every existing entry. Never append to the bottom. This header itself never moves and is never treated as an entry.

---

# P1: Verify the rate-limit fix against the updated base

**Timestamp:** 2026-10-08T10:09+08:00
**Author:** Yichen, via Codex
**Scope:** resolved OpenAPI merge and lockfile formatting.

**Reason:** Keep the equipment API's full schema alongside main's venue availability API, without duplicate document keys. Retain main's equivalent lockfile unchanged.

**Verification:** Clean npm install, full build, lint, typecheck and all 350 backend unit tests pass, including the three rate-limit regressions and domain coverage thresholds. No shared database was used. Pushed CI and actual merge-ref code-scanning results remain to be checked.

---

# P1: Rate-limit equipment routes before authentication

**Timestamp:** 2026-10-08T10:06+08:00
**Author:** Yichen, via Codex
**Scope:** equipment router, express-rate-limit dependency, OpenAPI and regression tests; current main merged.

**Reason:** Resolve CodeQL `js/missing-rate-limiting` findings. Each router shares a 120-request/minute/IP budget before JWT verification, identity resolution and SQL; excess requests receive 429 with Retry-After and the standard correlation envelope. Reuse current main's RATE_LIMITED refusal code. Preserve the venue calendar API, frontend route, schema and traceability while merging current main; this also brings P2 onto the integration coverage floor. Default Express proxy trust remains disabled. The in-memory budget is per process and resets on restart; deployments requiring one quota across replicas need a shared store.

**Verification:** Three real-router HTTP regressions pass: every endpoint shares the limit despite changing bearer tokens, blocked traffic reaches no authentication/SQL, the budget recovers after a minute, and distinct client IPs remain independent. Lint and typecheck passed. Full CI and actual branch-alert reanalysis will verify the pushed fix; a green CodeQL workflow alone does not mean no findings.

---

# P1: Record independently verified API cards and CI evidence

**Timestamp:** 2026-10-08T02:25+08:00 (SGT)
**Author:** Yichen, via Codex
**Scope:** P1 card execution records and captured CI evidence.

**Reason:** Record observed results at `a00b6bf3e17ddcd4db343e9e15e5495f61ac6c57` against independently specified acceptance expectations. The fifteen API/database cards pass in disposable Postgres with declared authentication stubs. Actual signed-in browser card T14 and human story-owner review remain pending.

**Verification:** All CI jobs and CodeQL passed. Planning-core integration: 585 tests, 94.77% lines/statements, 90.31% branches, 94.76% functions. Backend unit: 319 tests; frontend: 62 tests, including 19 P1 checks. Changed-domain mutation score: 95.51%. Evidence captures the complete planning-core command output (terminal formatting and trailing whitespace removed) and source CI link.

---

# P1: Verify authentication and database refusal paths on current main

**Timestamp:** 2026-10-08T02:15+08:00 (SGT)
**Author:** Yichen, via Codex
**Scope:** equipment identity, actor and route unit tests; integration with current main.

**Reason:** Main advanced during P1 development. Merge its F1/CR-06 changes and integration coverage floors, retaining both changelog histories. Cover P1's identity outcomes, role verification and unexpected database failures independently so these refusal paths are checked alongside the happy path. Implementation behavior is unchanged.

**Verification:** All 319 backend unit tests and domain coverage passed on the updated base. Seventeen new unit checks exercise authentication and error propagation. CI's database run is verifying P1's functional card cases and the inherited integration coverage floors.

---

# P1: Add independent acceptance checks and functional cards

**Timestamp:** 2026-10-08T02:09+08:00 (SGT)
**Author:** Yichen, via Codex
**Scope:** independent API acceptance suite, `tests/P1/` cards and scoped browser fixture, standard equipment migration setup, planning decision note, and Sprint 2 traceability.

**Reason:** Verify P1 against its acceptance criteria with independently derived expectations, including peak versus summed use, combined maintenance, overlap boundaries, requested quantities, serialized identities, zero inventory and unchanged state. API cards explicitly declare stubbed authentication; P1-T14 specifies the real signed-in browser workflow separately.

**Verification:** Fifteen independent API cases are prepared for CI's throwaway Postgres; strict test TypeScript checks passed. All sixteen cards currently remain Not Executed pending their actual verification records. Local tests used no shared database. Human story-owner review and full signed-in browser execution remain pending.

---

# P1: Show the equipment availability check to Technical Support

**Timestamp:** 2026-10-08T02:09+08:00 (SGT)
**Author:** Yichen, via Codex
**Scope:** frontend equipment availability client, screen, routes, proxy and acceptance tests.

**Reason:** Let Technical Support Staff choose equipment and an event period, then compare requested quantity with numeric availability and shortfall. Changing any input clears the old result; late responses cannot replace a result for the current form. The workflow sends only read requests and preserves field-level refusals.

**Verification:** Tests were written first and observed failing before implementation. All 19 P1 frontend checks and all 62 frontend tests passed under Asia/Singapore time, with coverage thresholds satisfied (75.21% lines, 79.74% branches). Frontend typecheck and the full build passed.

---

# P1: Check equipment availability using peak concurrent use

**Timestamp:** 2026-10-08T02:04+08:00 (SGT)
**Author:** Yichen, via Codex
**Scope:** equipment availability API, input validation and tests, shared error contract, API documentation, and CQ-02 decision records.

**Reason:** The user selected peak concurrent use for CQ-02 and authorized P1 (SPM-48). Record that decision and its provenance, then expose a period check that reports numeric availability and requested shortfall without creating a reservation or changing inventory. Bulk checks combine reserved and unavailable quantities on one timeline; serialized units must be free for the whole period and are excluded only once when both reserved and unavailable.

**Verification:** Backend typecheck and module boundaries passed. All 268 planning-core unit tests and coverage thresholds passed; new input validation has 100% coverage and a 96.77% focused mutation score. Database API acceptance verification awaits CI's throwaway Postgres. No shared database was used.

---

# I1: A venue's availability calendar

**Timestamp:** 2026-10-07T23:24+08:00 (SGT)
**Author:** Seann, via Claude
**Scope:**
- planning-core, venue module: `domain/availabilityCalendar.ts`, `repo/availability.ts` and `api/availability.ts` (new), mounted in `index.ts`.
- planning-core, event module: `findEventReferences` in `index.ts`, backed by `findReferences` in `repo/events.ts`.
- Tests: `tests/venue/domain/availabilityCalendar.test.ts`, `tests/venue/api/availability.test.ts`, `availabilityRateLimit.unit.test.ts` and `errors.unit.test.ts` (new).
- A rate limit on the calendar: `express-rate-limit` (planning-core dependency), and `RATE_LIMITED` in contracts' error codes.
- `planning-core.openapi.yaml`: `GET /api/v1/venues/{id}/availability`, its `429`, and four schemas.
- The web app:
  - `VenueAvailability` (new);
  - an "Availability" button on `VenueDetail`;
  - the route in `App.tsx`;
  - `getVenueAvailability` in `api/venues.ts`;
  - the calendar's colours in `shared/status.ts`;
  - `tests/venueAvailability.test.tsx`.
- Test cards: `tests/I1/` (15 cases), and FX-CALENDAR in `tests/I1/README.md` and `tests/README.md`.
- `tests/fixtures/reset-test-data.sql`: it also removes the seeded Venue Staff account's venues' slots and blocks. Traceability.

**Reason:** I1 (Sprint 2), now that EN-02.1 has added `venue_slots` and `unavailability_blocks`. Coordinators check a venue's calendar before asking for a period, and J1, L1 and L3 build on it.

## What it does

1. **"Availability" on a venue's page opens its calendar** for every internal role. It shows the week from today, and "Show" reads any range of up to 31 days.
2. **Each day has a bar, a Committed list and a Free list,** in Singapore time.
   - A confirmed booking is labelled with its event reference.
   - A held slot shows as **Pending**, in a different colour from Confirmed. A booking request stays HELD until it's decided (§4.6 rule 3), so until L1 exists every hold shows this way.
   - Setup and turnaround are their own rows, before and after the event, marked occupied and in their own colour.
   - Unavailability shows its type and reason.
   - The hours the venue is closed show as unavailable, all day on a closed day.
3. **Postgres does every comparison** (§4.4):
   - `&&` finds the slots and blocks touching each day;
   - `*` clips them to the day;
   - subtracting multiranges leaves the free time inside opening hours.
4. **Setup and turnaround come from each slot's own copy** of the times, so I1 doesn't wait for H3.
5. **Released and expired slots and removed blocks commit nothing.** The calendar is read afresh each time, so an approval, rejection, withdrawal or release shows the next time it's loaded.
6. **Attendees have no route to the calendar,** and the API refuses them (`403`). An unknown venue is `404`. A range longer than 31 days, reversed, or with a date that doesn't exist is `400`, naming the field.
7. **The event reference comes through the event module's interface.** The new `findEventReferences` returns only references, because organisers outside an event's scope can see the calendar.

## Testing ahead of L1, L3, M1 and I2

8. **No story creates holds, requests, approvals or blocks yet.** So FX-CALENDAR inserts one week of them directly (7–13 Dec 2026), and two statements in `tests/I1/README.md` approve or release a slot the way M1, M2 and L5 will.

## Notes for the team

9. **The shared database now has EN-02.1's migration** (`venue/0003`), which I applied with `npm run migrate -- venue`.
   - It still lacks EN-02.2's equipment migration, so `tests/equipment/repo/inventory.test.ts` fails locally against it. CI isn't affected, because it builds its own database from every migration.
   - H3's `venue/0002` is applied there too, from 4 Oct, though H3 isn't merged.
10. **Mutation testing found a bug** in the date rules. A date-shaped string that isn't a date (`2026-13-01`) made the endpoint fail with a 500. It's now refused with a 400, and the calendar's rules score 100%.
11. **The calendar route has its own rate limit, against ADR-0011 for now.**
    - CodeQL (`js/missing-rate-limiting`) failed the PR because the route had no limiter.
    - ADR-0011 puts rate limits at the Kong gateway (EN-12), which isn't built, and rejects each service limiting itself. So this is a stopgap on one route, planning-core's heaviest read: 120 requests a minute per address, refused with `429 RATE_LIMITED` before any identity lookup.
    - Remove it when EN-12 lands. Every other planning-core route is still unlimited, and the next route a story adds will trip the same CodeQL rule.

## Verified

- **The 15 I1 cards pass in Chrome** through the automated runner, against `ac840b7`. H2's 8 cases still pass with the new button.
- **planning-core:**
  - unit tests: 274/274, with the calendar's rules at 100% line, branch and mutation coverage;
  - integration tests: all pass against the shared database, apart from the 16 equipment tests above. The new suite passes 9/9.
- **web:** 53/53, including 10 tests for the calendar.
- **Lint, typecheck, build and `lint:api` pass.** The policy tests need Linux and run in CI.
# Outbox cards: query the CloudEvent envelope's `type` and `data`

**Timestamp:** 2026-10-07T19:09+08:00 (SGT)
**Author:** Raphael, via Claude
**Scope:** `tests/` cards B1-T5, D2-T7, D3-T8, D4-T5, D4-T6, D5-T7, E1-T2 (Test Data only).
**Reason:** Since EN-04 the outbox stores each message as a CloudEvent: the message type is in
`envelope->>'type'` and the payload in `envelope->'data'`. These seven cards (written 2026-09-20)
still queried `envelope->>'messageType'` and `envelope->'payload'`. They return nothing from
those keys, so running any of them would fail even with the code correct. None had been run
since, which is why it went unnoticed.

## Changed

- In each card's query: `envelope->>'messageType'` → `envelope->>'type'`, and
  `envelope->'payload'` → `envelope->'data'`. Expected results are unchanged, since the type
  strings (`event.submitted` and so on) and the payload field names are the same.

## Verified

- The corrected query, run read-only against the shared database, returns real rows' type and
  reference (e.g. `event.coordinator-assigned`, `EVT-005237`).
# F1: one guarded way to change an event's status, and the completion sweep

**Timestamp:** 2026-10-07T22:20+08:00 (SGT)
**Author:** Raphael, via Claude
**Scope:** F1 (SPM-27). The event module's `repo/`, `api/` and new `jobs/`, the root
`package.json`, `tests/event/`, `tests/race/`, `tests/support/`, `tests/F1/` and the traceability CSV.
**Reason:** F1 was marked Done with its write path still spread over six repository functions, no
completion of past events, and none of its cards run. This finishes it.

## Added

- **`updateStatusIf`** (`repo/eventStatus.ts`): the one SQL statement that writes `status`. It
  locks the row and changes it only if the status is still one the action may start from.
- **`transitionEvent(tx, eventId, action, actor)`**: the one way any route changes status. It looks
  the action up in the transition table, refuses with both statuses named, and for `COMPLETE`
  checks the end has passed by the database clock. It writes the history row in the same
  transaction as the change.
- **`npm run jobs:complete-events`**: completes every Confirmed event whose end has passed, one
  transaction per event, as `SYSTEM`. Only Confirmed events complete (spec decision 2); an Approved
  event past its end is left alone.
- **`tests/event/architecture/statusWrites.unit.test.ts`** fails if any file other than
  `updateStatusIf` writes `status`.
- Race tests in `tests/race/statusTransitions.test.ts` (EN-02.3 harness, CI's throwaway Postgres
  only) prove that two concurrent transitions on one event make exactly one change.

## Changed

- Submission, opening for review, clarification, approval and rejection all go through
  `transitionEvent`. `insertSubmittedEvent`, `submitDraft`, `claimForReview`, `lockEventInScope`,
  `setStatus` and `recordDecision` are deleted.
- D3's clarification history now takes its previous values from the locked row, not a read made
  before the lock.
- Tests that share the team database seed with random owners and clean up after themselves
  (`tests/support/seedEvent.ts`).

## Tested

- F1-T1, F1-T8, F1-T9, F1-T10 and F1-T11 were run on 2026-10-07 against 3d313c1 and pass; evidence is
  in `tests/F1/evidence/`. F1-T1 used FX-SEEDED for its Submitted request (noted in its record).
- F1-T2 to F1-T6 need a signed-in user and are still to be run. F1-T7, T12 and T13 stay Not
  Executed until F5 and U1 exist.

---

# SPM-116 follow-up: the non-domain coverage floor moves to the integration run

**Timestamp:** 2026-10-07T18:50+08:00 (SGT)
**Author:** Raphael, via Claude
**Scope:** `backend/services/planning-core/vitest.config.ts`, `vitest.unit.config.ts`, its
`package.json`, and CI's integration job.
**Reason:** The unit run enforced a 93% branch floor across all of `src/`. Its own comment says
that floor was set at "today's unit-only figures" until EN-06.1 gave CI a database. EN-06.1 merged
on 6 Oct, but the floor stayed in the unit run, where repo and API code never executes and so
counts as uncovered. Every new repo file therefore failed the build, however well its integration
tests covered it. F1's first repo file took the figure to 92.04%.

## Changed

- **The unit run keeps the 100% floor on domain code**, exactly as before, and drops the global
  floor.
- **The integration run now enforces the global floor.** `npm run test:coverage -w
  @connectsphere/planning-core`, which CI's integration job runs against its throwaway Postgres,
  is the one run that executes repo and API code. Floors: lines and statements 94%, branches 89%,
  functions 94%. That's just under CI's measurement of `main` (lines 94.59%, branches 89.68%,
  functions 95.03%, all 493 tests passing).
- In practice it's **stricter, not looser**: lines and functions go from 39% and 24% (unit-only)
  to 94%, measured where the code actually runs.

## Found on the way (not fixed here)

- **The shared Supabase database is missing EN-02's migrations.** `equipment.equipment_types`
  and the venue slot tables don't exist there, so 34 venue and equipment tests fail for anyone
  running the suite locally. CI is unaffected, since it builds its database from the migrations.
  Someone should run `npm run migrate:all` against the shared project, as a deliberate team step.
- Because of that, a local run undercounts venue and equipment code (92.02% lines, 88.85%
  branches), so the floors were set from CI's figures instead.

## Verified

- Unit run: exit 0, domain coverage 100%. `npm run lint` passes. `ci.yml` parses.
- Full local run of `main` with coverage: lines and statements 92.02%, branches 88.85%, functions
  90.06% (455 passed, with 34 failing only on the missing EN-02 tables).

---

# F1 / CR-06: the Safety Review status

**Timestamp:** 2026-10-07T18:36+08:00 (SGT)
**Author:** Raphael, via Claude
**Scope:** F1 (SPM-27), CR-06. `contracts`, the event module's domain, migrations 0007–0008, the
OpenAPI contract, the status lozenges, and `tests/F1/`.
**Reason:** CR-06 (Week 7) adds an Operational Safety Check: confirming an event's arrangements
(F5) now leads to **Safety Review**, and only the Safety Officer's approval (U1) leads to
Confirmed. F1 owns the status list and the transition table, so the status and its transitions
land here, before F5 and U1 build the actions that perform them.

## Added

- **`SAFETY_REVIEW`**, the eleventh status, between Planning and Confirmed: in contracts
  (`EVENT_STATUSES`, `DECIDED_STATUSES`, labels), the OpenAPI `EventStatus` enum, the frontend type
  and the lozenge map ("Safety Review", in-progress colour).
- **Transitions:** `CONFIRM_ARRANGEMENTS` (Approved/Planning → Safety Review; F5 will perform it),
  `APPROVE_SAFETY` (Safety Review → Confirmed) and `REQUEST_SAFETY_CHANGES` (Safety Review →
  Planning), both performed by U1.
- **Migrations 0007–0008:** the status check is re-added with the new value `NOT VALID`, then
  validated in its own migration. `migrate.ts` runs one file per transaction, so validating in
  0007 would have scanned the table while holding 0007's exclusive lock.
- **`tests/boundaries/eventValues.test.ts`** holds the database check to the contracts list, as
  venue and equipment already have.
- **Cards F1-T12 and F1-T13** for the Safety Officer's two decisions. Both stay Not Executed until
  U1 exists.

## Changed

- `CONFIRM` is renamed **`CONFIRM_ARRANGEMENTS`**, since it no longer leads to Confirmed. Nothing
  ever recorded `CONFIRM` (F5 isn't built), so no history row is left stale.
- F1-T1 no longer says "ten" statuses; F1-T7 expects Safety Review rather than Confirmed.

## Decided, and raised

- **Rejecting the safety arrangement has no transition yet.** Its outcome is CQ-08, still
  unanswered by the customer. Raphael agreed to leave it out (2026-10-07), and a test pins its
  absence.
- **"Request changes → Planning" is CR-06's proposal.** CQ-08 also asks which stage it returns to,
  so the target may change with the customer's answer.
- **F1 itself is not finished.** The guarded write path, the completion sweep and executing the
  cards follow in the next PR. SPM-27 is back to In Progress.

## Verified

- `npm run lint`, `typecheck`, `build`; `npm run test:unit` 287/287 with domain coverage at 100%.
- squawk reports no issues on 0007 or 0008. The migrations were **not** run against the shared
  Supabase database; CI applies them to a throwaway Postgres, and the shared database gets them
  after merge.

---

# SPM-115: `main` is branch-protected

**Timestamp:** 2026-10-07T18:25+08:00 (SGT)
**Author:** Raphael, via Claude
**Scope:** GitHub repository settings (no code). SPM-115, part of EN-06.
**Reason:** `main` had no protection, so anyone with write access could push to it directly or merge
without review or green CI. That happened in practice: PR #2 merged unreviewed, and an early F1
commit went straight to `main`. The Definition of Done (`implementation.md` §8.3) requires both a
peer review and green CI; until now neither was enforced.

## Changed

- **Branch protection on `main`:**
  - a pull request with **one approving review** is required before merging;
  - three CI checks must pass: *Lint, typecheck, build, unit tests*, *Integration tests (throwaway
    Postgres)* and *Secret scan (gitleaks)*;
  - force pushes and branch deletion are blocked;
  - **enforced for administrators too.** Without this the repo owner could still push directly,
    which the ticket's done-when rules out.
- **Not required, deliberately:** *Migration lint (squawk)* and *Mutation testing* are skipped
  unless a change touches migrations or domain code, so requiring them would block unrelated PRs.
  *CodeQL* and *Diagrams* run in separate workflows and can be added once the team agrees.

## Verified

- Read back through the GitHub API: one approval, the three checks, `enforce_admins` on, force
  pushes and deletions off.
- A direct push of an empty commit to `main` was refused: "Changes must be made through a pull
  request" and "3 of 3 required status checks are expected" (protected branch hook declined).
  `main` stayed at `ba59293`.
- This entry is the first change to reach `main` under the rule, through a reviewed PR.

---

# PX-07: The customer clarification log exists

**Timestamp:** 2026-10-06T22:15+08:00 (SGT)
**Author:** Joash
**Scope:** `documentation/clarifications.md` (new).

**Reason:** PX-07 (SPM-148). `implementation.md` §4.6, `change-requests.md` and the PX-07 and PX-14 Jira comments all said "record the answer in `documentation/clarifications.md`", and the file didn't exist.

## What it does

1. **It says how to record an answer:** in the customer's words, with dates and where it was asked. Then the story is revised with a ⚠ note citing the entry.
2. **It lists the ten open questions,** CQ-01 to CQ-10 with their Jira keys and the stories each affects. None has an answer yet. CQ-01 to CQ-03 have been open since 1 Oct, and P1 is blocked on CQ-02.
3. **It indexes the earlier answers the stories cite** (C-04, C-10, C-11, C-12, C-13) with what each decided. Their original wording isn't in the repo, so the PO is asked to add it. No answer was invented.

---

# EN-06.2: Mutation testing shows the domain tests actually check things

**Timestamp:** 2026-10-06T22:07+08:00 (SGT)
**Author:** Joash
**Scope:**
- Stryker 8.7.1 with its Vitest runner (root devDependencies).
- planning-core and notification: `stryker.config.mjs` and `vitest.mutation.config.ts` (new), and a `test:mutation` script. Root `npm run test:mutation`.
- CI:
  - `.github/workflows/ci.yml`: a `mutation` job on pull requests;
  - `.github/workflows/mutation.yml` (new): a nightly full run;
  - `.github/scripts/mutation-summary.mjs` (new).
- Tests strengthened where mutants survived:
  - `tests/event/domain/validation.test.ts` (B2);
  - `tests/venue/domain/slotConflict.test.ts`;
  - `tests/equipment/domain/availability.test.ts`;
  - the two boundaries values tests.
- `availability.ts`: a comment marking two equivalent mutants. `.gitignore`: the reports and sandbox.
- `implementation.md` §8.1.

**Reason:** EN-06.2 (SPM-167), part of EN-06. The rubric asks for 100% domain coverage, but coverage only shows a line ran, not that a test would notice it was wrong. Mutation testing is that proof.

## What it does

1. **Stryker plants small bugs in the domain code,** then reruns the domain unit tests. Typical bugs are `>` becoming `>=`, a condition becoming `true`, or a message becoming empty. Each bug some test catches is "killed"; the mutation score is the share killed. **Below 80% the run fails.**
2. **On a pull request, only the domain files it changes are mutated.** The score goes in the job summary and the HTML report is uploaded. **Every night,** `mutation.yml` mutates all of it.
3. **The runs use the domain tests only** (`vitest.mutation.config.ts`). Stryker runs them in a copy of the workspace, and the domain tests need nothing outside it.

## What the first run found

4. **planning-core started at 91.85%** (496 of 540 mutants killed), **notification at 91.53%**.
5. **The B2 validation tests checked which fields failed, not what they said** (24 survivors). Any refusal message could have been emptied, and a start exactly at the current moment wasn't tested. A new block pins every message and those boundaries: `validation.ts` is now at **100%**.
6. **My new EN-02 code** had gaps:
   - the conflict guards were tested with only one of `null` and `undefined`;
   - the constraint names were never pinned;
   - nothing showed the peak calculation doesn't depend on input order.
   All three are fixed: `slotConflict.ts` is at 100%, and the boundaries tests now check the migrations create the constraints by those names.
7. **planning-core is now at 97.04%** (524 of 540). Three of the rest are one equivalent mutant in `peakConcurrentUse`: dropping a filter can't change the result. Two are switched off with the reason in a comment, and the third is left visible because disabling it would also hide the sort check.
8. **For Seann:** notification's `retryPolicy.ts` is at 68.75%, because its tests don't pin the header names (such as `connectsphere-error`). The workspace as a whole is at 91.53%, above the bar, so nothing fails today.

## Verified

- Local full runs: planning-core 97.04% in 54 seconds; notification 91.53% in 10 seconds.
- **The build fails below the bar:** notification run with the bar temporarily at 95 exits 1 ("Final mutation score 91.53 under breaking threshold 95"). The temporary config was deleted.
- Unit tests: planning-core 253 pass. CI runs the `mutation` job on this pull request, which changes `availability.ts`.

---

# EN-06.3: CI checks migrations, scans for secrets, and runs CodeQL

**Timestamp:** 2026-10-06T21:53+08:00 (SGT)
**Author:** Joash
**Scope:**
- `.github/workflows/ci.yml`: two new jobs, `migration-lint` (squawk) and `secret-scan` (gitleaks).
- `.github/workflows/codeql.yml` (new).
- `.squawk.toml` (new).
- `backend/scripts/migrate.ts`: a lock timeout and a statement timeout for every migration.
- `implementation.md` §4.8 and §8.1.

**Reason:** EN-06.3 (SPM-172), the last piece of EN-06's pipeline. The rubric's "code quality and CI" row asks for checks beyond tests, and a team of six with AI agents writing code needs a net for risky schema changes and for passwords committed by accident.

## What it does

1. **squawk lints every migration a pull request adds or changes,** and fails on schema changes that are risky on a table that already holds data:
   - dropping a column or table;
   - changing a column's type;
   - a constraint that scans the whole table;
   - adding a column that is NOT NULL without a default.
   Merged migrations are never edited, so only new files are checked; three old event migrations would be flagged today.
2. **Five squawk rules are off, each with its reason in `.squawk.toml`.**
   - `int` versus `bigint`: our ints are minutes and quantities.
   - The two per-file timeout rules: `migrate.ts` now sets a 5-second lock timeout and a 60-second statement timeout for every migration's transaction. A migration that can't get its lock now fails instead of stalling every query behind it.
   - The two "build or drop indexes concurrently" rules: they can never pass, because Postgres refuses `CONCURRENTLY` inside a transaction, and every migration runs in one.
3. **gitleaks scans the whole history on every push and pull request,** so a secret committed and then deleted in a later commit still fails the build. It's a pinned release, checked against its published SHA-256 before it runs, like the Cerbos binary.
4. **CodeQL scans the JavaScript and TypeScript** on pull requests, on `main`, and every Monday. Findings go to the Security tab. It's the workflow form of CodeQL, which needs no admin rights. If a repo admin ever turns on GitHub's "default setup", this file should be deleted, because GitHub refuses both at once.

## Verified

Each check was proved to fail on a bad change, locally with the same commands and config, so no secret or risky migration was ever pushed to the shared repo:
- **squawk** exits 1 on a migration that drops a column and changes a column's type, and exits 0 on this week's new migrations (venue 0003, equipment 0001).
- **gitleaks** exits 1 on a throwaway repo where a fake GitHub token was committed and then deleted in a later commit. The repo's own 159 commits are clean.
- **The changed-migration filter** picks out exactly `venue/0003…` over PR #18's range.
- In CI, all jobs pass on this pull request, and CodeQL uploads its results.

---

# EN-02.3: Fifty attempts at once: exactly one wins, and the race found a bug

**Timestamp:** 2026-10-06T21:44+08:00 (SGT)
**Author:** Joash
**Scope:**
- planning-core tests: `tests/support/race.ts` (new, the harness) and `tests/race/invariants.test.ts` (new).
- The fix: `src/modules/venue/repo/slots.ts` (`insertVenueSlot` takes the venue lock) and `src/modules/equipment/repo/inventory.ts` (`reserveUnit` takes the type lock).
- Docs: `implementation.md` §4.6 rule 4 and the as-built notes; ADR-0006, an "As built" section.
- Traceability: four rows linking N1's and Q1's "exactly one succeeds" and "touching periods" criteria to the races.

**Reason:** EN-02.3 (SPM-170), the last piece of EN-02. N1, L3 and Q1 promise that when attempts race, exactly one wins. EN-02.1 and EN-02.2 built that guarantee into the database; this proves it under real contention.

## What it does

1. **The harness** (`race.ts`) opens one connection per attempt and starts a transaction on each. A barrier holds every attempt until all fifty transactions are open, then releases them together. It refuses to run against anything but this machine's own Postgres, so it never touches the shared database. In CI that's the throwaway one from EN-06.1.
2. **Four races, fifty attempts each:**
   - overlapping holds on one venue: exactly one wins, and the other 49 get the overlap refusal naming the winner;
   - holds that merely touch: all fifty win;
   - the last free projector: exactly one wins;
   - the last chair of bulk stock: exactly one wins, and the rest learn they're 1 short.
   The three "exactly one" races run ten rounds each, because one clean run doesn't rule out a rare loss.

## The bug it found

3. **With one round, every race passed. With ten, some losers failed with "deadlock detected" (`40P01`)** instead of the overlap refusal, for venue slots and projectors alike.
   - Two conflicting inserts in flight at once can each wait for the other on the exclusion constraint, and Postgres aborts one.
   - Exactly one insert still won every time, so the guarantee held. But a user would have seen a server error instead of N1's or Q1's refusal message.
   - EN-02.1's two-attempt test couldn't have caught it.
4. **The fix: contenders queue on a row lock.**
   - `insertVenueSlot` takes the venue row lock first, the lock M1 and I2 already take.
   - `reserveUnit` takes its equipment type's row lock, as bulk reservations already do.
   - Each loser now meets an already committed winner and gets the clean refusal. The exclusion constraints still decide.
   - This is recorded as rule 4 in `implementation.md` §4.6 and in ADR-0006.

## Verified

- **CI, with the fix:** all four races pass, ten rounds of fifty for each "exactly one" race, with no deadlocks. Planning-core's suite is 480 tests on the throwaway Postgres. The job was re-run once more and passed again.
- **Before the fix:** the same tests failed with `deadlock detected` in the venue and projector races.

---

# EN-02.2: Equipment availability is checked over a period

**Timestamp:** 2026-10-06T21:29+08:00 (SGT)
**Author:** Joash
**Scope:**
- planning-core equipment module:
  - migration `0001_equipment_inventory.sql` (the module's first);
  - `repo/inventory.ts` (new): `reserveUnit`, `reserveBulk`, `availableUnits`, `peakUse`, `lockEquipmentType`;
  - `domain/availability.ts` (new).
- contracts: `equipment.ts` (new) and the `INSUFFICIENT_EQUIPMENT` error code.
- Tests: `tests/equipment/repo/inventory.test.ts` (integration), `tests/equipment/domain/availability.test.ts`, `tests/boundaries/equipmentValues.test.ts`, and `contracts/tests/equipment.test.ts`. `tests/support/checkConstraints.ts` (new) is now shared with EN-02.1's values test.
- `implementation.md` §4.6, an "as built" note.

**Reason:** EN-02.2 (SPM-165), the equipment half of EN-02 (ADR-0006). The old design kept one counter per equipment type with no dates, so it couldn't tell Friday afternoon from Saturday. This unblocks O1, P2, P1 (once CQ-02 is answered) and EN-02.3, and gives Q1 and Q2 the tables they build on.

## What it does

1. **Serialized equipment** (a projector) has one row per unit. A per-unit exclusion constraint refuses a second reservation of the same unit for an overlapping period. `reserveUnit` reports that as `UnitAlreadyReservedError`, naming the unit. Touching periods are allowed.
2. **Bulk stock** (chairs) has a total on its type.
   - `reserveBulk` takes the type's row lock, works out the **peak concurrent use** inside the window, and reserves only if the new quantity fits under the total at that busiest moment.
   - Otherwise it refuses with `INSUFFICIENT_EQUIPMENT`, naming the requested, available and shortfall quantities, and reserves nothing.
   - The lock makes two simultaneous reservations take turns.
3. **Unavailability** marks one unit, or a quantity of bulk stock, out of service for a period with a reason. It counts as in use for both kinds.
4. **Peak use, not summed overlaps.** Back-to-back reservations aren't counted together. P1's wording could be read the other way, and CQ-02 asks the customer. The rule lives only in `peakConcurrentUse`, so the answer is a one-file change.
5. **The database keeps the kinds apart.** Composite foreign keys on (type, kind) mean a unit can only belong to a serialized type, and a bulk reservation only to bulk stock. A bulk type must have a total, and a serialized type mustn't.
6. **Nothing is deleted:** reservations are released, and unavailability is removed, by status. The values live in contracts, and a boundaries test keeps the migration's check lists equal to them.

## Verified

- **CI, first run, green.** All 16 equipment integration tests pass on the throwaway Postgres, including **two simultaneous reservations of one unit, and of the last bulk unit, where exactly one wins**.
- **A property test compares `peakConcurrentUse` with a minute-by-minute count** on 300 seeded random cases, as EN-02.2 recommended.
- Unit tests: planning-core 240 and contracts 77. Domain coverage stays at 100%.

---

# EN-02.1: The database refuses double-booked venues

**Timestamp:** 2026-10-06T21:20+08:00 (SGT)
**Author:** Joash
**Scope:**
- planning-core venue module:
  - migration `0003_venue_slots_and_unavailability.sql`;
  - `repo/slots.ts` (new): `insertVenueSlot`, `lockVenue`;
  - `domain/slotConflict.ts` (new).
- contracts: `venueSlots.ts` (new) and the `VENUE_SLOT_CONFLICT` error code.
- Tests: `tests/venue/repo/slots.test.ts` (integration), `tests/venue/domain/slotConflict.test.ts`, `tests/boundaries/venueValues.test.ts`, and `contracts/tests/venueSlots.test.ts`.
- `implementation.md` §4.6, an "as built" note.

**Reason:** EN-02.1 (SPM-160), the venue half of EN-02 (ADR-0006). N1, L3 and M1 require that exactly one of two racing holds or bookings succeeds, which a check in application code can't promise. This also unblocks I1, J1 and EN-02.3, and gives Sprint 3's L3, L1, M1, N1 and I2 the table they build on.

## What it does

1. **`venue.venue_slots` holds every hold and confirmed booking.** One exclusion constraint, `venue_slot_no_overlap`, refuses any two HELD or CONFIRMED slots at the same venue whose occupied periods overlap. Periods that merely touch are allowed.
2. **The occupied period includes setup and turnaround time** (CR-01, H3): `[start − setup, end + turnaround)`.
   - Each slot copies the venue's two times when it's taken, so changing them later never rewrites a stored period. H3 flags the bookings that would now conflict instead.
   - A small `venue.occupied_period` function computes it. It's declared immutable, because Postgres treats `timestamptz + interval` as only stable (days and months depend on the time zone; whole minutes don't).
3. **Requires Reconfirmation is a boolean column,** so a flagged booking stays CONFIRMED and keeps blocking its period. RELEASED and EXPIRED slots block nothing (L6's expiry needs no constraint change).
4. **`insertVenueSlot` turns the constraint's refusal into one people can act on.** It inserts in a savepoint. On Postgres `23P01` it looks up what the period overlapped and throws `VenueSlotConflictError` (`VENUE_SLOT_CONFLICT`), naming every reference. The look-up only shapes the message; the constraint already decided.
5. **`lockVenue` takes the venue row `for update`.** M1's approval and I2's block both call it first, so they serialise per venue (§4.6 rule 1).
6. **`venue.unavailability_blocks` is I2's table:**
   - CR-02's reason types (maintenance, equipment failure, renovation, safety, other);
   - a mandatory description;
   - removal by status (`REMOVED`), never by deleting.
   A block doesn't refuse an overlapping booking; I2 flags the booking.
7. **The status and reason values live in contracts.** A boundaries test fails if the migration's check lists drift from them.

The migration is numbered 0003 because H3's branch takes 0002 for the venue's two times. Nothing here depends on that, so the two can merge in either order.

## Verified

- **CI integration job:** all slot tests pass on the throwaway Postgres (EN-06.1), including **two simultaneous bookings where exactly one wins**, the customer's own CR-01 example (10:00–12:00 with 30 and 45 minutes occupies 09:30–12:45), and a second locker waiting on `lockVenue`.
- **The first CI run caught one wrong expectation in my tests:** an end before the start fails as a range error (`22000`) before the check constraint runs (`23514`). It is refused either way and nothing is stored; the test now says so.
- Unit tests: planning-core 223 and contracts 73. Domain coverage stays at 100%.

---

# EN-06.1: Integration tests run in CI against a throwaway Postgres

**Timestamp:** 2026-10-06T21:06+08:00 (SGT)
**Author:** Joash
**Scope:**
- `.github/workflows/ci.yml`: a new `integration` job.
- `backend/scripts/migrate.ts`: an `all` target. Root `package.json`: `npm run migrate:all`.
- `implementation.md` §8.1 and `README.md` (setup steps 4 to 7).

**Reason:** EN-06.1 (SPM-162), part of EN-06. Integration tests only ran on laptops, against the team's shared Supabase database, so no pull request ever ran them. EN-02.3's race tests also need a database CI owns.

## What it does

1. **A Postgres 17 service container** starts for the job and is thrown away with the runner. CLAUDE.md allows containers in CI only, and this is the only one.
2. **The job refuses to run** unless `DATABASE_URL` points at the runner itself, so CI can't reach the shared database by mistake.
3. **`npm run migrate:all` builds every schema from nothing:** identity with its seeds, then event, venue, equipment, change and notification. A new module has to be added to the list in `migrate.ts`. `--seed` now skips modules that have no `seed/` folder instead of failing.
4. **planning-core's and notification's full suites run against it.** Supabase and Kafka are placeholders that reach nothing: the tests stub token checks, and the relay tests use a fake publisher.

## Verified

- **First CI run, green:** planning-core 33 files and 410 tests, notification 10 files and 72 tests, all on a database built only from the migrations. No test depended on leftover data in the shared database.
- The unit-test job is unchanged and still green.

---

# H2: A venue's page shows everything recorded about it

**Timestamp:** 2026-10-05T13:01+08:00 (SGT)
**Author:** Seann, via Claude
**Scope:**
- The web app: `VenueDetail` (new), `VenueList` (a "View" link), `App.tsx` (the route), and `tests/venueDetail.test.tsx`.
- The test cards: `tests/H2/` (8 cases). Traceability.

**Reason:** H2 (SPM-33), Sprint 2. Coordinators judge a venue against an event's requirements from this page, and K1 and J1 build on it.

## What it does

1. **"View" on Venues opens a venue's page** for every internal role. It shows:
   - the building, maximum capacity and status;
   - each layout with its own capacity, as a table;
   - the facilities and accessibility features, one list item each, never a yes/no flag;
   - the opening hours, day by day.
2. **Everything is read from the catalogue on opening,** so an update shows at once.
3. **Venue Staff also get "Edit venue,"** which opens H1's editor.
4. **Attendees have no route to the page.** They land on their own screen without any venue data being fetched, and the API refuses them (`403`).

No API change: the page reads H1's `GET /api/v1/venues/{id}`.

## Without H3

5. **H2 was first built on top of H3** (CR-01's setup and turnaround times), and its page showed those two times.
6. **H3 isn't done and isn't merged.** Its three booking cases can't run until bookings exist, so it carries over to Sprint 3 on `feature-seann/h3-setup-turnaround`.
7. **H2 has been rebuilt from `main` without it.** The page, its test and H2-T1 no longer show the times, and H2-T1 and `tests/H2/README.md` note this. H3 adds them back when it lands.
8. **H1's CR-01 criterion** (the record also holds the two times) is still open for the same reason.

## Verified

- **The 8 H2 cards pass in Chrome** through the automated runner, against `ca285fa`.
- **H1's 14 cases still pass on this branch.**
- **web: 43/43**, including 6 tests for this page.
- **CI's steps all pass.**

---

# T2: Read and manage my notifications

**Timestamp:** 2026-10-04T16:49+08:00 (SGT)
**Author:** Seann, via Claude
**Scope:**
- The notification service: `src/api` (new: the routes, auth, the identity lookup and errors), `src/repo/notifications.ts`, `app.ts`, `config.ts`; five test files; and the coverage floors.
- `contracts`: `NOTIFICATION_NOT_FOUND`. The API specs: `notification.openapi.yaml` (new), the API README, and `lint:api` now covering both specs.
- The web app: `api/notifications.ts`, the `Notifications` screen, `shared/useUnreadCount.ts`, `App.tsx`, the `/notification` proxy, and a test file.
- The test cards: `tests/T2/` (14 new, 6 re-checked), `tests/README.md`, and the reset script.
- `.env.example`, `implementation.md` §2 and §10, and traceability.

**Reason:** T2 (SPM-61), Sprint 2. EN-04.3 stores notifications; this lets people read them.

## What it does

1. **The notification service gains T2's API:**
   - `GET /api/v1/notifications` lists the caller's own notifications, newest first, with the unread count, paged by cursor;
   - `POST /api/v1/notifications/{id}/read` marks one read, keeping the first read time;
   - `POST /api/v1/notifications/read-all` marks them all read.
   
   Another user's notification is never listed, and marking it read answers `404 NOTIFICATION_NOT_FOUND`.
2. **Who is calling comes from identity:** planning-core's `GET /api/v1/users/me`, called with the caller's own token, since this service may not read identity's tables.
   - Identity's 401 and 403 refusals pass through.
   - An unreachable identity is `503 IDENTITY_UNAVAILABLE` (CP).
   - `PLANNING_CORE_URL` overrides where identity is.
3. **Every role gets "Notifications" in the navigation, with the unread count.**
   - The screen lists notifications newest first, each unread one marked.
   - It offers **Mark as read**, **Mark all as read** and **Open**.
   - **Open** marks the notification read and goes to the role's own page for the event. That page shows a message and no event data when the user can no longer see the event (T2-T16).
4. **Read state is on each recipient's own row,** so it's per user and lasts across sessions.

## Test cards

5. **T2-T7 to T2-T20 were written from T2 before the code:**
   - the stored record;
   - only the related user notified;
   - nothing for a refused action;
   - ordering and count;
   - marking one or all read;
   - per user and across sessions;
   - opening, and access lost;
   - other users' notifications never shown;
   - E2's three notifications, which had no case.
   
   T2-T1 to T2-T6 were re-checked against T2's criteria and kept.
6. **`tests/README.md` gains:**
   - the notification migration;
   - a note that the cases need Kafka;
   - the FX-NOTIFICATION-ELSEWHERE fixture, for the access-lost case.
   
   The reset now removes the seeded accounts' notifications.

## Verified

- **All 20 T2 cards pass in Chrome** through the automated runner, against `84fc315`. Each one waits for the real notification to arrive through Kafka.
- **notification: 61/61 against the database.** That's 57 unit tests, including the refusals made before any query, and 4 against the database. The unit floors were raised to just under the new figures.
- **web: 30/30.**
- **CI's steps all pass.**
- **The cards found a bug in the test runner, not in the app.** The Unread marker is upper-cased by CSS, so an "is nothing unread?" check read the rendered text and could never fail. The checks are now case-insensitive.

## Notes

- **This branch is from `main`, parallel to the H1/H3/H2 stack.** Whichever merges second will conflict at the top of the CHANGELOG, in the reset SQL, and in the traceability file. Each conflict is just two blocks to keep.
- **Still to do in Jira:** create Test issues T2-T1 to T2-T20.

---

# H1: Venue Staff create and update venue records

**Timestamp:** 2026-10-04T15:43+08:00 (SGT)
**Author:** Seann, via Claude
**Scope:**
- planning-core: the venue module (`api`, `auth`, `domain`, `repo`, `index.ts`), migration `venue/0001`, `app.ts`, and the venue tests.
- `contracts`: `VENUE_NOT_FOUND`. The OpenAPI spec: the venue routes.
- The web app: `api/venues.ts`, the `VenueList` and `VenueEditor` screens, `App.tsx` and the `/venue` proxy, with two test files.
- The test cards: `tests/H1/` (14 cases), `tests/README.md` (the standard venue and FX-VENUE), and the reset script.
- `documentation/traceability/sprint-2.csv`.

**Reason:** H1 (SPM-32), Sprint 2. H2, H3, I1, J1, J2 and K1 all read the venue catalogue, so they wait on it.

## What it does

1. **"Venues" lists the catalogue for every internal role,** with each venue's status.
   - Venue Staff also get **New venue** and **Edit**.
   - Attendees are refused the catalogue.
2. **A venue record holds every attribute H1 lists:**
   - name, building, maximum capacity and facilities;
   - each layout with its own capacity;
   - accessibility features, listed one by one;
   - opening hours for each day of the week.
3. **The rules:**
   - capacities are whole numbers above zero;
   - at least one layout, each recorded once;
   - each day closes after it opens.
   
   A refusal names every field at fault at once, and shows each message under its field. A refused update stores nothing at all, valid fields included.
4. **Who may change venues:**
   - **Any Venue Staff member may create or update any venue,** as the EN-07.1 A2 policy says (your decision, 4 Oct).
   - **The creator is recorded as looking after the venue,** in `venue.venue_staff`, for A3's "own venues" scope later.
   - **Every other role gets `403 ROLE_NOT_AUTHORISED`,** and nothing changes.
5. **History.** Every create and update writes a `venue.venue_history` row: who, their role, when, and each changed field's previous and new value. An update that changes nothing writes no row.
6. **Inactive venues.** "Active" can be unticked; the venue stays in the catalogue with its record and history.
   - Dropping it from venue search is J1 and J2's job, and keeping it on the calendar is I1's, when those are built.
   - H1-T13 notes that split.

## A bug found by the browser run

7. **The editor blanked the page on the first keystroke.**
   - Each handler read `e.currentTarget.value` inside React's state updater, which runs after the event is released.
   - H1-T1 found it. A component test now types into every kind of field, and the fix reads the value first.

## Rules not spelled out in H1's criteria

- **Each layout is recorded once,** case-insensitive.
- **Opening hours must close after they open, as HH:MM** (H1-T14). A record with those wrong isn't usable.

## Verified

- **The 14 H1 cards ran in Chrome through the automated runner.**
  - All passed against `56eb0b2`.
  - The execution records name "Yichen, via automated testing".
  - The run's specs and helpers are local, as before (`tests/support`, `*.spec.ts`).
- **planning-core: 410/410 against the database.** That includes 46 venue tests: 21 for the rules, at 100% coverage, and 25 for the API.
- **web: 31/31.**
- **CI's steps:** lint, the boundary checks, the OpenAPI lint, typecheck, build, and `test:unit` in every workspace with its coverage floors.
- **The migration `venue/0001` is applied to the shared database.** It's a new schema, applied without a separate dry run.

## Not done here

- **CR-01's setup and turnaround times** are H3's (a separate branch on top of this one).
- **Venue Staff are only ever recorded as looking after a venue by creating it.** Assigning others is for whichever story needs it.

---

# EN-04.3: Notification service consumes Kafka, with an inbox, retries, a dead-letter topic and T2's recipient rules

**Timestamp:** 2026-10-04T14:34+08:00 (SGT)
**Author:** Seann, via Claude
**Scope:**
- `backend/services/notification` (new): the service, its migration and its tests.
- `backend/packages/kafka` (new): moved out of planning-core.
- planning-core: `src/shared/kafka/client.ts`, two test files and `package.json`.
- `backend/scripts/migrate.ts` and `kafka-check.ts`.
- Root `package.json` (`npm run dev`, `migrate:notification`), `.env.example`, and CI's coverage summary and artifacts.
- `implementation.md` §2, §3.5 and §10, and `tests/T2/README.md`.

**Reason:** EN-04.3 (SPM-171), ADR-0008. The relay (EN-04.2) publishes every event message, but nothing turned them into notifications. T2 (SPM-61) builds its read API and screen on top of this.

## The service

1. **A new service, `backend/services/notification`,** with its own `notification` schema.
   - It consumes `connectsphere.event.v1` and stores one row per recipient in `notification.notifications`.
   - Each row has the recipient, the type, the event and its reference, a message, and `read_at` for T2 (T2 AC1).
   - It serves its own `/healthz` and `/readyz` on `NOTIFICATION_PORT` (8091). `/readyz` requires the database and reports the broker.
   - `npm run dev` now starts it alongside planning-core and the web app.
2. **The inbox.** The message id goes into `notification.consumed_messages` in the same transaction as the notifications, first, with `on conflict do nothing`. A duplicate delivery, or a second consumer racing the first, finds the key taken and stores nothing. The Kafka offset is committed only after that transaction.
3. **Retries and the dead-letter topic:**
   - **A message that fails validation** goes straight to `connectsphere.notification.dlq.v1`, unchanged. That covers bad JSON, an envelope or data that fails its schema, and a type `contracts` doesn't know. The next message is handled as normal.
   - **A database failure** goes to `connectsphere.notification.retry.v1`. A retry worker holds it until it's due, heartbeating meanwhile, and tries again after 5 s, 30 s and 2 min, then dead-letters it.
   - **Headers** record the attempt, when it's due, the original topic and the error, so a dead-lettered message can be replayed.
4. **T2's recipient rules use only the facts in the message** (Jira). Only the users the message names, in their role on the event, are notified (T2 AC2):

   | Message | Who is notified |
   |---|---|
   | D2 clarification requested | the owner |
   | D3 response | the coordinator who asked |
   | D4 approval | the owner |
   | D5 rejection, with the reason | the owner |
   | E2 proposal | the nominee |
   | E2 acceptance | both coordinators |
   | E2 decline | the proposer |

   **B1 and E1:** `event.submitted` doesn't name the coordinator, so it notifies nobody. The `event.coordinator-assigned` message, written in the same transaction, tells the assigned coordinator the request is awaiting their review. That covers both stories' criteria. E3 (CR-05) will replace automatic assignment.
5. **Consumer groups** follow the rule already in `implementation.md` §3.1 and `.env.example` (SPM-113): `connectsphere.notification.event-notifier` and `connectsphere.notification.retry-worker`, plus `.<KAFKA_GROUP_SUFFIX>` on a laptop.
   - Jira's description suggested `notification.<env>`, which was written before that rule was agreed.
   - A new group starts at the newest message.
   - Every laptop's consumer writes to the same shared inbox, so a message is stored once however many are running.
6. **Without `KAFKA_*`, the service runs** its health endpoints and creates nothing. If the broker can't be reached at startup (e.g. Aiven powered off), it retries every 15 s.

## Shared Kafka code

7. **`backend/packages/kafka` (`@connectsphere/kafka`)** now holds the KAFKA_* reader, the credential redaction, the broker probe and the client builder. They moved from planning-core, so the code that handles credentials exists once.
   - Its tests are held at 100% coverage.
   - planning-core keeps only the relay's publisher.
   - `kafka:check` uses the package.
8. **`npm run migrate -- <name>` also runs a service's own `migrations/` folder.** `npm run migrate:notification` applies the new schema.

## Shared database

9. **`notification/0001` is applied to the shared database.** It creates a new schema and touches nothing existing. I dry-ran it first in a transaction that was rolled back.

## Verified

- **The two done-checks are tests written before the code:**
  - a duplicate delivery, and two consumers racing, each create one notification;
  - a poison message goes to the DLQ unchanged, and the next message is still stored.
- **Checked by breaking the code.** Removing the inbox's `on conflict`, or retrying a poison message instead of dead-lettering it, each fails tests.
- **Approving an event in the browser created the notification row** (Jira's third done-check).
  - `npm run dev` was running all three, and a coordinator approved a request in Chrome.
  - About 1 s later the organiser had *"Your event request EVT-004205 "Annual Research Symposium" has been approved."*
  - The coordinator's assignment notice from the same run was stored too, with no retries or dead letters.
- **notification: 43/43** (39 unit, 4 against the database). The domain rules are at 100%; elsewhere the floors sit just under today's figures.
- **planning-core: 364/364** against the database. That's 391 before, minus the 27 that moved to the package.
- **kafka package: 30/30.**
- **CI's steps:** lint, the boundary checks, the OpenAPI lint, typecheck, build, and `test:unit` in every workspace.
  - On this Windows machine, Vitest sometimes drops a test file after a `writeFile` error in its cache (web, notification and planning-core each did once).
  - Each workspace was rerun until every file ran, and all passed with their floors met.
- **Not tested automatically:** `consumer/run.ts`, the kafkajs wiring. It's covered only by the browser run above. A real SIGTERM isn't tested either, as with the relay.

## For T2

- **What T2 still builds:** the read, unread-count and mark-as-read API on this service, and the screen.
- **T2-T1 to T2-T6 can run once the screen exists.** T2-T1 and T2-T6 are both satisfied by the one assignment notification.
- **E2's three notifications are stored but have no T2 case yet.** They should get one.
- **CQ-03:** a notification appears about 1 s after its action, not inside the same transaction.
- **The local Playwright helpers** in `tests/support` (not in git) still point at ports 8081 and 8082, from before EN-01. Set `TEST_IDENTITY_URL` and `TEST_EVENT_URL` to `http://localhost:8090` when running them.

---

# EN-04.2: Outbox relay publishes to Kafka in order, exactly once per row; event module writes CloudEvents

**Timestamp:** 2026-10-03T12:49+08:00 (SGT)
**Author:** Seann, via Claude
**Scope:**
- planning-core `src/shared`:
  - `outbox-relay.ts`, `outbox/messages.ts`, `tracing.ts`, and `kafka/client.ts` and `kafka/probe.ts` (all new);
  - `kafka/config.ts`, moved from `backend/scripts/kafka-config.ts`;
  - `health.ts`.
- planning-core: `src/index.ts`, `src/app.ts` and `package.json` (`kafkajs`).
- The event module: `events/outbox.ts`, `index.ts` and `config.ts`, plus migrations `0005` and `0006`.
- Tests:
  - `tests/shared/` (new: five files);
  - the outbox assertions in five event API tests;
  - a separate commit fixing the dates in six of them.
- `backend/scripts/kafka-check.ts`, root `package.json`, `.env.example`, and `implementation.md` §3 and §10.

**Reason:** EN-04.2 (SPM-166), ADR-0008. Outbox rows were written but nothing published them, which is what T2 (through EN-04.3) is waiting for.

## The relay

1. **`OutboxRelay` publishes each module's outbox to Kafka.**
   - It runs inside planning-core whenever `KAFKA_*` is set.
   - It's keyed by the aggregate id, in CloudEvents structured mode, with `content-type: application/cloudevents+json`.
   - On success it sets `published_at`. On failure it increments `attempts`, records `last_error`, and leaves the row pending.
2. **Two relays can never publish the same row.** Rows are claimed `FOR UPDATE SKIP LOCKED`.
3. **Each aggregate's messages also stay in order.** Before claiming, a relay takes the table's advisory lock (`pg_try_advisory_xact_lock`), and skips the table if another relay holds it.
   - Without the lock, SKIP LOCKED lets a second relay publish an aggregate's later message while the first still holds an earlier one.
   - The two-relay test fails without the lock. I checked by removing it.
4. **Rows are published in `seq` order, not `created_at`.** Migration `event/0005` adds `seq`.
   - `created_at` is `now()`, the start of the writing transaction, so rows from one transaction tie: submission writes two at once.
   - A transaction that started first but waited for the event's row lock stamps an earlier time than one that committed before it.
   - `seq` is taken at insert, after that lock.
5. **A row that can never publish is set aside, never retried.** That covers a schema failure or an unknown topic.
   - Its `last_error` reads `unpublishable: …`, and it's logged.
   - It doesn't block the rows behind it.
6. **Failures back off:** 1 s, doubling, up to 30 s.
   - A pass that throws, e.g. when the database goes away, is logged and retried.
   - `stop()` lets the batch in flight finish. SIGTERM and SIGINT stop the server, then the relay, then Kafka and the database.
7. **`/readyz` reports the broker as `reachable`, `unreachable` or `not_configured`, but readiness requires only the database.**
   - While Kafka is down, requests still commit and messages wait in the outbox, so a Kafka outage shouldn't become an API outage.
   - The probe connects, describes the cluster and disconnects. It caches its answer for 5 s.
8. **No Kafka settings means no relay.** A laptop without `KAFKA_*` (or with `.env.example`'s placeholders) runs planning-core without the relay, and logs why. Incomplete settings are logged by variable name.
9. **The producer is configured to:**
   - never create topics;
   - keep one request in flight, so a retry can't overtake;
   - wait for all replicas to acknowledge (`acks: -1`);
   - hash keys as the Java client does.

## CloudEvents on the outbox

10. **The event module's `writeOutbox` now writes and validates a CloudEvent** with `parseCloudEvent`, with source `/connectsphere/planning-core/event`.
    - Its callers are unchanged.
    - `EVENT_SERVICE_NAME` is no longer read, and `causationId` is gone.
11. **The relay converts rows still in the old envelope,** using §3.3's mapping. That covers rows written by code on `main` until this merges.

## The backlog (team decision, 3 Oct 2026)

12. **Migration `event/0006` marks every row already waiting as handled,** with `last_error = 'skipped: written before the outbox relay existed (EN-04.2)'`. That's 3,728 rows on the shared database, nearly all from test runs since 15 Sep.

**`0005` and `0006` are already applied to the shared database.** I dry-ran both in a transaction that was rolled back first. Nothing needs migrating by anyone else.

## Also

13. **The KAFKA_* reader moved into planning-core,** as `src/shared/kafka/config.ts`, so the relay and `npm run kafka:check` share it.
    - The reader's tests are now Vitest unit tests.
    - The script keeps its own `.env`-file parsing.
14. **The six event API test files no longer use a fixed date** (a separate commit). From 3 Oct, B2 refused their 2 Oct date, breaking 101 tests on `main`.

## Verified

- **The relay's integration tests (7), against Postgres,** on throwaway tables, so no teammate's relay can take their rows. They cover:
  - two relays: exactly once, in order;
  - broker down, then recovered;
  - a set-aside row;
  - an old-envelope row converted;
  - several outboxes;
  - shutdown mid-batch.
- **Checked by breaking the code.** Removing the lock, SKIP LOCKED, or the set-aside filter each fails a test.
- **The full planning-core suite: 391/391.**
- **CI's steps:**
  - lint, the boundary checks, the OpenAPI lint, typecheck and build;
  - `test:unit` in every workspace, with the coverage floors met. planning-core lines went from 45.9% to 51.7%, branches 97.5%.
- **End to end against Aiven:**
  - planning-core started with the relay, and `/readyz` said `kafka: reachable`;
  - the submission tests wrote real outbox rows;
  - the relay published all 19 that were left;
  - a separate consumer received all 19 as valid CloudEvents, keyed by their event, and none was left pending.
- **Not checked:** a real SIGTERM. Windows can't send one to another process, so graceful shutdown is covered only by the test of `stop()`.

---

# EN-04.1: CloudEvents 1.0 envelope, per-aggregate topics and contract tests in `contracts`; `implementation.md` §3 rewritten

**Timestamp:** 2026-10-03T11:16+08:00 (SGT)
**Author:** Seann, via Claude
**Scope:**
- `backend/packages/contracts`:
  - `src/cloudEvent.ts` and `tests/cloudEvent.test.ts` (new);
  - `src/topics.ts` and `tests/topics.test.ts`;
  - `src/envelope.ts` (comment only) and `src/index.ts`.
- `backend/scripts/kafka-check.ts`
- `implementation.md`: the header note, §1, §3, §8.1 and the appendix
- one comment in planning-core's `modules/event/config.ts`

**Reason:** EN-04.1 (SPM-161), the first step of EN-04. ADR-0008 replaced the custom envelope and the per-event-type topics, and EN-04.2 (the relay) and EN-04.3 (the notification service) build on this contract.

## The envelope

1. **`cloudEventSchema`** is a CloudEvents 1.0 event in structured mode, with:
   - the attributes `id`, `source`, `type`, `specversion`, `time`, `subject` and `datacontenttype`;
   - the extensions `correlationid`, `traceparent` and `actor`;
   - today's payload schemas as `data`.
   
   **`parseCloudEvent`** checks the envelope, then the `data` for its `type`, and refuses an unknown type by name.
2. **The schema is strict.**
   - An attribute outside the contract is refused, e.g. the old camelCase `correlationId`.
   - `subject` must be the aggregate's UUID, which is also the message key.
   - `time` must be UTC with milliseconds.
   - `traceparent` must be valid W3C Trace Context. An all-zero trace or span id is refused.
   - `correlationid` is optional, for scheduled jobs. When present, it can't be empty.
3. **`actor` is one string: `ROLE:userId`, or `SYSTEM`.**
   - CloudEvents extension values must be strings, so the old `{ userId, role }` object can't be carried as it was.
   - `formatActor` and `parseActor` convert both ways.
   - A user role must name its user, and `SYSTEM` must not.
4. **The old envelope (`envelope.ts`) stays for now,** marked as superseded.
   - The event module's outbox writer still produces it, and EN-04.2 moves the writer to CloudEvents.
   - §3.3 gives the field-by-field mapping, so the relay can convert rows already written in the old shape.
   - `causationId` was dropped. No producer ever set it.

## Topics

5. **`AGGREGATE_TOPICS` holds the four aggregate topics from the Jira item:**
   - `connectsphere.event.v1`
   - `connectsphere.venue-booking.v1`
   - `connectsphere.equipment-reservation.v1`
   - `connectsphere.registration.v1`

   It also keeps **`connectsphere.equipment-request.v1`**, chosen for O2 under SPM-113 and already created on Aiven. A request line and a reservation are separate aggregates.
6. **Retry and dead-letter topics are named per consumer,** by `retryTopic()` and `deadLetterTopic()`:
   - `connectsphere.<consumer>.retry.v1` and `connectsphere.<consumer>.dlq.v1`;
   - a consumer name that isn't lowercase kebab-case is refused.
7. **`KAFKA_TOPICS` is now the full layout:** the five aggregate topics plus the notification consumer's two.
   - The five-topic cap moved to the new **`TOPICS_BEFORE_CUTOVER`**: the four topics on Aiven until 13 Oct, unchanged from SPM-113.
   - `npm run kafka:check` now requires only those four. It shows the other three as `cutover` instead of failing.

## Contract tests

8. **Every event message type has an example message, and each one validates:** the nine event-module types.
   - A test fails if a type is added to `contracts` without an example.
   - 36 envelope tests, plus 13 topic tests.
9. **Checked by breaking the code.** Removing `.strict()`, dropping the millisecond rule, and allowing an all-zero trace id each turned one test red.

## `implementation.md`

10. **§3 is rewritten for ADR-0008.** It covers:
    - the topic table, retry and DLQ naming, the before-cutover set, legacy names and consumer groups;
    - the key = `subject` rule;
    - the CloudEvents attributes, with an example and the old-to-new mapping;
    - the outbox relay with `SKIP LOCKED`;
    - inbox, retry and DLQ handling.
11. **Elsewhere in `implementation.md`:**
    - §3 is removed from the header's list of sections that conflict with the ADRs.
    - §9 is added to that list, because it still sends logs to a Kafka topic. ADR-0013 sends them to Loki, and the rewrite belongs to EN-08.
    - §1 now cites ADR-0008 for Kafka, and §8.1 says "message `id`".
    - The appendix item "Hosted Kafka provider not yet chosen" is removed. The ADR-0008 note and §3 now decide it.

**Needs a second owner's review** before merge, because it changes `contracts` (`implementation.md` §2).

## Verified locally

- contracts 64/64.
- Typecheck, build, lint and the module boundary check.
- The full planning-core suite: 321/321, but only with its test dates moved forward.
  - Six event API test files fix the event's date at 2 Oct 2026. From 3 Oct, B2 correctly refuses that date as past, so those files fail on `main`, with or without this change.
  - With their dates moved to 2027 for one run, then restored, all 321 passed.
  - Fixing those dates is separate work, not part of this entry.
- `test:scripts`.
- `npm run kafka:check` against Aiven: the four topics are present.

---

# SPM-113: Hosted Kafka chosen (Aiven now, Confluent from 13 Oct), five Sprint 2 topics, `npm run kafka:check`

**Timestamp:** 2026-10-02T14:22+08:00 (SGT)
**Author:** Seann, via Claude
**Scope:**
- `backend/packages/contracts/src/topics.ts` and its test (new); `contracts/src/eventEvents.ts` and `index.ts`
- the event module's four producers and `events/outbox.ts` in planning-core, and eight assertions in its API tests
- `backend/scripts/kafka-check.ts` and `kafka-config.ts`, with its test (new)
- root `package.json` and `package-lock.json` (`kafkajs` dev dependency, `kafka:check`, `test:scripts`)
- `.env.example`, `.gitignore`, ADR-0008

**Reason:** SPM-113 picks the hosted Kafka provider that EN-04 (SPM-122) builds against. ADR-0008 now has the decision note.

## The provider

1. **Aiven's free plan for development now, then Confluent Cloud's free trial from 13 Oct 2026.**
   - Aiven lasts the semester, but allows only five topics and has no Kafka Connect.
   - Confluent has everything, but only for 30 days, which must cover the Week 13 Q&A on 11 Nov.
   - The decision note in ADR-0008 covers the comparison, the timing, the limits and the cutover steps.
2. **ADR-0008's Owner is now Seann,** who took EN-04.

## Five topics, and a backup of the old names

3. **The Sprint 2 topics live in `contracts/src/topics.ts` as `KAFKA_TOPICS`:**
   - `connectsphere.event.v1`
   - `connectsphere.equipment-request.v1`
   - `connectsphere.notification.retry.v1`
   - `connectsphere.notification.dlq.v1`
   - one slot spare

   This is ADR-0008's one-topic-per-aggregate rule, and it fits Aiven's five. A test fails if a sixth is added before the cutover.
4. **The nine per-event-type topic names are kept, as `LEGACY_EVENT_TOPICS`.**
   - Outbox rows written before today carry them, and `aggregateTopicFor()` routes those rows to the event topic.
   - An unknown name is refused, never guessed.
   - `EVENT_TOPICS` is removed.
5. **The event module now writes every outbox row to `connectsphere.event.v1`.**
   - The envelope's `messageType` still says what the message is, e.g. `event.submitted`.
   - `OutboxMessage.topic` is typed, so a legacy name won't compile.
   - The eight test assertions that checked a per-type topic now check the topic and the `messageType`.

## Connectivity check and settings

6. **`npm run kafka:check`** reads only the `KAFKA_*` block of `.env`, never other secrets. Then it:
   - connects;
   - lists the cluster's topics against `KAFKA_TOPICS`;
   - exits non-zero if one is missing;
   - redacts the username and password from any error it prints.

   Ten unit tests cover the config reader, and they run in `test:scripts`, so CI runs them too.
7. **`.env.example` gains `KAFKA_SSL_CA_PATH` and `KAFKA_GROUP_SUFFIX`.**
   - `KAFKA_SSL_CA_PATH` is needed because Aiven signs its brokers with its own CA. The file is kept outside the repo, in `~/.connectsphere/kafka/`.
   - It also documents where each value comes from, and the consumer-group rule:
     - deployed: `connectsphere.<service>.<consumer>`;
     - on a laptop: add `.dev-<initials>`.
8. **`.gitignore` now refuses certificate and key files** (`*.pem`, `*.key`, `*.cert`, `*.crt`, `*.p12`, `*.jks`) as a backstop.

No credential is in any file in this change.

## Verified locally

- contracts 22/22.
- The full planning-core suite: 321/321.
- `test:scripts`, lint and boundary lint.
- The connectivity check reached the Aiven broker. It stops at TLS until `ca.pem` is downloaded and `KAFKA_SSL_CA_PATH` is set.

---

# Week 7 customer changes CR-01 to CR-06: change log, story revision 4, design updates

**Timestamp:** 2026-10-02T16:30+08:00 (SGT)
**Author:** Joash
**Scope:**
- `documentation/change-requests.md` (new)
- `documentation/final user stories.md` (revision 4)
- `documentation/c4/connectsphere.dsl` and its README
- ADR-0006, ADR-0009 and ADR-0010
- `implementation.md` §4.6, `plan.md` §1
- `documentation/proposals/2026-10-02-week7-customer-changes.md`

**Reason:** The customer's Week 7 changes, all required for Release 1 (Week 12), handled as the course's *Managing Changes* guide describes. They arrived in the last week of Sprint 2, so they're planned at Sprint 3 and Sprint 4 planning.

## The change log

1. **`change-requests.md` records each change under the guide's six headings:** the change, why it's needed and its type; the backlog; the acceptance criteria; story points; design; and tests.
   - CR-01: setup and turnaround time.
   - CR-02: a venue becoming unavailable after booking.
   - CR-03: several venues for one event.
   - CR-04: tentative holds expire.
   - CR-05: the Event Coordinator Lead.
   - CR-06: the Operational Safety Check.
2. **Two earlier decisions are reversed, on the record:** buffers were out of scope (`plan.md` §1), and coordinators could see all events (A3).
3. **Seven new customer questions, CQ-04 to CQ-10,** cover what the changes leave open:
   - which capacity limits registrations for a multi-venue event;
   - whether every booking must be confirmed;
   - who places a hold and sets its expiry;
   - whether peer reassignment stays;
   - what rejecting a safety arrangement leads to;
   - whether buffers apply to holds and blocks;
   - where emergency access is recorded.

## The stories (revision 4: 63 stories across 21 features)

4. **Nine new stories:**
   - A4: coordinators act only on assigned events;
   - E3: the Lead's unassigned queue and assignment;
   - E4: the Lead reassigns;
   - E5: the Lead's oversight;
   - H3: setup and turnaround time;
   - L4: several venues per event;
   - L5: requesting a replacement venue;
   - L6: holds expire;
   - U1: the Operational Safety Check, in new feature 21.
5. **Sixteen stories not yet Done have revised acceptance criteria, each marked ⚠ REVISED with its change:** F1, F5, H1, I1, I2, J1, K1, L1, L3, M1, N1, N2, R1, R2, R7 and S3.
   - Overlaps now compare occupied periods.
   - L3's "holds do not expire" is replaced.
   - F1's status list gains Safety Review.
   - F5 leads to Safety Review rather than Confirmed.
   - I2's "resolved outside the system" becomes L5.
6. **The Done stories A3, D1, E1 and E2 keep their criteria** (guide scenario 2). Each gets a note naming the new story that supersedes part of it.
7. **No story points were written.** The new and revised stories are estimated at planning poker (PX-02).

## Design documentation

8. **C4 model:**
   - two new people, the Event Coordinator Lead and the Safety Officer;
   - the new responsibilities of the venue, identity and change modules;
   - two new sequence views, SafetyCheck (U1) and HoldExpiry (L6).

   CI re-renders the images.
9. **ADRs:**
   - ADR-0006 notes how CR-01, CR-03 and CR-04 fit the existing constraint: buffers in `blocked_period`, conflicts flagged when buffers change, and `EXPIRED` holds already ignored;
   - ADR-0009 adds the `HoldExpiry` workflow;
   - ADR-0010 records the two new roles and the narrower coordinator scope.
10. **Planning docs:** `implementation.md` §4.6 and `plan.md` §1 no longer say buffers are out of scope.

---

# SPM-116: coverage thresholds in CI, with domain code held at 100%

**Timestamp:** 2026-10-02T15:45+08:00 (SGT)
**Author:** Joash
**Scope:**
- the Vitest configs and `test:unit` scripts of planning-core, contracts and web
- `.github/workflows/ci.yml`, `.github/scripts/coverage-summary.mjs` (new)
- four new domain tests, in planning-core's validation and access-scope suites
- `implementation.md` §8.1, `README.md`

**Reason:** SPM-116, part of EN-06. `implementation.md` §8.1 and the rubric target 100% coverage of domain code, but nothing measured it.

1. **Coverage is measured on every unit run.** Each workspace's `test:unit` now runs Vitest with the v8 coverage provider, and the thresholds in its config fail the build.
2. **`src/**/domain/**` in planning-core is held at 100%** of lines, branches, functions and statements. Reaching it took four new tests for paths nobody had tested:
   - a proposed start or end time that is present but not a valid date;
   - a registration opening or closing time that is present but not a valid date;
   - equipment-request scope for a role other than Tech Support;
   - an unknown resource name, which must get no access.

   No line needed a "can't be covered" exemption.
3. **Everything else has an honest floor** just under today's unit-only figures:

   | Workspace | Lines | Branches | Functions |
   |---|---|---|---|
   | planning-core, outside `domain/` | 39% | 93% | 24% |
   | web | 60% | 70% | 40% |
   | contracts | 15% | 10% | 0% |

   The planning-core floor is low because `api/` and `repo/` are covered by integration tests, which CI can't run until EN-06.1. Contracts is mostly schema declarations that its own tests don't import. Floors only ever go up.
4. **CI shows it:**
   - a coverage table in the job summary, with domain code on its own row;
   - the HTML reports in the `coverage-reports` artifact, uploaded even when the run fails.
5. **Checked both ways:** running only part of the suite fails both the domain threshold and the floor.

---

# EN-07.1: Cerbos permission policies for A2, with 574 policy tests

**Timestamp:** 2026-10-02T15:10+08:00 (SGT)
**Author:** Joash
**Scope:**
- `policies/` (new)
- `backend/scripts/cerbos.ts` (new)
- the root `policies:test` script and a CI step
- contracts `tests/policyRoles.test.ts` (new)
- ADR-0010 implementation note

**Reason:** EN-07.1 (SPM-163), ADR-0010. A2 requires one list of who may do what, governing both the interface and the server. Until now the list existed only as `requireRole` calls scattered through handlers.

## The policies

1. **Six resource policies:** event, venue, booking_request, equipment_request_line, equipment_type and registration.
2. **Five derived roles:** `owner`, `assigned_coordinator`, `nominated_coordinator`, `venue_manager` and `registrant`.
3. **Every rule is named after the story it implements,** and `policies/README.md` maps each A2 function to its rule.
4. **Two boundaries keep the policies small and consistent:**
   - policies say who may act, and status rules stay in each module's domain code;
   - Cerbos decides actions, and which rows each role sees (A3) is row-level security in EN-07.2.

## Tests first

5. **The suites came first.** I derived them from the stories, not from the policies: every role against every action on every resource, listing only the allows, so anything unlisted must be denied.
6. **Red, then green, in CI.** I committed the tests first, and CI went red with every expected allow denied. With the policies added, all 574 checks pass.
7. **Role names are checked.** `contracts/tests/policyRoles.test.ts` fails if a policy uses a role name that isn't in `ROLES`, or leaves a role with no permission. I proved it with a planted `EVENT_ORGANIZER` typo.

## Running Cerbos without Docker

8. **`backend/scripts/cerbos.ts` runs Cerbos 0.56.0.** It downloads the pinned release, verifies its SHA-256 against the release's checksums, caches it and runs it. `npm run policies:test` compiles the policies and runs the suites, and CI runs it on every pull request.
9. **Cerbos ships no Windows build.** On Windows the script explains that and exits non-zero; CI or WSL runs the tests. ADR-0010 records why the binary was chosen over the embedded PDP: embedded bundles need Cerbos Hub.
10. **Not wired in yet.** Handlers still use `requireRole`. The gateway, the services and the console's navigation adopt the policies with EN-12 and module by module, and EN-07.3 generates the full authorisation matrix.

---

# EN-09: C4 model as code, rendered in CI; OpenAPI spec for planning-core, checked against the routes

**Timestamp:** 2026-10-02T14:40+08:00 (SGT)
**Author:** Joash
**Scope:**
- `documentation/c4/` (new: model, README, images)
- `documentation/api/` (new: OpenAPI spec, README)
- `.github/workflows/diagrams.yml` (new)
- planning-core `tests/api/openapiRoutes.unit.test.ts` (new)
- the root `lint` script, `.gitignore`

**Reason:** EN-09 (SPM-127). The system-design deliverable needs diagrams of the architecture the ADRs decided, and ADR-0015 needs a contract for each API. The repo had neither.

## C4 model (`documentation/c4/connectsphere.dsl`, Structurizr DSL)

1. **Seven views:**
   - system context (L1);
   - containers (L2);
   - planning-core's five modules (L3);
   - dynamic views for F3/F4 cancellation (freeze, commit, finalise) and R2 registration (seat row, outbox, notification);
   - two deployment views: what runs today (`npm run dev` against hosted Supabase and Kafka) and the production target on AWS.
2. **Planned elements are drawn dashed.** Anything designed but not yet built is tagged `Planned`, and its technology names the enabler that builds it, so the diagrams never pass off the target as what runs today.
3. **CI renders the model.** The Diagrams workflow validates it, exports every view and renders PNG and SVG. Structurizr needs Java 17+, so it runs in CI, where containers are allowed (ADR-0012).
   - The old `structurizr/cli` image has been retired upstream: it now prints a notice and exports nothing. The workflow uses the consolidated `structurizr/structurizr` image, pinned.
4. **`images/`** holds the rendered PNGs and SVGs for submission folder 2. The README says how to refresh them from a CI run.

## OpenAPI (`documentation/api/planning-core.openapi.yaml`, OpenAPI 3.1)

5. **All 26 routes** planning-core serves today, Identity's and Event's. For each it gives:
   - the roles allowed;
   - request bodies, taken from the zod schemas;
   - responses, taken from the repo row types;
   - every refusal with its error code.

   Two behaviours are documented explicitly: a coordinator opening a Submitted request claims it, and submitting a draft with no body submits it as last saved.
6. **Kept honest two ways:**
   - `npm run lint` now includes `lint:api` (Redocly). The spec is valid; the only two warnings are the health probes, which genuinely have no 4XX.
   - A unit test walks the Express router and fails if the spec and the routes differ. I proved it by deleting one path from the spec: the test failed and named it.
7. **AsyncAPI waits for EN-04.1,** which replaces today's message envelope and topic naming.

---

# SPM-114: CI on every pull request — lint, typecheck, build, unit tests

**Timestamp:** 2026-10-02T12:30+08:00 (SGT)
**Author:** Joash
**Scope:**
- `.github/workflows/ci.yml` (new) and `eslint.config.js` (new)
- `package.json` scripts in the root, planning-core, contracts and web
- `planning-core/vitest.unit.config.ts` (new)
- small type-only edits in nine planning-core API tests
- `implementation.md` §2 and §8.1, `README.md`

**Reason:** SPM-114, the first step of EN-06. The repo had no CI at all, and every other item's Definition of Done needs a green pipeline.

## The pipeline

1. **`.github/workflows/ci.yml`** runs on every pull request and every push to `main`, using Node from `.nvmrc`. It runs `npm ci`, then:
   - `npm run lint`;
   - `npm run typecheck`;
   - `npm run build`;
   - `npm run test:unit`.

   It needs no secrets. The four connection settings it sets are placeholders, which point at port 1 and the `.invalid` domain so nothing can connect.
2. **Integration tests stay off in CI.** Today they write to the shared Supabase project, which CI must never touch. EN-06.1 (SPM-162) brings a throwaway Postgres and turns them on.

## What counts as a unit test

3. **The rule:** a test under a `domain/` or `boundaries/` folder, or named `*.unit.test.ts`. planning-core's `vitest.unit.config.ts` runs exactly those, which is 155 tests. Contracts (15), web (24) and the script tests (13) are all unit tests already.
4. **The identity adapter test** was renamed to `identity.unit.test.ts`, because it uses no database.
5. **Proof that no unit test touches a database:** I ran the unit suite locally with the same placeholder credentials CI uses, and it passed.

## Lint

6. **ESLint 9 was added.** The repo had no linter. It uses the recommended JavaScript and TypeScript rules, plus React's hooks rules for the web app. `npm run lint` runs ESLint on the tracked source folders, then the module boundary checks.
7. **The 40 findings it raised were fixed in code, not by weakening the rules:**
   - 37 `any`s in planning-core tests, now real types for the mocked `verifyJwt` and the response items;
   - three unused `sql` parameters, removed from the empty venue, equipment and change routers until a route needs them;
   - `.dependency-cruiser.cjs` became `.dependency-cruiser.mjs`, so it needs no CommonJS globals.

## Verified locally

- Lint, typecheck, build and the unit tests all pass.
- The full planning-core suite still passes against the database: 321/321.

---

# EN-01: Identity and Event merged into planning-core, with module boundary checks

**Timestamp:** 2026-10-02T09:45+08:00 (SGT)
**Author:** Joash
**Scope:**
- `backend/services/planning-core` (new; replaces `backend/services/identity` and `backend/services/event`)
- root `package.json` and `package-lock.json`, `backend/scripts/migrate.ts`, `.env.example`, `frontend/vite.config.ts`
- `README.md`, `tests/README.md`, `implementation.md` §2 and §11, `definition-of-ready.md`, `plan.md` §8, ADR-0004
- `documentation/traceability/sprint-1.csv` and `sprint-2.csv` (test paths only)

**Reason:** EN-01 (SPM-119), ADR-0004. Until this change the architecture was decided on paper only; the code was still two services. Almost every Sprint 2 story builds inside the new layout, so this unblocks them. **No HTTP route, status code, error message or event message changed.** The only visible difference is that log lines now say `"service": "planning-core"`.

## EN-01.1 — the skeleton and the boundary checks

1. **One deployable, `@connectsphere/planning-core`:**
   - `src/app.ts` mounts each module's router;
   - `src/index.ts` starts it on `PLANNING_CORE_PORT` (default 8090);
   - `src/shared/` holds the config, database pool, logger, JWT verification and health endpoints that both services had copies of.
2. **Five modules** under `src/modules/`: `identity`, `event`, `venue`, `equipment` and `change`.
   - Each has a public `index.ts`, the only file another module may import.
   - Venue, equipment and change are empty, with their folders in place for H1, O1, P2 and the rest.
3. **`npm run lint:boundaries`** runs two checks. I showed both failing on a planted violation and passing on the real code.
   - **Imports:** dependency-cruiser fails on an import of another module's internals, on shared code importing a module, and on import cycles. It's pinned to v17, because v18 needs Node 22 and the project pins Node 20.
   - **SQL:** `scripts/check-schema-boundaries.ts` fails when a file in `src/` or `migrations/` names another module's schema. Its matching rule is unit-tested (11 cases, including a reference split across lines).
4. **Migrations** now live in `migrations/<module>/`, and `migrate.ts` reads them there. The `schema_migrations` keys are still `identity` and `event`, so nothing is re-applied. I checked read-only that all 9 files are recorded as applied.

## EN-01.2 and EN-01.3 — Identity and Event moved in

5. **Code, migrations and tests moved with `git mv`,** so `git log --follow` still shows each file's history. Each service's copy of the shared files was replaced by the one in `src/shared/`, and Identity's duplicate health test was dropped.
6. **The event module no longer calls Identity over HTTP.**
   - `auth/identityClient.ts` became `auth/identity.ts`, which calls `lookUpCaller` and `resolveAccessScope` from `modules/identity/index.ts` in the same process.
   - Refusals are unchanged: 401 `UNAUTHENTICATED`, 403 `NO_ROLE_ASSIGNED`, and 503 `IDENTITY_UNAVAILABLE` when identity's records can't be read. Seven new unit tests pin them.
   - `IDENTITY_BASE_URL` is no longer read.
7. **`modules/event/index.ts` exports `findEventForPlanning`.** It returns an event's timing, attendance and requirements, and keeps the A3 scope rule. K1, J1's prefill and O1 read the event through it (3 integration tests).
8. **Configuration is split by owner:**
   - `shared/config.ts` holds what every module reads;
   - `modules/identity/config.ts` holds the Supabase Auth client's settings;
   - `modules/event/config.ts` holds the coordinator pool and the message `producer`, which stays `event-service`.

   Older `.env` files keep working. `PORT`, `SERVICE_NAME`, `EVENT_PORT` and `IDENTITY_BASE_URL` are simply ignored now.
9. **`npm run dev`** starts planning-core and the web app. The Vite proxy sends both `/identity/*` and `/event/*` to planning-core, so no frontend API call changed.

## Verified

- **Tests:** 321 pass (26 files). That's the 297 from before minus Identity's duplicate health test, plus 26 new tests.
- **Typecheck:** `tsc --noEmit` passes.
- **Boundary checks:** `npm run lint:boundaries` passes.
- **Live run:** planning-core started and served `/healthz`, `/readyz`, and Identity's and Event's routes on one port. A real sign-in as the seeded coordinator, organiser and attendee gave the same results as before:
  - coordinator: all events and the review queue;
  - organiser: only their own event, refused the queue;
  - attendee: no events, refused the queue.

## Review

The `code-reviewer` agent reviewed the diff and approved it, with no critical or high findings. I fixed its one actionable low: the SQL check missed a reference split across lines.

The injected-`sql` point is a deliberate follow-up. The event module's `authenticate` middleware uses the shared pool, not the router's injected `sql`, which is no worse than the HTTP call it replaced. Fixing it means changing every event router, so it waits for a separate PR.

## For the team

- **Raphael (F1):** F1's next tasks move from `backend/services/event/src/…` to `backend/services/planning-core/src/modules/event/…`, and its tests to `tests/event/…`. Rebase onto this branch, and git will follow the renames for files you've already changed.
- **Unblocked once this merges:**
  - H1, F2, G1, EN-02.2, EN-07.2, EN-08 and EN-03;
  - F1 too, as far as EN-01.3 is concerned;
  - K1, once H1 is done.

---

# Jira changes — pull-ready Sprint 2: subtasks, blocker links, Start-here sections, ranking; Definition of Ready

**Timestamp:** 2026-10-02T07:50+08:00 (SGT)
**Author:** Joash
**Scope:**
- Jira project SPM, Sprint 2 (id 68)
- `documentation/planning/definition-of-ready.md` (new)
- `.gitignore`
- `documentation/sprint allocation.csv` (the R2 row)

**Reason:** Anyone on the team should be able to open Jira, take the top item that's ready and nobody has started, and know exactly what to do, without waiting to be told. This follows the team's approval of the target architecture (Gates A, B and D, 1 Oct). **No story points were written.** Gate C stays open until the PX-02 poker session.

## Jira

1. **The five biggest enablers are split into 15 subtasks**, each about a day of work, with its own scope, done-check and agent prompt. The parent closes when all its subtasks are Done.

   | Enabler | Subtasks |
   |---|---|
   | EN-01 modular core (SPM-119) | EN-01.1 skeleton and boundary checks (SPM-159), .2 move Identity (164), .3 move Event (169) |
   | EN-02 invariant kernel (SPM-120) | .1 venue slots, exclusion constraint and row lock (160), .2 equipment units and bulk peak check (165), .3 race harness (170) |
   | EN-04 Kafka messaging (SPM-122) | .1 CloudEvents in contracts (161), .2 outbox relay with SKIP LOCKED (166), .3 notification service with inbox, retries and DLQ (171) |
   | EN-06 CI pipeline (SPM-124) | .1 ephemeral Postgres for integration tests (162), .2 mutation testing (167), .3 migration lint, CodeQL and gitleaks (172) |
   | EN-07 policies and RLS (SPM-125) | .1 Cerbos policies for A2 (163), .2 row-level security for A3 (168), .3 generated authorization matrix test (173) |

2. **39 "Blocks" links** record what waits for what:
   - each subtask chain;
   - SPM-114 (CI) before the CI subtasks and SPM-115/116;
   - every story behind the enabler subtask that creates its module or tables (for example H1 behind EN-01.1, F1/F2/G1/K1 behind EN-01.3, I1/J1 behind EN-02.1, O1/P1/P2 behind EN-02.2, T2 behind EN-04.3);
   - P1 also behind CQ-02.
3. **A Start-here section on every Sprint 2 development item**, below the existing description, which is unchanged. It covers:
   - what blocks the item;
   - what to read first;
   - where the code goes under ADR-0004;
   - what to watch out for;
   - when it's done;
   - an agent prompt to paste into Claude Code.
4. **Labels:**
   - `ready` on the six items that can start now: SPM-114, SPM-113, SPM-127, EN-01.1, EN-04.1 and EN-07.1;
   - `blocked` on everything else in the development lane;
   - parent enablers have neither label, because people take their subtasks instead;
   - `process` added to CQ-01 to 03 (alongside `customer-question`), to match the PX tasks.
5. **Sprint 2 is ranked in work order:**
   - setup and platform first;
   - then venue (H1, H2, J2, K1, I1, J1), equipment (P2, O1, O2, P1), event (F1, F2, G1) and T2;
   - then EN-08, EN-03 and EN-05;
   - the process lane (PX and CQ) at the bottom, so it never looks like the next coding task.

   Ready subtasks are ranked beside their parents. The ready list now reads SPM-114 → EN-01.1 → SPM-113 → EN-09 → EN-07.1 → EN-04.1.

## Repo

6. **`documentation/planning/definition-of-ready.md`** covers:
   - how to pick up work (assign yourself first, one item at a time, and swap `blocked` for `ready` on what you unblock);
   - the subtask rule;
   - the Definition of Ready checklist;
   - the labels;
   - the planning-core folder layout;
   - the saved-filter JQL.

   SPM is team-managed, so the board has no custom JQL quick filters. The page uses the board's Label filter and saved filters instead, and explains why the JQL leaves out `sprint in openSprints()`: subtasks don't carry the sprint.
7. **`.gitignore`** now covers other teams' example submission zips, personal agent scratch folders and a stray Windows `NUL` file, so none of them can be committed by accident.
8. **`documentation/sprint allocation.csv`:** R2's reason now says seat rows live in the registration service and are claimed with `SKIP LOCKED` (ADR-0005, EN-13), instead of the old counter wording.

## Still for the team

- Create the four saved filters (`definition-of-ready.md`, "Filters").
- Self-assign, top of the ready list first.
- Hold the PX-02 poker session (Gate C).
- Name the Sprint 2 PO (PX-11).
- Explain the missing test issues SPM-82 to 107.

---

# Adopt the target architecture: ADR-0004 to ADR-0015, design fixes, plan and allocation restated to Jira

**Timestamp:** 2026-10-01T20:44+08:00 (SGT)
**Author:** Joash
**Scope:**
- `documentation/adr/` (12 new ADRs, 3 status changes, the index)
- `documentation/planning/implementation.md` (§4.5–§4.7, a top note, §8.4 attendee-shell line)
- `documentation/planning/plan.md` (§2–§9)
- `documentation/sprint allocation.csv`
- `CLAUDE.md`
- `documentation/proposals/2026-10-01-target-architecture-and-jira-plan.md` (gate log)

**Reason:** Batch 4 of `documentation/proposals/2026-10-jira-changeset.md`. The team approved the target architecture (Gates A, B and D, reported 1 Oct 2026), and the repo documents now say what Jira and the ADRs say. No code changed: building the enablers is sprint work for their owners.

## Architecture decisions

1. **ADR-0004 to ADR-0015 written as Accepted**, one per decision D1–D12 on the target architecture page:
   - **0004** modular core instead of six microservices, which **amends ADR-0001**.
   - **0005** registration service with seat rows.
   - **0006** Postgres enforces every invariant.
   - **0007** event-sourced Event aggregate.
   - **0008** Kafka with a CDC outbox, CloudEvents and a schema registry.
   - **0009** Temporal for cross-service steps and timers, which **supersedes ADR-0002**.
   - **0010** Cerbos and row-level security.
   - **0011** gateway, CDN, rate limits and waiting room.
   - **0012** containers, Kubernetes, GitOps and Terraform, which **supersedes ADR-0003's no-Docker rule** (Gate D). Hosted Kafka continues under 0008.
   - **0013** OpenTelemetry and SLOs.
   - **0014** two front ends, one contract.
   - **0015** contract-first HTTP APIs.

   Each ADR has context, decision, alternatives, consequences, the enabler that implements it, and an owner: whoever takes that enabler. The owner presents the ADR in the Week 13 Q&A.
2. **ADR-0001, 0002 and 0003:** only their status lines changed, to amended or superseded. Their bodies are kept as the record of what we believed then. The ADR index lists all fifteen, and the template gains an Owner line.

## Four design bugs fixed in `implementation.md`

3. **Equipment had no time dimension.** The `equipment.availability_counters` total/reserved row couldn't answer "free between 2 and 5 pm on Friday", which P1, P2 and Q1 need. It's replaced by:
   - per-unit `unit_reservations` with an exclusion constraint, for serialized items;
   - an equipment-type row lock plus a peak-concurrent-use check, for bulk stock.

   P2's reduction check uses the same lock instead of `SERIALIZABLE`. P1's counting rule is marked as waiting on CQ-02.
4. **A block could slip past an in-flight approval.** M1 (approve) and I2 (block) now both take `SELECT … FOR UPDATE` on the venue row first.
5. **Requires Reconfirmation is a flag, never a status,** so a flagged booking keeps blocking its slot. A hold converted by L1 stays HELD until M1 or M2 decides. The slot constraint now uses `blocked_period` (buffers zero in Release 1).
6. **The F5 contradiction is resolved.** §4.7 told us both to re-verify across services inside the writing transaction and never to hold a transaction across HTTP. Under ADR-0004, F5 reads the booking and the reservations in one core transaction, so the "never HTTP inside a transaction" rule has no exception.

7. **A note at the top of `implementation.md`** lists the sections that still describe the six-service design (§2, §3, the registration counters in §4.6, §6), the ADR that wins for each, and the enabler owner who rewrites it. Those sections were deliberately not rewritten here.

## `plan.md` §2–§9 and the sprint allocation

8. **§2–§8** now describe the accepted architecture: the modular core plus two edge services, the containers, module ownership and schemas, how things talk, the invariants with a per-operation consistency table, the F4 semantic lock (replacing the saga), and the local and staging topology. The section numbers are unchanged, because other documents link to them.
9. **§9 now copies Jira, the single source of story points.**
   - **Sprint 1 is restated as 35** (all fifteen stories Done). Sprint 2 shows Jira's 34 story points after F3 left (37 at the 27 Sep estimate), plus P1, which is not yet estimated.
   - Sprints 3 and 4 show only F5 (5) and F3 (3). Everything else waits for planning poker (PX-02).
   - The 1 Oct moves are recorded with reasons, with enablers per sprint and the sprint dates.
   - The wrong CSV filename (`/documentation/sprint-reallocation.csv`) is fixed.
10. **`documentation/sprint allocation.csv`:**
    - *New Points* now holds Jira's value, or blank where Jira has none. 36 rows changed: A3, B2, D1, D3, D4 and D5 to their Sprint 1 poker votes; G1, H1, I1, J1, O1 and P2 to their 27 Sep values; the Sprint 3 and 4 stories to blank.
    - F3, P1, F5 and R1 have their new sprint, change and reason. S1 and S2 note the `change-approval` flag.
    - *Old Points* is untouched.

## Correction note on the Sprint 1 figures

11. Earlier documents gave Sprint 1 as 34 (the planning transcript), 44 planned and 47 delivered (`plan.md` and the CSV), and 52 (the 2026-09-20 entry below this one). Those came from document estimates that never matched the team's planning-poker votes in Jira, for example A3 = 5 in the documents but 1 in Jira, and B2 = 5 against 2. **Jira's 35 is the figure from now on.** The older entries in this file are left as they were written, since they record what we believed at the time.

## Other

12. **`CLAUDE.md`:** the no-Docker paragraph is replaced. Containers are built in CI only (ADR-0012). Local development is still `npm run dev` against hosted Supabase and Kafka, with no `docker-compose.yml`, Testcontainers or `supabase start`. CI integration tests use an ephemeral Postgres, never the shared database.
13. **Plan file:** Gates A, B and D are recorded as passed on 1 Oct, as reported by Joash, with a note to add the channel and names. Gate C is recorded as not passed.

---

# Jira changes — Batch 3: sprint placement (story moves, enablers, scrum-evidence tasks)

**Timestamp:** 2026-10-01T20:40+08:00 (SGT)
**Author:** Joash
**Scope:** Jira project SPM: Sprints 2 (id 68), 3 (id 101) and 4 (id 102).
**Reason:** Gate B of the target architecture and Jira plan (team decision, reported 1 Oct 2026). Sprint 2 is running, so everything added to it here is a recorded mid-sprint scope change. Jira's burndown will show it as scope added on 1 Oct, which is accurate.

## Story moves, each with a comment on the issue giving the reason

1. **F3 (SPM-29): Sprint 2 → Sprint 4.** Cancellation is one command with F4; shipping it alone means rewriting it.
2. **P1 (SPM-48): backlog (planned for Sprint 3) → Sprint 2.** It shares its time-based availability model with P2. It has no points in Jira yet, and it waits on the answer to CQ-02.
3. **F5 (SPM-109): backlog (planned for Sprint 4) → Sprint 3.** Readiness becomes an in-core query once M1 and Q1 exist.
4. **R1 (SPM-52): backlog (planned for Sprint 3) → Sprint 4.** It is built on the registration service's seat inventory, and the attendee PWA shell moves into EN-13.
5. **S1 (SPM-57) and S2 (SPM-58): placed in Sprint 3** behind feature flag `change-approval` (EN-15). Approval stays off in production until S3 lands.

## Stories placed in the sprints that now exist

These were in the backlog only because Sprints 3 and 4 didn't exist until Batch 1. They are not moves.

6. **Sprint 3:** I2, K2, L1, L2, L3, M1, M2, N1, N2, Q1, Q2 (SPM-35, 39, 40, 41, 110, 42, 43, 44, 45, 50, 51).
7. **Sprint 4:** F4, G2, R2, R3, R4, R5, R6, R7, S3 (SPM-111, 31, 53, 54, 55, 56, 112, 108, 59).

## Enablers, scrum-evidence tasks and customer questions

8. **Sprint 2:** EN-01 to EN-09 (SPM-119 to 127), PX-01 to PX-14 (SPM-142 to 155) and CQ-01 to CQ-03 (SPM-156 to 158).
9. **Sprint 3:** EN-10 to EN-15 (SPM-128 to 133).
10. **Sprint 4:** EN-16 to EN-23 (SPM-134 to 141).

## Resulting sprints

| Sprint | Stories | Other issues | Total issues |
|---|---|---|---|
| 2 | 14 (F1, F2, G1, H1, H2, I1, J1, J2, K1, O1, O2, P1, P2, T2) | 4 setup tasks, 9 EN, 14 PX, 3 CQ | 44 |
| 3 | 14 (I2, K2, L1, L2, L3, M1, M2, N1, N2, Q1, Q2, S1, S2, F5) | 6 EN | 20 |
| 4 | 11 (F3, F4, G2, R1, R2, R3, R4, R5, R6, R7, S3) | 8 EN | 19 |

**Points:** Jira's Sprint 2 stories stand at 34, plus P1 not yet estimated, and the setup tasks hold 12. Sprint 3 and 4 stories carry only F5 (5) and F3 (3). Everything else waits for planning poker (PX-02).

**Load:** Sprint 2 ends on 6 Oct and now carries far more than the measured velocity of 35. Most enablers and PX tasks will carry into Sprint 3. The Sprint 2 review and retro should say so plainly.

No assignees were set; the team picks items up at standup. Nothing was deleted.

---

# Jira changes — Batch 2: enabler and process epics, EN-01 to EN-23, PX-01 to PX-14, CQ-01 to CQ-03

**Timestamp:** 2026-10-01T20:39+08:00 (SGT)
**Author:** Joash
**Scope:** Jira project SPM. 42 issues created, 4 edited, 48 links added.
**Reason:** Gate A of the target architecture and Jira plan (team approval, reported 1 Oct 2026). These issues put the platform work and the missing scrum evidence on the backlog, so they are planned and tracked like stories.

## Epics

1. **SPM-117 — Platform and quality enablers** (label `enabler`).
2. **SPM-118 — Scrum process evidence** (label `process`).

## Enablers (Task, parent SPM-117, labels `enabler` plus `tier-1` or `tier-2`)

3. **EN-01 to EN-23 created as SPM-119 to SPM-141, in order** (EN-01 = SPM-119 … EN-23 = SPM-141).
   - Each description holds the tier, the proposed sprint and "Proposed estimate (to be poker'd): N".
   - It also holds what the enabler blocks and the target architecture page's plain-language "what it is" and "why we need it".
   - Then come the plan's acceptance criteria word for word, a one-line Week 13 Q&A answer and the matching ADR.
   - Tier 1: EN-01, 02, 04, 06, 07, 08, 09, 11, 13, 14, 15, 17, 18, 20, 22, 23 (16 issues). Tier 2: EN-03, 05, 10, 12, 16, 19, 21 (7 issues).
   - **No story points were written.** Gate C is still open: the proposed estimates came from the plan, not from the team's planning poker (PX-02).

## Scrum-evidence tasks (Task, parent SPM-118, label `process`)

4. **PX-01 to PX-14 created as SPM-142 to SPM-155, in order.** Each holds a suggested owner, a "done when" and, where one exists, the matching template from the sprint evidence playbook: planning record, standup entry, review record, retro record, clarification entry or AI-usage entry. PX-13 lists the six Week 7 consultation questions.

## Customer questions (Task, parent SPM-118, label `customer-question`)

5. **CQ-01 — R7 VIP adds versus registration places** (SPM-156).
6. **CQ-02 — P1 peak concurrent use or summed overlaps** (SPM-157).
7. **CQ-03 — T2 notification visible within about 10 seconds** (SPM-158).

Each holds the question, why it matters and the design's proposal. They are unassigned until the Sprint 2 PO is named (PX-11).

## Existing setup tasks: linked, not merged

8. **SPM-113 (Kafka provider), SPM-114 (GitHub Actions), SPM-115 (branch protection) and SPM-116 (coverage)** were moved under SPM-117 and labelled `enabler` and `tier-1`.
   - They overlap EN-04 (SPM-113) and EN-06 (SPM-114 to 116), but they are narrower and already carry 12 points the team set.
   - So they are **linked** ("relates to") rather than merged. Their summaries, points and Sprint 2 placement are unchanged.
   - EN-04's and EN-06's descriptions say to size only the remaining scope.

## Links

9. **41 "blocks" links**, from the plan's §5 "Blocks" and "(needs …)" columns:
   - EN-01 → F5, F4, S2, S3, G2
   - EN-02 → L3, M1, N1, I2, P1, P2, Q1
   - EN-03 → F1, F2, G1, S2
   - EN-04 → T2, EN-20
   - EN-06 → EN-21
   - EN-08 → EN-17
   - EN-10 → EN-16, EN-21
   - EN-11 → F1, F4, R6, S3, EN-20
   - EN-12 → R1, R2, EN-19
   - EN-13 → R1–R7, EN-18, EN-20
   - EN-15 → S1, S2
10. **7 "relates to" links:**
    - EN-05 ↔ EN-04: "improves EN-04".
    - EN-07 ↔ A2 and EN-07 ↔ A3: both stories are Done, so they can't be blocked.
    - SPM-113 ↔ EN-04 and SPM-114, 115, 116 ↔ EN-06.

One link timed out on the first try (EN-10 → EN-16). It was confirmed missing, then retried successfully.

**Known ordering issue:** EN-11 (Sprint 3) blocks F1 (Sprint 2), because F1's "Completed after the end time" needs the Sprint 3 timer. EN-11's description says so; raise it at the Sprint 2 review.

Nothing was deleted.

---

# Jira changes — Batch 1: housekeeping (start Sprint 2, close finished epics, create Sprints 3 and 4)

**Timestamp:** 2026-10-01T20:35+08:00 (SGT)
**Author:** Joash
**Scope:** Jira project SPM, board 2.
**Reason:** The team approved the target architecture and Jira plan (Gates A, B and D, reported 1 Oct 2026). Batch 1 of `documentation/proposals/2026-10-jira-changeset.md` puts the board into a state the rest of the rollout can build on. The starting state is recorded in `documentation/planning/jira-snapshot-2026-10.md`.

1. **SPM Sprint 2 (id 68) started.** It had never been started in Jira (state `future`), so Jira had no burndown or sprint report for it. Its original dates were kept: 23 Sep 15:30 to 6 Oct 23:30 SGT. Goal set from `plan.md` §9's Sprint 2 theme: "Status, notifications, venue catalogue, equipment intake". The first start attempt, which re-sent the dates, timed out without effect. A second attempt with only the goal succeeded.
2. **Feature 1 to 5 epics moved to Done:** SPM-62, SPM-63, SPM-64, SPM-65, SPM-66. Every story under them (A1–E2) was already Done.
3. **T1 (SPM-60) commented.** It was already Done (closed by Chai on 15 Sep). The comment records that it was removed in Revision 3, where its triggers went, and that it is closed, not deleted (`implementation.md` §4.3).
4. **SPM Sprint 3 created** (id 101): 7 Oct 15:30 to 20 Oct 23:30 SGT. Goal: "Holds, booking, conflict, reservation, attendee shell".
5. **SPM Sprint 4 created** (id 102): 21 Oct 15:30 to 3 Nov 23:30 SGT. Goal: "Registration, readiness, change impact (showcase)". This ends before Friday of Week 12, which the project instructions set as the latest end for the final sprint.

Nothing was deleted.

---

# F1 in progress — design, plan, cards, and the transition table

**Timestamp:** 2026-09-30T21:30+08:00 (SGT)
**Author:** Raphael, via Claude
**Scope:** F1
**Reason:** F1 (event status lifecycle) is Sprint 2 work. Sprint 1 built the transition rule its
own stories needed, but only four of six transitions consult it, `setStatus()` accepts any status
unguarded, and nothing completes an event. This push is the first slice: the agreed design, the
twelve-task plan, F1's functional cards, and the transition table. **F1 is not done.** Tasks 3–12
(the guarded write path, moving each Sprint 1 path onto it, the completion sweep) follow.

## Added

- **Design and plan:** `documentation/superpowers/specs/2026-09-30-f1-status-lifecycle-design.md`
  and `documentation/superpowers/plans/2026-09-30-f1-status-lifecycle.md` (with its `.tasks.json`).
- **`tests/F1/`** — eleven functional cards written from F1's acceptance criteria before any code,
  and **FX-SEEDED** in `tests/README.md` for statuses no user action can reach yet.
- **`CONFIRM`** (Approved/Planning → Confirmed; F5 performs it) and **`COMPLETE`** (Confirmed →
  Completed) in the transition table, with `transitionRule()`, `refusalMessage()` and the
  not-yet-due message built from the status labels.
- **Tests:** every status against every action, checked against an independently written table of
  from-lists and targets; the ten permitted statuses against the story's own words.

## Decided, and raised

- **Only Confirmed events complete.** AC6 says when an event completes but not from which status;
  Raphael decided on 2026-09-30. The Sprint 2 Product Owner, once named, should see it.
- **§11.12 was waived for F1.** The team decided the cards are not confirmed by a second person
  before code is written, and dropped the agent pre-review. The human check moves to merge time:
  the PR reviewer checks each card's expected result against its AC. `implementation.md` §11.12
  still states the before-code rule; amending it is a separate, reviewed change. For that check to
  be enforced, `main` needs branch protection requiring an approving review — **not yet enabled**.
- **No story moves an event into Planning.** Raised; F1 does not invent the action.

## Verified

- Event-service domain tests: 127/127. `tsc` clean. The cards were diffed against the plan's text.
- Not yet run: the full suite (no database code has changed yet), and the F1 cards themselves
  (their behaviour is not built yet).

---

# Submission package folder, with the test and sprint spreadsheets generated from source

**Timestamp:** 2026-09-30T15:00+08:00 (SGT)
**Author:** Chai, via Claude
**Scope:** `submission/`, `documentation/scripts/build-submission.ts` (+ test), `package.json` (`exceljs`, `submission:build`), `confluence-digest.ts` (`standupName` exported).
**Reason:** The Week 12 zip needs numbered folders 1–7, and last year's G4T2 handed in test cases, sprint backlogs and standups as spreadsheets. Hand-typing those would create a second copy of the test cards, the backlog and CHANGELOG, and it would drift. `npm run submission:build` now derives them instead.

## Added

- `submission/` mirroring the seven deliverable folders (the AY26/27 instructions merge release and CI/CD into folder 6).
- Generated: `3. Test Cases/Functional Test Cases.xlsx` (129 cards, a sheet per feature area), `Automated Test Traceability.xlsx`, `4. Sprint Meetings/3. Sprint Backlogs.xlsx`, `2. Sprint Updates.xlsx`. The Sprint 1 review/retro and transcripts are copied, never retyped.
- Hand-written: `4. Sprint 1 Planning.md`, the final-sprint recordings stub, `7. README/README.md`.

## Known gap

- Sprint 1 story points still disagree across sources: the poker figures in the transcript sum to 35 (34 was announced), the Confluence Jira table and `sprint allocation.csv` both total 47 with different per-story figures. The planning doc records all three. The spreadsheets use the CSV until the PO names one authoritative source.

## Follow-up

- Name both instructors in `submission/7. README/README.md` once they have accepted repository access.
- At each sprint boundary, add the sprint to `SPRINTS` in `build-submission.ts` and mark the reviewed one.

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

# Sprint 1 Review & Retrospective, written up from the team call

**Timestamp:** 2026-09-20T22:45+08:00 (SGT)
**Author:** Chai, via Claude
**Scope:** none (process document, no story) — closes out Sprint 1's documentation.

## Added

- **`documentation/transcript/sprint-1-review-retrospective.md`** — the Sprint Review and Sprint
  Retrospective for Sprint 1, written up from the 20 Sep team call transcript and categorised
  against the Scrum Review/Retro structure from the course's Week 3 slides (increment inspected,
  progress toward the product goal, stakeholder feedback — explicitly none this sprint — and
  backlog adaptation for Review; people/interactions/processes/tools/DoD, what went well, what
  problems occurred, and a Start/Stop/Continue improvement set for Retro). Intended to be pasted
  into Confluence.
- **Deliberately carries no story-point figures.** An earlier draft cited "52 of 44 planned
  points" and listed F1 as delivered, both sourced from `plan.md` §9. The team confirmed live that
  F1 was **not** built this sprint, and that story-point totals for Sprint 1 currently disagree
  across the team's planning documents — likely accumulated drift from different agents/sessions
  editing different documents without reconciling them. Rather than pick one figure as correct,
  this document states delivered scope only as a story list (A1–E2, no F-series items) and flags
  the point-total conflict itself as an open reconciliation item — `plan.md` is left untouched
  here; correcting it is separate, later work.

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
