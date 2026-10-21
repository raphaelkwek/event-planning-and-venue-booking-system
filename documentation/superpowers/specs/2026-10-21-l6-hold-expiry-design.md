# L6 — Tentative holds expire (SPM-182, CR-04): design

**Date:** 2026-10-21 · **Author:** Raphael, via Claude · **Sprint:** 3 · **Branch:** `feature-raphael/l6-hold-expiry` (from `main`)

## 1. The story

As a Venue Staff member, I want tentative holds to expire, so that a venue is not reserved
indefinitely by a hold nobody acts on.

| # | Acceptance criterion |
|---|---|
| AC1 | Every hold records an expiry date and time, later than the moment it is placed; a hold without a valid expiry is refused and stores nothing. Who sets the expiry, and any default or maximum, follows CQ-06. |
| AC2 | When the expiry passes before the hold is converted (L1) or released, its status becomes Expired, the record is kept, and the period becomes available to other holds and requests. |
| AC3 | An expired hold is never treated as a booking: it blocks no period, cannot be converted, and does not count towards confirmation (F5). |
| AC4 | The holding coordinator is notified before the hold expires (how long before is CQ-06) and again when it expires, naming the venue, period, event, and expiry time. |
| AC5 | A hold expires at its expiry time whether or not anyone is using the system. |

**CQ-06 (Week 9 answer):** Venue Staff of the venue place a requested hold and **set and update** its
expiry; the coordinator sets, per hold, how long before expiry to be reminded. No default or maximum.

## 2. What already exists (L3, EN-11, F5)

- `venue.holds` (migration 0012) stores `expires_at` (required when placed, later than placement —
  L3's `readPlacement`) and `reminder_lead_minutes` (≥ 1); its status list already has `EXPIRED`.
  AC1 is L3's and stays covered by L3's tests; L6 re-runs them unchanged.
- `venue.venue_slots` allows `EXPIRED`, and `venue_slot_no_overlap` only counts HELD/CONFIRMED, so an
  expired slot blocks nothing.
- L3 refuses converting a HELD hold past its expiry (`hasExpired`, stopgap until L6).
- F5's readiness counts only HELD/CONFIRMED arrangements.
- EN-11: the Temporal worker (`src/temporal/worker.ts`), the `completeEvent` timer workflow and its
  pattern — outbox message → Kafka consumer → `signalWithStart` a workflow per aggregate → the
  workflow waits, then an activity asks the database whether the work is due.

## 3. Decisions (Claude's recommendations, taken per Raphael's standing preference)

1. **Mechanism:** a Temporal `holdExpiry` workflow per placed hold (ticket design, ADR-0009).
   Placing a hold writes `venue-booking.hold-placed` to the venue outbox; a consumer on the
   venue-booking topic `signalWithStart`s the workflow (id `hold-expiry-<holdId>`).
2. **Reminder:** at `expires_at − reminder_lead_minutes`; if that moment has passed when the hold is
   placed, at once. At most once per expiry: `reminded_at` records it, and a new expiry clears it.
3. **Expiry:** the activity `expireHoldIfDue` decides under a lock: HELD and `expires_at <= now()` →
   hold and slot EXPIRED (`expired_at`), outbox `venue-booking.hold-expired`; HELD but not yet due
   (expiry moved) → returns the new expiry and the workflow waits again; any other status → stop.
4. **Extension:** `PATCH /api/v1/holds/{id}/expiry` `{ expiresAt }`, Venue Staff who look after the
   venue, HELD holds only, new expiry later than now. Clears `reminded_at`; outbox
   `venue-booking.hold-expiry-changed`, which the consumer turns into a reschedule signal.
5. **Notices** to the holding coordinator (`requested_by`): reminder and expired, each naming the
   venue, period, event reference and name, and the expiry time (Singapore time, as L1's notices).
6. **Backfill:** `npm run jobs:schedule-hold-expiries` starts workflows for every HELD hold
   (idempotent, `signalWithStart`), for holds placed before L6 is deployed. Deploy the notification
   service before or with planning-core and restart the Temporal worker first, and run the backfill
   only after the worker logs "hold-expiry consumer started": the new consumer group starts from the
   latest offset, so `hold-placed` messages published before it joined are caught only by the
   backfill. The backfill may send reminder or expired notices at once for holds already close to or
   past their expiry.

## 4. Data — migration `venue/0014_hold_expiry.sql`

Adds `reminded_at timestamptz`, `expired_at timestamptz`, and a check `NOT VALID` (validated in
0014): `status = 'EXPIRED'` ⇔ `expired_at is not null`.

## 5. Operations

- **Venue repo:** `remindHoldIfDue(tx, holdId, now?)` → `reminded | not-due(remindAt) | already | too-late | gone(status)` (`too-late`: the expiry has passed, so no reminder);
  `expireHoldIfDue(tx, holdId)` → `expired | not-due(expiresAt) | gone(status)`;
  `changeHoldExpiry(tx, hold, expiresAt, actor)`. Each takes the hold's row lock first (L3's `lockHold`).
- **Pure rules (`domain/holdExpiry.ts`):** `reminderAt(expiresAt, leadMinutes)`, `readExpiryChange(body, now)`.
- **Workflow (`src/temporal/workflows/holdExpiry.ts`):** wait until the reminder time → `remindHoldIfDue`;
  wait until the expiry → `expireHoldIfDue`; on `not-due` wait again; on `gone` stop. A
  `rescheduleSignal({ expiresAt })` resets both waits. Deterministic, with a replay test like EN-11's.
- **Consumer (`src/temporal/holdExpiryConsumer.ts`):** handles `hold-placed` and
  `hold-expiry-changed` on the venue-booking topic; run by the worker beside EN-11's consumer.

## 6. API, contracts, notifications

| Route | Who | Responses |
|---|---|---|
| `PATCH /api/v1/holds/{id}/expiry` | Venue Staff of the venue | 200 the hold · 400 `VALIDATION_FAILED` (missing, unparseable, not later than now) · 409 `HOLD_NOT_HELD` (not HELD) · 403 not Venue Staff · 404 `HOLD_NOT_FOUND` unknown hold, or another venue's (as L3's place route) |

