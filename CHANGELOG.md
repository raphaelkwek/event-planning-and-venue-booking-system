# Changelog

> **Convention — read before editing this file:** entries are newest-first. When adding a new entry, insert it directly below this header, above every existing entry. Never append to the bottom. This header itself never moves and is never treated as an entry.

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
