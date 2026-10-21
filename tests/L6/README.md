# L6 — Tentative holds expire

Twelve cases, written from the story (SPM-182, CR-04) on 21 Oct 2026, before the code, following the design in
`documentation/superpowers/specs/2026-10-21-l6-hold-expiry-design.md` (section 8 is the card table). L6-T1 to L6-T9 are API- and
repository-level procedures (HTTP requests with authentication stubbed, and the venue repository's operations, against a migrated
throwaway Postgres), automated one test per card in `tests/venue/api/l6Cards.test.ts`. L6-T10 is the Temporal workflow, automated in
`tests/temporal/holdExpiry.unit.test.ts` with Temporal's time-skipping test environment. L6-T11 re-runs L3's existing cards and tests.
L6-T12 is the signed-in browser walk-through, done by hand.

| Acceptance criterion | Cases |
|---|---|
| AC1: every hold records an expiry later than the moment it is placed; a hold without a valid expiry is refused and stores nothing; Venue Staff of the venue set and update it (CQ-06) | L6-T8, L6-T9, L6-T11, L6-T12 |
| AC2: when the expiry passes before the hold is converted or released, its status becomes Expired, the record is kept, and the period becomes available | L6-T1, L6-T2, L6-T4, L6-T5, L6-T12 |
| AC3: an expired hold is never treated as a booking: it blocks no period, cannot be converted, and does not count towards confirmation (F5) | L6-T2, L6-T3, L6-T12 |
| AC4: the holding coordinator is notified before the hold expires and again when it expires, naming the venue, period, event and expiry time | L6-T6, L6-T7, L6-T12 |
| AC5: a hold expires at its expiry time whether or not anyone is using the system | L6-T10 |

Boundaries: one second before the expiry the hold is not due and exactly at the expiry it is (L6-T4); one second before the
reminder time nothing is sent and at it one reminder is (L6-T6); an expiry change to a time equal to now is refused (L6-T9).

## What L6 does not do

A default or maximum expiry (CQ-06 sets none), notifying Venue Staff, and extending an Expired hold. Requesting, placing, converting
and releasing a hold are L3's and are only used here as set-up.

## Why the cards are API-level and automated

As `tests/S1/README.md`: the behaviour is in the server (the status checks under a row lock, the slot status, the outbox messages),
so each card calls the real Express app or the real repository operations against a real migrated Postgres. L6-T10 shows the timing
(AC5), which no database test can do without waiting, by running the workflow in a time-skipping environment. The browser case
L6-T12 covers what those cards cannot: the "Change expiry" field, the "Expired on ..." label and the coordinator's notice.

## Messages and routes the cards use

- `PATCH /api/v1/holds/{id}/expiry` with `{ "expiresAt": "<ISO instant with offset>" }`, Venue Staff of the venue only: 200 the hold,
  400 `VALIDATION_FAILED` (missing, unparseable, not later than now), 409 `HOLD_NOT_HELD`, 403 `ROLE_NOT_AUTHORISED`, 404 `HOLD_NOT_FOUND`.
- L3's routes `POST /api/v1/holds/{id}/place`, `/convert` and `/release`; a convert or release of an Expired hold answers 409 `HOLD_NOT_HELD`.
- Venue outbox messages: `venue-booking.hold-placed`, `venue-booking.hold-expiring`, `venue-booking.hold-expired`,
  `venue-booking.hold-expiry-changed`.
- Repository operations: `remindHoldIfDue(tx, holdId, now?)` returns `reminded`, `not-due` (with `remindAt`), `already` or `gone` (with status);
  `expireHoldIfDue(tx, holdId)` returns `expired`, `not-due` (with `expiresAt`) or `gone` (with status).

## Fixture FX-L6 (API level)

- Actors: VS (Venue Staff, looks after V), VS2 (Venue Staff, looks after V2 only), C1 (Event Coordinator, assigned to E1), C2 (Event
  Coordinator, assigned to E2).
- Venue V is `Lee Kong Chian Auditorium`; V2 is another venue VS does not look after.
- Event E1: Approved, owned by ORG, assigned to C1, named `Annual Research Symposium`. Event E2 is the same kind of event assigned to C2.
  Further events in a card are "events like E1" with the coordinator the card names.
- Hold H1: requested by C1 for E1 at V, `D 10:00`-`D 12:00` UTC, reminder lead 60 minutes, placed by VS (so `HELD`, with a `HELD` slot), with
  the expiry the card gives. D is sixty days ahead, as `tests/support/eventDates.ts`; `D-1` is the day before D.
- Times in a card are written `D hh:mm` (UTC on day D). Notices show times in Singapore time (UTC+8), as L1's notices do, so H1's period
  appears as `D 18:00-20:00`.
- **The "due" step.** A hold cannot be placed with an expiry in the past, so a card that needs an expired hold places H1 normally and then
  moves `placed_at` and `expires_at` back two hours in the database (expiry one hour in the past, `placed_at` before it). The hold is
  still `HELD`.
- **Looking a hold up**, used by several cards:

~~~sql
select h.reference, h.status, h.requested_by, h.placed_by, h.expires_at, h.reminder_lead_minutes,
       h.reminded_at, h.expired_at, s.status as slot_status
from venue.holds h left join venue.venue_slots s on s.id = h.slot_id
where h.id = '<HOLD_ID>';
~~~

## Isolated automated setup and execution

A clean throwaway Postgres with every migration applied (including `venue/0013`), authentication stubbed: the signed-in user is
whichever actor a step names. Never the shared database (EN-06). Run one card with

`npm test -w @connectsphere/planning-core -- tests/venue/api/l6Cards.test.ts -t 'L6-Tn '`

(the trailing space matters, so `L6-T1 ` does not match `L6-T10 `). L6-T10 is the exception: it is in
`tests/temporal/holdExpiry.unit.test.ts` and uses Temporal's time-skipping test environment, which needs neither a database nor a
running Temporal server:

`npm test -w @connectsphere/planning-core -- tests/temporal/holdExpiry.unit.test.ts -t 'L6-T10 '`

L6-T11 points at L3's existing cards (`tests/L3/L3-T5-*.md`, `tests/L3/L3-T6-*.md`) and tests
(`tests/venue/api/holds.test.ts`, `tests/venue/domain/hold.test.ts`); L6 adds no test there. L6-T12 is done by hand in the app,
following `tests/README.md`; the `.env` needs the `KAFKA_*` settings, Temporal must be running (`npm run dev` starts the worker), and
migrations must be applied, including `venue/0013`. Integration cards fail locally until the team migrates the shared database after
merge; that is expected.