Contracts: `venue-booking.hold-placed`, `hold-expiry-changed`, `hold-expiring`, `hold-expired` payloads.
Notification rules for `hold-expiring` and `hold-expired` → the holding coordinator.
Holds read by the API gain `remindedAt` and `expiredAt`. OpenAPI: the route and the fields.

## 7. Screens

Venue Staff's held holds get "Change expiry" (a datetime field and Save). Expired holds show
"Expired on …" wherever holds are listed, with no Convert or Release action.

## 8. Tests

Cards in `tests/L6/`, fixture **FX-L6**: venue V (Venue Staff VS), event E1 (Approved, coordinator C1),
hold H1 requested by C1 and placed by VS for `D 10:00–12:00`, expiring at a time the card gives, lead 60
minutes.

| Card | AC | Case |
|---|---|---|
| L6-T1 | 2 | H1 past its expiry: `expireHoldIfDue` → EXPIRED with `expired_at`, slot EXPIRED, record kept |
| L6-T2 | 2, 3 | After expiry another event's hold on the same period is placed (201) |
| L6-T3 | 3 | An expired hold can't be converted (409) or released (409); F5's readiness doesn't count it |
| L6-T4 | 2 | Boundary: one second before the expiry `expireHoldIfDue` → not-due, HELD |
| L6-T5 | 2 | A converted or released hold is never expired (gone) |
| L6-T6 | 4 | Reminder at expiry − lead: one `hold-expiring` notice to C1 naming venue, period, event, expiry; a second call sends nothing |
| L6-T7 | 4 | Expiry notice: one `hold-expired` notice to C1 naming the same |
| L6-T8 | 1 | VS changes the expiry to later: 200; `reminded_at` cleared; `hold-expiry-changed` message |
| L6-T9 | 1 | Expiry change refused: not later than now, unparseable, missing (400); not HELD (409); another venue's staff (404, as L3) |
| L6-T10 | 5 | Workflow (Temporal time-skipping test env or replay): reminder then expiry fire at their times with nobody calling the API; a reschedule moves both |
| L6-T11 | 1 | L3's placement rules still refuse a missing or past expiry (re-run L3's cards) |
| L6-T12 | all | Browser walkthrough (manual) |

## 9. Out of scope

A default or maximum expiry (CQ-06 sets none), notifying Venue Staff, and extending an Expired hold.
