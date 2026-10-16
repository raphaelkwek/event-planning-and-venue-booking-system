# Q2 — Release an equipment reservation (SPM-51): design

**Date:** 2026-10-16 · **Author:** Raphael, via Claude · **Sprint:** 3 ·
**Branch:** `feature-raphael/q2-release-reservation`, stacked on `feature-raphael/q1-reserve-equipment`
(PR #42) because it needs Q1's `equipment.reservations`; retarget to `main` once #42 merges.

## 1. The story

As a Technical Support Staff member, I want reservations to be released when they are no longer
needed, so that the equipment can be used by other events.

| # | Acceptance criterion |
|---|---|
| AC1 | A reservation is released when Technical Support release it with a reason, when its request line is cancelled, or when the event is cancelled, as part of the release run in F4. |
| AC2 | On release the reserved quantity returns to the available quantity for the corresponding period. |
| AC3 | The reservation record is retained with status Released and records the releasing user, timestamp, and reason; it is not deleted. |
| AC4 | Releasing a reservation that is already Released changes no quantity and writes no second release timestamp. |
| AC5 | The assigned coordinator receives a notification when a reservation for their event is released. |

## 2. Decisions (confirmed with Raphael, 2026-10-16)

1. **The line after a staff release** goes back to the status it had before it was reserved:
   Substituted when it carries a substitute (O2 clears the substitute columns for every other
   status, so their presence is exact), Confirmed otherwise. It can be reserved again.
2. **Line cancellation** is O1's removal, now also allowed on a Reserved line by the assigned
   coordinator; it releases the reservation (reason "Request line removed") and removes the line in
   one transaction. Other statuses keep O1's rule.
3. **F4** is not built. `releaseEventReservations(tx, eventId, actor, reason)` is exported from
   `equipment/index.ts` for F4's cancellation transaction; its card stays Not Executed until F4.
4. **Notification:** every release — including the coordinator's own removal — sends O2's existing
   `equipment-request.line-status-changed` message to the assigned coordinator, with the release
   reason in `reason` and a new optional `released: true` flag. The notification service words a
   released message as a release ("The reservation of Chairs × 4 for EVT-… was released. The line
   is now Confirmed. Reason: …"); every other message reads as before.
5. **Screens:** a Release action on "Equipment requests"; Remove on the coordinator's Reserved lines.
   No line-history view is added (history stays readable through `GET /request-lines/{id}`).

## 3. Data — migration `equipment/0007_reservation_release.sql`

```sql
alter table equipment.reservations
  add column released_by    uuid,
  add column released_at    timestamptz,
  add column release_reason text;

alter table equipment.reservations
  add constraint reservations_release_recorded check (
    (status = 'RESERVED' and released_by is null and released_at is null and release_reason is null)
    or (status = 'RELEASED' and released_by is not null and released_at is not null
        and release_reason is not null and length(btrim(release_reason)) > 0)
  ) not valid;
```

The check is validated in `0008_validate_reservation_release.sql`, in its own transaction (as
0005/0006 and event 0007/0008). Every existing row is RESERVED with null release columns.

## 4. Operations (equipment module)

- **`releaseReservation(tx, reservationId, actor, reason)`** (repo, exported: O1's removal uses it): locks the reservation
  row; if already RELEASED returns `ALREADY_RELEASED` and writes nothing (AC4); otherwise sets
  RELEASED with `released_by`, `released_at = clock_timestamp()`, `release_reason`, and sets the
  `unit_reservations` / `bulk_reservations` rows with that `reservation_id` to `RELEASED`, so
  availability (which counts only RESERVED rows) gets the quantity back at once (AC2). Never deletes
  (AC3).
- **`releaseLine(tx, lineId, reason, actor)`**: lock the line; not RESERVED → `LINE_NOT_RELEASABLE`
  with the status; find its active reservation; `releaseReservation`; set the line to the status
  from decision 1 with `status_changed_by/at`; history `STATUS_CHANGED` RESERVED → that status with
  `details { reservationId, released: true, reason }`.
- **O1 removal of a Reserved line**: in the existing removal transaction, after locking the line,
  if it is RESERVED call `releaseReservation(…, "Request line removed")` before `markRemoved`.
- **`releaseEventReservations(tx, eventId, actor, reason)`**: for each RESERVED line of the event,
  in `seq` order, `releaseLine`. Returns the released outcomes (reservation, line, previous) so F4 can write the notices.
- **Pure rules** (`domain/reservations.ts`): `validateReleaseBody` (reason required, trimmed, at most
  O2's `MAX_REASON_LENGTH`) and `statusAfterRelease(line)` (decision 1).

**Locks:** line, then reservation. Releasing never takes the type lock (it only frees stock, so it
cannot oversell), so it cannot deadlock with Q1's line → type order.

## 5. API

`POST /api/v1/equipment/request-lines/{id}/release`, Technical Support only (`authenticate`,
`requireRole(TECH_SUPPORT)`, the module's limiter). Body `{ "reason": string }`.

| Case | Response |
|---|---|
| Released | 200 `{ reservation, line }` |
| Reason missing / blank / too long | 400 `VALIDATION_FAILED` on `reason` |
| Line not Reserved | 409 `LINE_NOT_RELEASABLE`, naming the status, `details.status` |
| Reservation found already released (a concurrent release won) | 409 `RESERVATION_ALREADY_RELEASED` |
| Unknown line / event not visible | 404, as O2 |
| Not Technical Support | 403 |

Each successful release writes the coordinator's outbox message in the same transaction. O1's
removal route is unchanged in shape; it now accepts Reserved lines. Contracts and OpenAPI gain
`LINE_NOT_RELEASABLE` and `RESERVATION_ALREADY_RELEASED`, the route, and `releasedBy`, `releasedAt`,
`releaseReason` on `Reservation`.

## 6. Screens

- **Equipment requests (Technical Support):** Reserved rows get **Release** (aria-label
  "Release <type> for <ref>"), opening an inline form with a required Reason and "Release
  reservation". Refusals inline; success banner "Equipment released"; the row returns to
  Confirmed/Substituted with Reserve available again.
- **Equipment request (coordinator):** Reserved lines get **Remove**; the dialog says "Remove this
  line? Its reserved equipment will be released."

## 7. Tests

Cards in `tests/Q2/`, written before the code, with fixture **FX-Q2** = FX-Q1 plus a CHAIRS line ×4
already Reserved through Q1's API (6 left). Each card but T12 and T13 has a named test in
`tests/equipment/api/q2Cards.test.ts`; T6 is in `tests/race/invariants.test.ts`.

| Card | AC | Case |
|---|---|---|
| Q2-T1 | 1, 2, 3 | TS releases with a reason: 200; reservation Released with releasedBy TS, releasedAt around the request, the reason; record still there; line Confirmed; CHAIRS availability 10 |
| Q2-T2 | 2 | Serialized P-01, P-02 reserved then released: both free, availability 3 |
| Q2-T3 | 1 | A Substituted line's reservation released: line back to Substituted, the substitute's stock freed |
| Q2-T4 | 1 | Reason missing, empty, whitespace: 400 on `reason`, nothing changes |
| Q2-T5 | 4 | Release twice: second `LINE_NOT_RELEASABLE`; `released_at` and availability unchanged |
| Q2-T6 | 4 | Race: two simultaneous releases of one reservation; exactly one succeeds, one `released_at`, one history entry (CI only) |
| Q2-T7 | 1 | Submitted, Under Review, Confirmed, Unavailable, Substituted, Removed: each `LINE_NOT_RELEASABLE`, naming the status |
| Q2-T8 | 1, 2, 3 | Coordinator removes a Reserved line: line Removed; reservation Released by C1, reason "Request line removed"; availability 10 |
| Q2-T9 | 5 | C1 gets one notification naming the event, the equipment and the reason, after a TS release and after a coordinator removal |
| Q2-T10 | — | Other roles 403 on release; unknown line 404 |
| Q2-T11 | 1, 2 | After release the line can be reserved again |
| Q2-T12 | 1 | F4: cancelling the event releases all its reservations — Not Executed until F4; `releaseEventReservations` has a repo test now |
| Q2-T13 | all | Browser walkthrough (manual) |

Also: domain unit tests at 100% for `validateReleaseBody` and `statusAfterRelease`; repo tests for
the three operations; web tests for the Release form and the coordinator's Remove on Reserved
lines; `sprint-3.csv` rows.

## 8. Out of scope

F4 itself, partial releases, a line-history view, and notifying Technical Support.

**F4 hand-off.** `releaseEventReservations` reads the event's RESERVED lines without locking the
event, so a Q1 reservation committed during F4's cancellation can be missed. F4 must close that gap,
for example by having Q1 refuse for a cancelled event under a lock that conflicts with F4's event
lock (`FOR SHARE` on the event row, through the event module's `index.ts`), or by re-running the
release until none remain.
