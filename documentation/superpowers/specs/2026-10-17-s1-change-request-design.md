# S1 — Request a change after submission (SPM-57): design

**Date:** 2026-10-17 · **Author:** Raphael, via Claude · **Sprint:** 3 · **Branch:** `feature-raphael/s1-change-request` (from `main`)

## 1. The story

As an Event Organiser, I want to request a change to my submitted event, so that it can reflect new
circumstances without me starting again.

| # | Acceptance criterion |
|---|---|
| AC1 | A change request can be raised by the owning organiser for events with status Submitted or later, excluding Completed, Cancelled, and Rejected. |
| AC2 | The request records the field or fields to change, the proposed new value of each, a mandatory reason, the requesting organiser, and the timestamp. |
| AC3 | A snapshot of the current value of each affected field is stored with the request. |
| AC4 | The event's own field values are unchanged while the request is Pending. |
| AC5 | A second pending change request for the same event is refused, naming the existing pending request. |
| AC6 | The assigned coordinator receives a notification identifying the event and the fields proposed for change. |
| AC7 | A refused request stores nothing and changes no event field. |

## 2. Decisions (confirmed with Raphael, 2026-10-17)

1. **Fields:** only the six significant fields in contracts' `SIGNIFICANT_EVENT_FIELDS`
   (`proposedStartAt`, `proposedEndAt`, `expectedAttendance`, `venueRequirements`,
   `equipmentRequired`, `equipmentRequirements`) — exactly what G1 refuses with
   `CHANGE_REQUEST_REQUIRED`. Descriptive fields stay G1's.
2. **Validation:** B2's `validateSubmission` on the event as it would be after the change (the
   proposed values over the current ones), plus the event API's own shapes for the two requirements
   fields. The event module owns these rules; the change module asks through `event/index.ts`.
3. **Topic:** `change-request.*` messages go on the existing event topic (`KAFKA_TOPICS.event`),
   keyed by the event id: no new topic on the shared cluster, the notification service already
   consumes it, and every message about one event stays in order for S2.
4. **Screens:** "Request a change" on the organiser's request page; a pending notice there and on the
   coordinator's review page.

## 3. Data — migration `change/0001_change_requests.sql`

- `change.change_requests`: `id`, `event_id` (no cross-schema FK), `event_reference`,
  `requested_by`, `requested_at` (`clock_timestamp()`), `reason` (not blank), `status`
  (`PENDING | APPROVED | REJECTED`, default PENDING), audit columns. S2 adds its decision columns.
- Partial unique index on `event_id` where `status = 'PENDING'` (AC5).
- `change.change_request_fields`: `request_id` → change_requests, `field_name` (check: one of the
  six), `current_value jsonb` (the snapshot, AC3), `proposed_value jsonb`, unique (`request_id`,
  `field_name`).
- `change.outbox`, the module's outbox, in the same shape as the event and equipment outboxes, added
  to planning-core's relay tables.

## 4. Operations

- **Event module (`event/index.ts`):**
  - `findEventForChange(sql, eventId, scope, callerId)` → `{ id, reference, name, status, ownerId,
    assignedCoordinatorId, values: { the six fields } } | null` (null outside A3 scope).
  - `checkProposedChange(event, changes, now?)` → `FieldError[]`: `validateSubmission` over the
    merged event, keeping only errors on the proposed fields and on fields they affect (an end before
    the current start reports on `proposedEndAt`), plus the requirements shapes.
- **Change module:** `requestChange(tx, event, body, actor)`:
  1. Status allowed (AC1): Submitted, Under Review, Awaiting Clarification, Approved, Planning,
     Safety Review, Confirmed. Otherwise `EVENT_NOT_CHANGEABLE` with the status.
  2. Body: reason required (trimmed, ≤ 1000), `changes` a non-empty object whose keys are all among
     the six; then `checkProposedChange`. Any error → `VALIDATION_FAILED`, nothing stored (AC7).
  3. Insert the request and one field row per change, `current_value` from the event (AC3). A unique
     violation on the pending index → `CHANGE_REQUEST_ALREADY_PENDING` with the existing request
     (AC5); the savepoint keeps the transaction usable to read it.
  4. Outbox `change-request.submitted` on the event topic: event id, reference, name, coordinator id,
     request id, field names (AC6). Skipped when the event has no assigned coordinator.
  The event's own row is never written (AC4).

