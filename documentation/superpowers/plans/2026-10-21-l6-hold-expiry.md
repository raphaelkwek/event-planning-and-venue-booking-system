# L6 — Tentative Holds Expire: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Placed holds expire at their expiry time (status Expired, slot freed, record kept), the holding coordinator is reminded before and told after, and Venue Staff can change a held hold's expiry (SPM-182, CR-04).

**Architecture:** A Temporal `holdExpiry` workflow per placed hold, started like EN-11's `completeEvent`: placing a hold writes `venue-booking.hold-placed` to the venue outbox; a consumer on the venue-booking topic `signalWithStart`s the workflow; the workflow waits for the reminder time and the expiry, and its activities (`remindHoldIfDue`, `expireHoldIfDue`) let the database decide under the hold's lock. Changing the expiry writes `hold-expiry-changed`, which becomes a reschedule signal.

**Tech Stack:** TypeScript, Express, porsager `postgres`, Temporal TS SDK 1.24 (time-skipping test env), KafkaJS, React + Atlaskit.

**Spec:** `documentation/superpowers/specs/2026-10-21-l6-hold-expiry-design.md`. **Branch:** `feature-raphael/l6-hold-expiry` (from `main`).

---

## Ground rules for every task

- Read `CLAUDE.md`, `documentation/planning/implementation.md`, ADR-0009. `PC` = `backend/services/planning-core`.
- **Never** run migrations or writes against the shared DB, never read `.env`. DB tests run only in CI.
- Before each commit, at the repo root: `export DATABASE_URL=postgres://ci:ci@127.0.0.1:1/ci_unused SUPABASE_URL=https://ci.invalid SUPABASE_ANON_KEY=ci-placeholder SUPABASE_JWKS_URL=https://ci.invalid/auth/v1/.well-known/jwks.json`, then `npm run lint && npm run typecheck && npm run test:unit` (every workspace, with coverage, as CI). Type-check new test files ad hoc with a temporary tsconfig and delete it.
- Conventional Commits ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Stage only your files.
- jsonb parameters: `${JSON.stringify(v)}::text::jsonb`, never `${…}::jsonb`.
- Patterns to copy: L3's `src/modules/venue/{domain/hold.ts,repo/holds.ts,api/holds.ts}` and `tests/venue/**`; EN-11's `src/temporal/**` and `tests/temporal/**`; the venue outbox `src/modules/venue/events/outbox.ts`; L1's notification wording in `backend/services/notification/src/domain/recipients.ts` (`period()`).
- Workflow code must stay deterministic (no I/O, no real clock); the replay test guards EN-11's workflow — don't change `completeEvent`.

## Tasks

### Task 1: Cards — in progress separately (`tests/L6/`). STOP for Raphael's review is not needed (standing preference: show them and carry on).

### Task 2: Contracts, notification rules, migrations

- Contracts (`venueBooking.ts` and its payload registry): `venue-booking.hold-placed` `{ holdId, holdReference, venueId, eventId, expiresAt, reminderLeadMinutes }`; `venue-booking.hold-expiry-changed` `{ holdId, holdReference, venueId, expiresAt, changedBy }`; `venue-booking.hold-expiring` and `venue-booking.hold-expired` `{ holdId, holdReference, venueId, venueName, eventId, eventReference, eventName, coordinatorId, startsAt, endsAt, expiresAt }`. Contracts tests: each valid; a missing field refused.
- Notification rules, both to `coordinatorId`, using `period()`:
  - expiring: `Hold ${holdReference} on ${venueName} for ${event}, ${period}, expires on ${expiry}. Convert it to a booking request or ask Venue Staff to extend it.`
  - expired: `Hold ${holdReference} on ${venueName} for ${event}, ${period}, expired on ${expiry}. The period is free for others.`
  (`expiry` formatted in Singapore time like `period()`.) Tests assert full sentences. `hold-placed` and `hold-expiry-changed` have no rule (nobody is notified) — confirm the notification consumer only processes types with rules, or that an unruled type is accepted (it must be registered in `MESSAGE_DATA_SCHEMAS`, else it is dead-lettered).
- `PC/migrations/venue/0013_hold_expiry.sql`: add `reminded_at timestamptz`, `expired_at timestamptz`; constraint `holds_expiry_recorded` `((status = 'EXPIRED') = (expired_at is not null)) not valid`. `0014_validate_hold_expiry.sql` validates it. Squawk both.
- Root gate. Commit `feat(l6): hold expiry messages, notification rules and columns`.

### Task 3: Venue module — remind, expire, change expiry

