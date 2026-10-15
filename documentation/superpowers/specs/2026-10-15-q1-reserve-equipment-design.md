# Q1 — Reserve equipment for an event (SPM-50): design

**Date:** 2026-10-15 · **Author:** Raphael, via Claude · **Sprint:** 3 · **Branch:** `feature-raphael/q1-reserve-equipment`

## 1. The story

As a Technical Support Staff member, I want to reserve equipment for an event, so that it is held for
that event and cannot be promised to another.

| # | Acceptance criterion |
|---|---|
| AC1 | A reservation records the event, equipment type, quantity reserved, start and end, the acting staff member and the timestamp; the linked request line's status becomes Reserved. |
| AC2 | The reservation is atomic with the availability check: two simultaneous reservations for overlapping periods with one unit left — exactly one succeeds. |
| AC3 | The unsuccessful attempt creates no reservation, changes no quantity, and names insufficient availability and the shortfall. |
| AC4 | After a reservation, the available quantity for any overlapping period drops by exactly the quantity reserved. |
| AC5 | A quantity below the requested one may be reserved only when explicitly chosen; the reservation records the quantity actually reserved. |
| AC6 | Reserving more than the available quantity is refused; no partial reservation is silently created. |

## 2. Decisions (confirmed with Raphael, 2026-10-15)

1. **Reservable lines:** only Confirmed and Substituted. Confirmed reserves the requested type and
   quantity; Substituted reserves O2's substitute type and quantity. Every other status is refused,
   naming it.
2. **Period:** always the line's own `required_from`–`required_to`. Technical Support enters no dates.
3. **Partial:** one reservation per line. The quantity defaults to the requested one; a lower one
   needs `"partial": true`; a higher one is refused. After a partial reservation the line is
   Reserved and the shortfall is accepted, not left open.
4. **Storage:** a new `equipment.reservations` row per reservation; the existing unit and bulk rows
   point at it.
5. **Screen:** a Reserve action on the existing "Equipment requests" screen (O2).
6. **Notification:** reserving is a line status change, so it sends O2's existing
   `equipment-request.line-status-changed` message to the assigned coordinator. Q1's criteria do not
   ask for it; it keeps "every status change notifies the coordinator" true.

## 3. What already exists (EN-02.2, O1, O2, P1, P2)

- `repo/inventory.ts`: `lockEquipmentType`, `peakUse`, `availableUnits`, `reserveBulk` (type lock,
  peak check, `InsufficientEquipmentError` with available and shortfall) and `reserveUnit` (per-unit
  exclusion constraint, `UnitAlreadyReservedError`). The race test in `tests/race/invariants.test.ts`
  already covers both. Nothing calls them from an API.
- `equipment_request_lines` with status `RESERVED` in its check; O2's `canChangeStatus` already
  refuses Reserved lines as "Q1's".
- The "Equipment requests" screen, O2's status route, `writeHistory`, `writeOutbox`.

## 4. Data — migration `equipment/0005_reservations.sql`

Additive only.

```sql
create table equipment.reservations (
  id                 uuid primary key default gen_random_uuid(),
  request_line_id    uuid        not null references equipment.equipment_request_lines (id),
  event_id           uuid        not null,          -- event module's; no FK across schemas
  event_reference    text        not null check (length(btrim(event_reference)) > 0),
  equipment_type_id  uuid        not null references equipment.equipment_types (id),
  kind               text        not null check (kind in ('BULK', 'SERIALIZED')),
  requested_quantity int         not null check (requested_quantity > 0),
  reserved_quantity  int         not null check (reserved_quantity > 0),
  starts_at          timestamptz not null,
  ends_at            timestamptz not null,
  status             text        not null default 'RESERVED' check (status in ('RESERVED', 'RELEASED')),
  reserved_by        uuid        not null,
  reserved_at        timestamptz not null default clock_timestamp(),
  created_at         timestamptz not null default now(),
  created_by         uuid,
  updated_at         timestamptz not null default now(),
  updated_by         uuid,
  constraint reservations_reserved_within_requested check (reserved_quantity <= requested_quantity),
  constraint reservations_ends_after_start check (ends_at > starts_at)
);
create unique index reservations_one_active_per_line
  on equipment.reservations (request_line_id) where (status = 'RESERVED');

alter table equipment.unit_reservations add column reservation_id uuid references equipment.reservations (id);
alter table equipment.bulk_reservations add column reservation_id uuid references equipment.reservations (id);
```

`reservation_id` is nullable: rows written by EN-02 tests and earlier have no parent. Released
columns (by, at, reason) are Q2's and are not added here. `kind` uses `0001`'s values.

## 5. The operation — `reserveLine`

`reserveLine(tx, lineId, { quantity?, partial }, actor)` in the equipment module, one transaction:

