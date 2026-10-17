# S2 — Review and decide a change request (SPM-58): design

**Date:** 2026-10-18 · **Author:** Raphael, via Claude · **Sprint:** 3 ·
**Branch:** `feature-raphael/s2-decide-change-request`, stacked on `feature-raphael/s1-change-request`
(PR #45); retarget to `main` once #45 merges.

## 1. The story

As an assigned Event Coordinator, I want to approve or reject a change request, so that only changes
ConnectSphere can support are applied.

| # | Acceptance criterion |
|---|---|
| AC1 | Only the assigned coordinator can decide the request, and only while its status is Pending. |
| AC2 | Rejection requires a reason; without it the request stays Pending, no decision timestamp is recorded, and no event field changes. |
| AC3 | On approval the event's fields are updated to the proposed values, and the event history records for each field the before value, the after value, the deciding coordinator, and the timestamp. |
| AC4 | On rejection no event field changes and the stored snapshot values remain the event's live values. |
| AC5 | The requesting organiser receives a notification of either outcome, including the rejection reason where applicable. |
| AC6 | A request that already carries a decision offers no further approve or reject action. |

## 2. Decisions (confirmed with Raphael, 2026-10-18)

1. **Approval re-checks everything under lock:** the request is still Pending, the caller is the
   event's assigned coordinator, the event is still in a changeable status (S1's list), and the
   proposed values still pass `checkProposedChange`. A failure refuses approval
   (`CHANGE_REQUEST_NO_LONGER_VALID`) and changes nothing; the coordinator can still reject.
2. **The history's "before" value** is the event's value at approval, read under the event lock. It
   equals the snapshot, since only S2 changes these fields and S1 allows one pending request.
3. **Approval bumps the event's `version`**, so a G1 edit based on the old version is refused (412).
4. **Messages** `change-request.approved` and `change-request.rejected` go on the event topic, as S1's.
5. **Screens:** Approve / Reject on the coordinator's review page while Pending; the outcome on the
   organiser's request page.

## 3. Data — migrations `change/0002`, `change/0003`

0002 adds `decided_by uuid`, `decided_at timestamptz`, `rejection_reason text` to
`change.change_requests` and a check, `NOT VALID`:

```
(status = 'PENDING'  and decided_by is null and decided_at is null and rejection_reason is null)
or (status = 'APPROVED' and decided_by is not null and decided_at is not null and rejection_reason is null)
or (status = 'REJECTED' and decided_by is not null and decided_at is not null
    and rejection_reason is not null and length(btrim(rejection_reason)) > 0)
```

0003 validates it in its own transaction.

## 4. Operations

- **Event module (`event/index.ts`):** `applyApprovedChange(tx, eventId, changes, actor)` — under
  the event lock taken by `findEventForChange(tx, …, { lock: true })` (upgraded to `for update` for
  this call, since it writes): update the six columns that appear in `changes`, `version = version
  + 1`, `updated_at/by`; `recordFieldChanges` with each field's before (locked live value) and
  after, the actor and the time. Values arrive as stored by S1 (instants already UTC ISO).
- **Change module:** `decideChangeRequest(tx, requestId, decision, actor)`:
  1. Lock the request (`for update`); none → `NOT_FOUND`; not PENDING → `ALREADY_DECIDED` with
     status and `decided_at`.
  2. Find and lock the event (`for update`) in the actor's scope; none → `NOT_FOUND`; actor is not
     its assigned coordinator → `NOT_ASSIGNED`.
  3. REJECT: reason required (trimmed, ≤ 1000) — else `VALIDATION_FAILED`, nothing written; record
     REJECTED with `decided_by/at`, reason. The event is not touched.
  4. APPROVE: changeable status and `checkProposedChange(current, proposed)` must pass — else
     `NO_LONGER_VALID` with field errors; `applyApprovedChange`; record APPROVED.
  5. Outbox `change-request.approved` / `.rejected` to the requesting organiser.
  The body is validated before the transaction (decision ∈ APPROVE/REJECT; reason rules).