- `domain/holdExpiry.ts` (100% unit tests): `reminderAt(expiresAt: string, leadMinutes: number): Date`; `readExpiryChange(body, now)` → `{ ok, expiresAt }` or field error on `expiresAt` ("Give the new expiry date and time." / "…must be later than now."). Reuse `readPlacement`'s parsing if it fits.
- `repo/holds.ts`: `Hold` gains `remindedAt`, `expiredAt`. New functions, each locking the hold first:
  - `remindHoldIfDue(tx, holdId)` → `{ outcome: "reminded", message } | { outcome: "not-due", remindAt } | { outcome: "already" } | { outcome: "gone", status }`; due when HELD, `reminded_at is null` and `now() >= expires_at - lead`; sets `reminded_at = now()` and writes `hold-expiring` to the venue outbox (reads venue name and the event via `event/index.ts` for reference/name/coordinator — the holding coordinator is `requested_by`).
  - `expireHoldIfDue(tx, holdId)` → `{ outcome: "expired" } | { outcome: "not-due", expiresAt } | { outcome: "gone", status }`; due when HELD and `expires_at <= now()`; sets hold `status='EXPIRED', expired_at=now()`, its slot `status='EXPIRED'`, writes `hold-expired`.
  - `changeHoldExpiry(tx, hold, expiresAt, actorUserId)`: HELD only; sets `expires_at`, clears `reminded_at`; writes `hold-expiry-changed`.
  - `placeHold` additionally writes `hold-placed` (in its transaction).
- API: `PATCH /api/v1/holds/:id/expiry`, `requireRole("VENUE_STAFF")`, `looksAfterVenue` → else 404 `HOLD_NOT_FOUND` (as L3's place route), `readExpiryChange` → 400, lock, not HELD → 409 `HOLD_NOT_HELD` (L3's message helper), 200 the hold. OpenAPI path and the two new hold fields, in the same commit.
- Remove L3's stopgap? Keep `hasExpired` on convert (a HELD hold past expiry before the timer fires must still be refused).
- Repo/API tests (CI only) for each outcome. Root gate. Commit `feat(l6): remind, expire and change a hold's expiry`.

### Task 4: Temporal workflow, activities, consumer, worker

- `src/temporal/workflows/holdExpiry.ts`: input `{ holdId, expiresAt, reminderLeadMinutes }`; `holdRescheduleSignal({ expiresAt })`; loop: wait until reminder time (skip if already reminded for this expiry) → `remindHoldIfDue` → wait until expiry → `expireHoldIfDue`; `not-due` → wait again until the returned time (with a 60 s floor like EN-11's `RECHECK_AFTER_MS`); `gone` or `expired` → return. A signal resets the waits and the "reminded" flag. Export from `workflows/index.ts`; `holdExpiryWorkflowId(holdId) = "hold-expiry-" + holdId` in `src/temporal/domain/`.
- `src/temporal/activities/holdExpiry.ts`: `createHoldExpiryActivities` wrapping the venue repo functions in a transaction (export what the worker needs from `venue/index.ts`).
- `src/temporal/holdExpiryConsumer.ts` + run function: parse with `parseCloudEvent`; `hold-placed` → `signalWithStart(holdExpiry, { args, signal: holdRescheduleSignal, signalArgs })`; `hold-expiry-changed` → same (signalWithStart is safe if the workflow ended); others ignored. Subscribed to `KAFKA_TOPICS.venueBooking` with its own consumer group.
- `worker.ts`: register the activities and start the consumer beside EN-11's.
- `tests/temporal/holdExpiry.unit.test.ts` with `TestWorkflowEnvironment.createTimeSkipping()` and fake activities (as `completeEvent.unit.test.ts`): reminder fires at expiry − lead, then expiry at expiry; reminder at once when already past; `not-due` waits again; `gone` stops; a reschedule signal moves both and re-arms the reminder. Name the main test `"L6-T10 …"`. Unit tests for the consumer (as `completionConsumer.unit.test.ts`).
- Don't add replay histories (recording needs a live server); note it in the workflow's header for a follow-up.
- Root gate. Commit `feat(l6): a Temporal timer expires each placed hold`.

### Task 5: Backfill job

- `src/modules/venue/jobs/` or `src/temporal/`: `runScheduleHoldExpiries.ts` — reads every HELD hold and `signalWithStart`s its workflow; logs a summary; exits 1 on failure (as F1's `runCompleteEvents.ts`). Root `package.json` script `jobs:schedule-hold-expiries`. A unit test of the selection/scheduling with a fake scheduler. Commit `feat(l6): schedule expiry timers for holds placed before L6`.

### Task 6: Card tests

- `PC/tests/venue/api/l6Cards.test.ts`, modelled on L3's card tests (find them in `tests/venue/api/`): FX-L6 via the real request/place routes; one `it("L6-Tn …")` per card T1–T9 calling the routes and the repo functions directly for expiry/reminder (the timer is T10's); T3 checks F5's readiness ignores the expired hold (via the change module's index if exposed, else the readiness repo). Commit `test(l6): a test per card`.

### Task 7: Screens

- Venue Staff's hold list (find the screen that places holds): "Change expiry" on HELD holds → datetime field, "Save", inline refusal. Wherever holds are listed (coordinator and Venue Staff), an EXPIRED hold shows "Expired on …" and no Convert/Release/Place actions. Tests first. Web suite, typecheck, eslint. Commit `feat(l6): change a hold's expiry and show expired holds`.

### Task 8: Traceability, changelog, PR, results

- `sprint-3.csv` L6 rows (exact test names). CHANGELOG at the top, including: run `npm run migrate -- venue` (0013–0014) before deploying planning-core; deploy the notification service with it; restart the worker; run `npm run jobs:schedule-hold-expiries` once after deploying. Root gate; push; PR against `main` with the card table and those notes; Claude Code line last. When CI is green, record the card results (L6-T12 Not Executed until the shared DB is migrated).
