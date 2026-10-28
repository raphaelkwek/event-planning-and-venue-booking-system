# S3 — Reconsider Arrangements Affected by an Approved Change: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Approving a significant change flags each confirmed booking and reservation it affects (Requires Reconfirmation, Unsuitable, Flagged for review), returns a Confirmed event to Planning, shows the flags, blocks F5 on them and notifies Venue Staff and Technical Support — all in the approval's transaction (SPM-59).

**Architecture:** A pure `assessChangeImpact` in the change module decides the flags from the event's values before and after and its live arrangements (G2 will reuse it). `decideChangeRequest` (S2) applies the result inside its transaction through new functions on the venue and equipment `index.ts`, applies `RECONSIDER_AFTER_CHANGE` through `transitionEvent` for a Confirmed event, and writes `change-request.arrangements-flagged`.

**Tech Stack:** TypeScript, Express, porsager `postgres`, KafkaJS outbox, React + Atlaskit, Vitest.

**Spec:** `documentation/superpowers/specs/2026-10-28-s3-change-impact-design.md`. **Branch:** `feature-raphael/s3-change-impact` (from `main`).

---

## Ground rules for every task

- Read `CLAUDE.md`, `documentation/planning/implementation.md`, the spec. `PC` = `backend/services/planning-core`.
- **Never** run migrations or writes against the shared DB, never read `.env`. DB tests run only in CI.
- Before each commit, at the repo root: `export DATABASE_URL=postgres://ci:ci@127.0.0.1:1/ci_unused SUPABASE_URL=https://ci.invalid SUPABASE_ANON_KEY=ci-placeholder SUPABASE_JWKS_URL=https://ci.invalid/auth/v1/.well-known/jwks.json`, then `npm run lint && npm run typecheck && npm run test:unit` (every workspace, with coverage, 100% on domain). Type-check new DB test files ad hoc with a temporary tsconfig and delete it.
- Conventional Commits ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Stage only your files.
- jsonb parameters: `${JSON.stringify(v)}::text::jsonb`, never `${…}::jsonb`.
- A module touches only its own schema; cross-module calls go through `index.ts`.
- Patterns to copy: S2's `PC/src/modules/change/repo/decisions.ts` and `tests/change/api/s2Cards.test.ts`; F5's `change/domain/readiness.ts`, `change/repo/confirmArrangements.ts`; I2's `requires_reconfirmation` writes in `venue/repo/unavailability.ts`; migrations with `NOT VALID` + a validate migration, squawk-clean.

## Tasks

### Task 1: Cards (`tests/S3/`)

One card per row of spec §5 in `tests/TEMPLATE.md`'s format, fixture FX-S3 described once in `tests/S3/README.md`, all marked Not Executed. Add the S3 rows to `documentation/traceability/sprint-4.csv` . Commit `test(s3): functional test cards, before the code`.

### Task 2: Pure assessment — `PC/src/modules/change/domain/changeImpact.ts`

Types:

```ts
export type ImpactFlag = "REQUIRES_RECONFIRMATION" | "UNSUITABLE" | "FLAGGED_FOR_REVIEW";
export interface ImpactBooking { id: string; reference: string; venueId: string; venueName: string; startsAt: string; endsAt: string; layout: string | null; layoutCapacity: number; staffIds: string[] }
export interface ImpactReservation { id: string; lineId: string; equipmentTypeName: string; reservedQuantity: number; startsAt: string; endsAt: string; reservedBy: string }
export interface ImpactValues { proposedStartAt: string; proposedEndAt: string; expectedAttendance: number }
export interface BookingFlag { bookingId: string; flag: "REQUIRES_RECONFIRMATION" | "UNSUITABLE"; reason: string; details: Record<string, unknown> }
export interface ReservationFlag { reservationId: string; flag: "FLAGGED_FOR_REVIEW"; reason: string; details: Record<string, unknown> }
export interface ChangeImpact { bookings: ImpactBooking[]; reservations: ImpactReservation[]; activeRegistrations: number; bookingFlags: BookingFlag[]; reservationFlags: ReservationFlag[] }
export function assessChangeImpact(input: { bookings: ImpactBooking[]; reservations: ImpactReservation[]; after: ImpactValues; changedFields: readonly SignificantEventField[] }): ChangeImpact
```