## 5. API

| Route | Who | Responses |
|---|---|---|
| `POST /api/v1/events/{id}/change-requests` | Event Organiser who owns the event | 201 the request (id, status, reason, requestedBy/At, fields with current and proposed values) · 400 `VALIDATION_FAILED` · 409 `EVENT_NOT_CHANGEABLE` · 409 `CHANGE_REQUEST_ALREADY_PENDING` (details: id, requestedAt, fields) · 403 not the owner / not an organiser · 404 outside scope |
| `GET /api/v1/events/{id}/change-requests` | Anyone whose A3 scope covers the event | 200 `{ items }`, newest first · 404 outside scope |

Contracts gains `EVENT_NOT_CHANGEABLE`, `CHANGE_REQUEST_ALREADY_PENDING` (also in the OpenAPI enum,
which a unit test holds equal), and the `change-request.submitted` type and payload schema. The
notification service gains one rule: the coordinator reads "A change has been requested for
EVT-… "<name>": start, expected attendance." (field labels as on the form).

## 6. Screens

- **Organiser's request page:** "Request a change", shown in the allowed statuses when nothing is
  pending. The form has the six fields prefilled with current values and a required Reason; only
  changed fields are sent; an unchanged form says so without calling the server; refusals inline per
  field. A pending request shows "Change requested on <date>: <fields> (Pending)".
- **Coordinator's review page:** the same pending notice (S2 adds Approve and Reject there).

## 7. Tests

Cards in `tests/S1/`, fixture **FX-S1**: E1 owned by ORG, Approved, coordinator C1, `D 14:00–18:00`,
attendance 150; actors ORG, ORG2, C1, TS, VS. Each card but T13 has a named test in
`tests/change/api/s1Cards.test.ts`.

| Card | AC | Case |
|---|---|---|
| S1-T1 | 2, 3, 4 | Start → `D 15:00`, attendance → 180, with a reason: 201 Pending with snapshots (`D 14:00`, 150), proposed values, requester, time; E1 unchanged |
| S1-T2 | 1 | Submitted, Under Review, Awaiting Clarification, Approved, Planning, Safety Review, Confirmed each accept |
| S1-T3 | 1, 7 | Draft, Completed, Cancelled, Rejected each `EVENT_NOT_CHANGEABLE`, naming the status; nothing stored |
| S1-T4 | 5, 7 | A second request while one is pending: `CHANGE_REQUEST_ALREADY_PENDING` naming the first; nothing stored |
| S1-T5 | 2, 7 | Missing or blank reason refused on `reason`; nothing stored |
| S1-T6 | 7 | Start in the past, end before start, end before the current start, attendance 0 and 2.5: each refused on its field, every failing field named |
| S1-T7 | 2, 7 | A field outside the six (`purpose`), and empty `changes`: refused |
| S1-T8 | — | Boundaries accepted: attendance 1; start one minute in the future |
| S1-T9 | 6 | C1 gets one notification naming E1's reference and the proposed fields |
| S1-T10 | 1 | ORG2, C1, TS, VS refused; unknown event 404 |
| S1-T11 | 3, 4 | `GET …/change-requests` shows the pending request with snapshots; the event read still shows the old values |
| S1-T12 | — | Venue and equipment requirements: a valid shape accepted, a malformed one refused on its field |
| S1-T13 | all | Browser walkthrough (manual) |

Also: domain unit tests at 100%; repo tests for `requestChange` including the database refusing a
second pending request; a race in `tests/race/` (two simultaneous requests, exactly one recorded);
notification-service tests for the new rule; web tests; `sprint-3.csv` rows.

## 8. Out of scope

Deciding a request (S2), withdrawing one, changing descriptive fields, and S3's flagging of affected
arrangements.