1. `lockLine`. Not Confirmed or Substituted → `LINE_NOT_RESERVABLE` with the current status.
2. Target: type and requested quantity from the line, or its substitute when Substituted. Period
   from the line.
3. Quantity rules (pure, `domain/reservations.ts`): absent → requested; above requested →
   validation error; below requested without `partial` → `PARTIAL_NOT_CONFIRMED`.
4. Reserve: bulk → `reserveBulk`; serialized → `lockEquipmentType`, `availableUnits`, first n by
   label, `reserveUnit` each. Too few → `InsufficientEquipmentError`; the transaction rolls back, so
   nothing is written.
5. Insert the `reservations` row; set `reservation_id` on the unit or bulk rows.
6. Line → `RESERVED` with `status_changed_by`/`_at`; history `STATUS_CHANGED` with
   `{ reservationId, requestedQuantity, reservedQuantity }` in `details`.
7. Outbox `equipment-request.line-status-changed` to the assigned coordinator, as O2 does.

**Lock order:** line, then type. O2 locks only lines and P2 only types, so nothing takes them the
other way round. The type lock serialises two reservations racing for the last unit (AC2); the
partial unique index stops two active reservations on one line.

## 6. API — `POST /api/v1/equipment/request-lines/{id}/reservation`

Technical Support only (`authenticate`, `requireRole(TECH_SUPPORT)`, the module's limiter). Body
`{ "quantity"?: int ≥ 1, "partial"?: boolean }`.

| Case | Response |
|---|---|
| Reserved | 201 — the reservation and the updated line |
| Malformed body | 400 `VALIDATION_FAILED` with fields |
| Quantity above requested | 400 `VALIDATION_FAILED` on `quantity` |
| Lower quantity without `partial` | 409 `PARTIAL_NOT_CONFIRMED` |
| Not enough stock | 409 `INSUFFICIENT_EQUIPMENT` with `available` and `shortfall` |
| Line not Confirmed/Substituted (incl. already Reserved) | 409 `LINE_NOT_RESERVABLE`, naming the status |
| Unknown line, or event not visible | 404, as O2 |
| Not Technical Support | 403 |

The OpenAPI file gains the route, a `Reservation` schema and the three codes; contracts gains the codes.

## 7. Screen

On "Equipment requests", Confirmed and Substituted rows get **Reserve** beside "Update": an inline
form with Quantity (prefilled), a "Reserve fewer than requested" checkbox shown only when the
quantity is lowered, and Reserve. Refusals show inline and leave the line unchanged. A Reserved row
shows "Reserved n of m", by whom and when; the coordinator's view shows the same.

## 8. Tests

Cards in `tests/Q1/`, written before the code, with `tests/Q1/README.md` describing the isolated
throwaway-Postgres setup and fixture FX-Q1 (event E1 Approved, coordinator C1, `D 14:00–18:00`;
CHAIRS bulk 10; PROJECTORS serialized P-01..P-03; actors TS, C1, ORG, VS). Each card except T14 has
a named test in `tests/equipment/api/q1Cards.test.ts`.

| Card | AC | Case |
|---|---|---|
| Q1-T1 | 1, 4 | Confirmed CHAIRS ×4: 201, every field recorded, line Reserved, overlapping availability down by exactly 4 |
| Q1-T2 | 1, 4 | Confirmed PROJECTORS ×2: two units under one reservation; 1 left |
| Q1-T3 | 1 | Substituted line reserves the substitute type and quantity |
| Q1-T4 | 6 | Exactly the available quantity: succeeds, 0 left |
| Q1-T5 | 3, 6 | One above available: `INSUFFICIENT_EQUIPMENT` with shortfall; nothing stored; line stays Confirmed |
| Q1-T6 | 5 | `partial: true` reserves 3 of 5 and records both |
| Q1-T7 | 5 | Lower quantity without `partial`: `PARTIAL_NOT_CONFIRMED`; nothing stored |
| Q1-T8 | 6 | Quantity above requested refused |
| Q1-T9 | 1 | Submitted, Under Review, Unavailable, Reserved, Removed each refused, naming the status |
| Q1-T10 | 1 | History entry and the coordinator's outbox message |
| Q1-T11 | — | Other roles 403; unknown line 404 |
| Q1-T12 | 1 | A reservation only touching another at its edge (`[)`) leaves availability unchanged |
| Q1-T13 | 2 | Race, bulk and serialized: one unit left, two overlapping attempts, exactly one succeeds — `tests/race/`, CI throwaway Postgres only |
| Q1-T14 | all | Browser walkthrough on "Equipment requests" (manual) |

Also: domain unit tests at 100% for the quantity rules; repo integration tests for `reserveLine`;
`documentation/traceability/sprint-3.csv` rows for every AC.

## 9. Out of scope

Releasing reservations (Q2, SPM-51), several reservations per line, staff-chosen periods, and any
notification beyond O2's existing message.