Rules (spec §3.3): time changed (`proposedStartAt` or `proposedEndAt` in `changedFields`) → every booking/reservation whose `startsAt`/`endsAt` (compare as instants, `Date.parse`) differ from `after` gets the period flag, reason `"The booking is for <period>, but the event is now <period>."` / `"The reservation is for …"` (use the notification service's Singapore-time `period()` wording; copy the formatter into domain if it is not exported from contracts), details `{ bookedStartsAt, bookedEndsAt, eventStartsAt, eventEndsAt }`. Attendance changed → booking with `layoutCapacity < after.expectedAttendance` gets `UNSUITABLE`, reason `"Expected attendance is now <n>, but <venue> holds <cap> in the <layout> layout."` (`"…holds <cap>."` when layout null), details `{ expectedAttendance, capacity, layout }`. Order: bookings in input order, then reservations. `activeRegistrations` is always 0 (comment: until EN-13). Unit tests in `PC/tests/change/domain/changeImpact.unit.test.ts` cover each rule, both untouched-field cases, several venues (AC5), equal-instant strings in different offsets, and no flags. 100% coverage. Commit `feat(s3): assess which arrangements an approved change affects`.

### Task 3: Migrations and flag writers

- `PC/migrations/venue/0018_arrangement_flags.sql`: `alter table venue.venue_slots add column unsuitable boolean not null default false;` and `create table venue.arrangement_flags (id uuid pk default gen_random_uuid(), slot_id uuid not null references venue.venue_slots(id), event_id uuid not null, change_request_id uuid not null, flag text not null check (flag in ('REQUIRES_RECONFIRMATION','UNSUITABLE')), reason text not null check (length(btrim(reason)) > 0), details jsonb not null, flagged_at timestamptz not null default now())` with an index on `(event_id)`. No validate migration needed (new table, default column).
- `PC/migrations/equipment/0009_reservation_flags.sql`: `reservations.flagged_for_review boolean not null default false` and `equipment.reservation_flags` (same shape, `reservation_id` references `equipment.reservations`, flag only `FLAGGED_FOR_REVIEW`).
- Squawk both, as the previous migrations were (see CI's migration lint step in `.github/workflows`).
- Venue repo `PC/src/modules/venue/repo/arrangementFlags.ts`:
  - `bookingsForImpact(tx, eventId): Promise<ImpactBookingRow[]>` — CONFIRMED slots of the event `for update of s`, venue name, staff ids (as `eventArrangements.ts`), the layout from `booking_requests where booking_id = s.id` (null if none), and its capacity from `venues.layouts` (`jsonb_array_elements`, match on name) else `max_capacity`.
  - `flagBookings(tx, eventId, changeRequestId, flags: BookingFlag[])` — per flag: set `requires_reconfirmation = true` or `unsuitable = true`, `updated_at = now()`; insert an `arrangement_flags` row.
  - `outstandingBookingFlags(tx, eventId)` — rows for HELD/CONFIRMED slots still carrying the boolean, newest first: `{ reference, venueName, flag, reason, flaggedAt }`.
  - Export all three from `venue/index.ts` (with the row type, structurally equal to `ImpactBooking`; the change module maps it).
- Equipment repo `PC/src/modules/equipment/repo/reservationFlags.ts`: `reservationsForImpact` (RESERVED reservations of the event `for update`, type name, line id, reserved quantity, period, reserved_by), `flagReservations`, `outstandingReservationFlags`. Export from `equipment/index.ts`.
- F5 (AC9): `venueArrangementsForEvent` adds `"UNSUITABLE"` when `s.unsuitable` (widen `VenueArrangementFlag`); `equipmentArrangementsForEvent` returns `flags: ["FLAGGED_FOR_REVIEW"]` on a line whose active reservation has `flagged_for_review`; `confirmArrangements.ts` passes them to `ReadinessLine.flags`. Update the comments that say "S3 will…".
- DB tests (CI only) in `PC/tests/venue/repo/arrangementFlags.test.ts` and `PC/tests/equipment/repo/reservationFlags.test.ts`: layout capacity lookup, fallback to max capacity, flags set both column and row, outstanding read, F5 read returns the new flags. Commit `feat(s3): store arrangement flags and show them to F5`.

### Task 4: Apply on approval

- `event/domain/statusMachine.ts`: add `"RECONSIDER_AFTER_CHANGE"` to `EventAction` and `RECONSIDER_AFTER_CHANGE: { from: ["CONFIRMED"], to: "PLANNING" }` with a comment citing W9-22. Extend the status machine unit tests. Export what the change module needs to apply it from `event/index.ts` (`transitionEvent` is in `event/api/transitionEvent.ts`; export it, or a wrapper `returnToPlanningAfterChange(tx, eventId, actor)`, from the index).
- `change/repo/changeImpact.ts`: `flagArrangementsForChange(tx, event, changeRequestId, changes, actor): Promise<ChangeImpact>` — read bookings and reservations through the indexes, call `assessChangeImpact` with `after` = the event's values after the change and `changedFields` = keys of `changes`, write flags through the indexes; if the event's status was `CONFIRMED`, apply `RECONSIDER_AFTER_CHANGE`; if any flag was set, `writeOutbox` `change-request.arrangements-flagged` on `KAFKA_TOPICS.event` with `{ eventId, eventReference, eventName, changeRequestId, bookings: [{ reference, venueName, flag, reason, staffIds }], reservations: [{ equipmentTypeName, flag, reason, reservedBy }], returnedToPlanning }`.
- `decideChangeRequest`: on APPROVE call it after `applyApprovedChange`, before `recordDecision`; return `impact` in the outcome; the decision route puts it in the 200 body as `impact: { bookings, reservations, activeRegistrations, flags: [{ arrangement: "BOOKING"|"EQUIPMENT", id, reference, name, flag, reason }] }` (bookingFlags then reservationFlags, mapped; the shape the S3 cards use). A thrown error rolls everything back (AC11) — the route's existing error handling returns 500 and nothing is committed; add a test that stubs the venue flag writer to throw.
- Contracts (`backend/packages/contracts/src/changeRequestEvents.ts`): the payload schema for `change-request.arrangements-flagged`, with valid/missing-field tests. OpenAPI: the `impact` object on the decision response.
- Commit `feat(s3): flag affected arrangements when a change is approved`.

### Task 5: Read route and notifications

- `change/api/arrangementFlags.ts`: `GET /api/v1/events/:id/arrangement-flags` — role scope as S1's read (`findEventForChange` with the caller's scope → 404 when not visible; organiser only their own, coordinator only assigned, Event Coordinators all); returns `{ flags: [{ arrangement: "BOOKING"|"EQUIPMENT", reference, name, flag, reason, flaggedAt }] }`. Register in `changeRouter`; OpenAPI path.
- Notification service: register the message in `MESSAGE_DATA_SCHEMAS`; rules in `recipients.ts`: each booking's `staffIds` → `"Booking <reference> at <venue> for <event> needs attention after an approved change: <reason>"`; each reservation's `reservedBy` → `"Reservation of <type> for <event> is flagged for review after an approved change: <reason> Release it if it is no longer needed."`. One notice per recipient per arrangement. Tests assert full sentences; 100% coverage.
- Commit `feat(s3): show outstanding flags and notify the staff concerned`.

### Task 6: Card tests

`PC/tests/change/api/s3Cards.test.ts` modelled on `s2Cards.test.ts`: build FX-S3 through the real routes where they exist (or the repo fixtures S2's tests use for confirmed bookings and reservations), one `it("S3-Tn …")` per card T1–T12. Commit `test(s3): a test per card`.

### Task 7: Screens

- Coordinator's change-request decision screen: after Approve, show the impact list ("Affected arrangements": each booking/reservation with its flag and reason, "Registrations: 0").
- Event page: an "Outstanding flags" section for owner, coordinator and Event Coordinators, from the new route; hidden when empty.
- Tests first (web suite, as S2's screen tests). Typecheck, eslint. Commit `feat(s3): show affected arrangements and outstanding flags`.

### Task 8: Traceability, changelog, PR, results

`sprint-4.csv` rows with exact test names. CHANGELOG at the top: run `npm run migrate -- venue` (0018) and `npm run migrate -- equipment` (0009) before deploying planning-core; deploy the notification service with it. Root gate; push; PR against `main` with the card table; Claude Code line last. When CI is green, record card results (S3-T13 Not Executed until the shared DB is migrated).