**Locks:** request, then event. S1 takes only the event lock, so there is no cycle.

## 5. API

`POST /api/v1/change-requests/{id}/decision`, Event Coordinator role (assignment checked inside).

| Case | Response |
|---|---|
| Approved / Rejected | 200 `{ changeRequest, event? }` (event's new significant values on approval) |
| Bad body / reject without reason | 400 `VALIDATION_FAILED` |
| Already decided | 409 `CHANGE_REQUEST_ALREADY_DECIDED` (details: status, decidedAt) |
| No longer valid (approve) | 409 `CHANGE_REQUEST_NO_LONGER_VALID` (details: fields) |
| Not the assigned coordinator | 403 `ROLE_NOT_AUTHORISED` |
| Unknown request / event out of scope | 404 `CHANGE_REQUEST_NOT_FOUND` |

Contracts: the three codes (and OpenAPI enum), the two message types and payload schemas
(`eventId, eventReference, eventName, ownerId, changeRequestId, fields, decidedBy, decidedAt`,
plus `reason` on rejected). `ChangeRequest` gains `decidedBy`, `decidedAt`, `rejectionReason`.
Notification rules for the organiser: "Your change request for EVT-… “name” was approved: start,
expected attendance." / "…was rejected. Reason: …".

## 6. Screens

- **Coordinator's review page:** the pending notice gets Approve and Reject for the assigned
  coordinator while Pending. Reject opens a dialog with a required reason (as D5's); Approve
  confirms, listing before → after. Refusals inline. A decided request shows its outcome and no
  buttons (AC6).
- **Organiser's request page:** "Change approved on …" / "Change rejected on …: <reason>"; "Request
  a change" is offered again.

## 7. Tests

Cards in `tests/S2/`, fixture **FX-S2** = FX-S1 plus CR1 pending on E1 (start `D 14:00` → `D 15:00`,
attendance 150 → 180, reason "Keynote speaker arrives late"); actor C2 (coordinator not assigned).
Named tests in `tests/change/api/s2Cards.test.ts`.

| Card | AC | Case |
|---|---|---|
| S2-T1 | 3 | C1 approves: 200 Approved; E1 `D 15:00`–`D 18:00`, 180, version +1; two FIELD_CHANGE entries with before, after, C1, time |
| S2-T2 | 4 | C1 rejects with a reason: 200 Rejected with reason; E1 unchanged and equal to CR1's snapshots; no history entry |
| S2-T3 | 2 | Reject without / empty / blank reason: 400 on `reason`; CR1 Pending, no `decided_at`; E1 unchanged |
| S2-T4 | 1, 6 | Deciding again after approve, and after reject: 409 `CHANGE_REQUEST_ALREADY_DECIDED` naming the decision; nothing changes |
| S2-T5 | 1 | C2, ORG, TS, VS: 403; unknown request: 404 |
| S2-T6 | — | CR1's proposed start set into the past: approve → 409 `CHANGE_REQUEST_NO_LONGER_VALID` naming `proposedStartAt`; reject still works |
| S2-T7 | — | E1 Cancelled after CR1: approve → 409 `CHANGE_REQUEST_NO_LONGER_VALID` |
| S2-T8 | 5 | ORG notified on approval (event and fields) and on rejection (with the reason) |
| S2-T9 | 1 | After a decision ORG can raise a new request |
| S2-T10 | — | A G1 edit with E1's pre-approval version → 412 |
| S2-T11 | 1 | Race: approve and reject at once; exactly one decision (CI only) |
| S2-T12 | all | Browser walkthrough (manual) |

Also: domain unit tests at 100%; repo tests for `applyApprovedChange` and `decideChangeRequest`;
notification tests for both rules; web tests; `sprint-3.csv` rows.

## 8. Out of scope

S3 (flagging arrangements an approved change affects), withdrawing a request, partial approval.
