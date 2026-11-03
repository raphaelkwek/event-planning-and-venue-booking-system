# F3 and F4 — Cancel an event, and release what it holds (SPM-29, SPM-111): design

**Date:** 2026-10-29 · **Author:** Raphael, via Claude · **Sprint:** 4 · **Branches:** `feature-raphael/f3-cancel-event`
(from `main`), then `feature-raphael/f4-release-on-cancel` stacked on it.

The team moved F3 to Sprint 4 so it ships with F4: "cancellation is one command with F4. Shipping it alone means rewriting
it" (Joash's comment on SPM-29, Gate B, 1 Oct 2026). So this is one design for one command, built in two steps. F3 adds the
command, and F4 adds the releases to the same transaction without rewriting it. Each story has its own branch, cards and PR,
and the two PRs should merge together.

## 1. The stories

**F3.** As an Event Organiser, I want to cancel my event, so that everyone involved knows it will not go ahead.

| # | Acceptance criterion (Jira, revised by the Week 9 answers) |
|---|---|
| F3-AC1 | The owning organiser or the assigned coordinator can cancel, for an event not Completed, Rejected or Cancelled. There is no deadline. |
| F3-AC2 | A reason is mandatory. Without one, the status is unchanged and nothing is released. |
| F3-AC3 | The status becomes Cancelled, recording the reason, the acting user and the timestamp. |
| F3-AC4 | The cancelled event stays visible to the users related to it, showing the reason and the cancellation date. |
| F3-AC5 | A cancelled event cannot be edited or submitted, and no new booking, reservation or registration can be raised against it. |
| F3-AC6 | The owner, the assigned coordinator, the Venue Staff of any booked venue and the Technical Support Staff of any reserved equipment are notified. |
| F3-AC7 | Releasing the arrangements is F4's job. |
| F3-AC8 | Week 9 (W9-07): cancelling closes any change request still pending (S1), recording that it was closed because the event was cancelled. It can no longer be decided. |

**F4.** As an Event Coordinator, I want a cancelled event's venue, equipment and attendee places to be freed together, so that
nothing stays committed to an event that will not happen.

| # | Acceptance criterion |
|---|---|
| F4-AC1 | Release is triggered by cancellation (F3), for every confirmed booking, tentative hold, equipment reservation and active registration of the event. |
| F4-AC2 | Bookings and holds are released, and the venue is available again for that period in the calendar (I1) and search (J1). |
| F4-AC3 | Reservations are released, and the quantities are available again for that period. |
| F4-AC4 | Active registrations and waitlist entries become Cancelled, and each attendee is notified. |
| F4-AC5 | All or nothing: if any release step fails, the cancellation is not recorded, nothing is partly released, the event keeps its status, and the user is told the cancellation did not complete. |
| F4-AC6 | Released bookings and reservations are kept as Released, not deleted, each recording the reason, the acting user and the timestamp. |
| F4-AC7 | Releasing something already released changes no quantity and writes no second timestamp, so a retried cancellation reaches the same end state. |

## 2. What already exists

- **F1's status machine** (`event/domain/statusMachine.ts`). `transitionEvent` is the only status writer and can set extra
  columns in the same statement (`options.set`). There is no cancellation row yet.
- **F5's command** (`change/repo/confirmArrangements.ts`) is the pattern to copy. It is one core transaction: lock the event
  `for update` in the caller's A3 scope, check who may act and the status, read the venue and equipment arrangements through
  their modules' `index.ts`, then call the event module's half, which transitions and writes the message.
- **The F4 release functions are already built:**
  - `releaseVenueArrangementsForEvent(tx, eventId, actorId)` (L4, venue module). It locks each venue in order, then:
    - releases holds;
    - withdraws pending requests, giving back the slot a converted hold still holds;
    - marks confirmed slots `RELEASED` with `release_reason = 'event cancelled'`, `updated_by` and `updated_at`.

    It returns the references.
  - `releaseEventReservations(tx, eventId, actor, reason)` (Q2, equipment module) releases every Reserved line through Q2's
    `releaseLine`, recording `released_by`, `released_at` and `release_reason`. A line that is not Reserved is skipped.
- **Statuses that already refuse new work:**
  - Venue: requests are refused unless the event is Approved, Planning, Safety Review or Confirmed (`eventBookable`), and holds
    are refused for Completed, Cancelled or Rejected (`NOT_HOLDABLE`).
  - Event: edits need Approved to Confirmed (`EDITABLE_STATUSES`), and submitting needs Draft.
  - Change requests need Submitted to Confirmed (`CHANGEABLE_STATUSES`).
  - Equipment checks no event status.
- **Registrations:** none. EN-13 (registration service, Joash) is To Do.

## 3. Decisions (Claude's recommendations, taken per Raphael's standing preference)

1. **Route.** `POST /api/v1/events/{id}/cancellation` with `{ "reason": "…" }`, in the change module, beside F5's
   `/confirmation`.
   - **Who:** Event Organisers and Event Coordinators reach it. The event is looked up in the caller's A3 scope, so an
     organiser who does not own it gets 404. A coordinator who can see it but is not assigned gets 403 `ROLE_NOT_AUTHORISED`.
   - **Reason:** the same rules as S1's reason, trimmed, 1 to 1,000 characters. Otherwise 400 `VALIDATION_FAILED` with the field
     `reason`, checked before any transaction (F3-AC2).
   - **Status:** a refused status gives 409 `STATUS_TRANSITION_NOT_PERMITTED` with F1's message.
   - **Response:** 200 `{ event: { id, reference, status, previousStatus, cancellationReason, cancelledBy, cancelledAt },
     closedChangeRequest, released }`. `released` is F4's.
2. **Transition.** `CANCEL: { from: every status except COMPLETED, REJECTED, CANCELLED, to: CANCELLED }`, as F3-AC1 lists them,
   so a Draft can be cancelled too. The reason, user and time are written in the same statement as the status, through
   `transitionEvent`'s `set`.
3. **Storage.**
   - **Event migration 0012** adds `cancellation_reason`, `cancelled_by` and `cancelled_at` to `event.events`, with a check
     added `NOT VALID`: the status is CANCELLED exactly when all three are present and the reason is not blank. Migration 0013
     validates the check.
     - These are 0012 and 0013 because Seann's open E4 and E5 PRs already use 0010 and 0011. `migrate.ts` tracks files by
       name, so the gap is harmless.
     - The event detail (`GET /api/v1/events/{id}`) returns the three fields, and the screens show the reason and date (F3-AC4).
   - **Change migration 0004** adds `CLOSED` to `change_requests.status`. It also adds `closed_reason`, and replaces the
     decision check so that a closure records `decided_by`, `decided_at` and `closed_reason`. Migration 0005 validates the
     checks.
     - A closed request answers S2's decide route as already decided (409).
4. **One transaction, in this order (ADR-0004, as F5):**
   1. Lock the event `for update` in scope, check the actor and the status.
   2. Read the venue and equipment arrangements. F5's reads, `for share`, give the Venue Staff and the Technical Support
      member to notify.
   3. **F4:** release the venue arrangements, then the reservations.
   4. Close the pending change request (change schema).
   5. Apply `CANCEL` and write `event.cancelled` (event module).

   Any error rolls back all of it (F4-AC5). The route answers 500 with "The event was not cancelled…", and the event keeps its
   status. The lock order is event, venue rows, equipment rows, the same as F5 and S3, so they cannot deadlock.
5. **New work refused (F3-AC5).**
   - **Venue, event and change requests:** they already refuse a Cancelled event, and the cards prove it.
   - **Equipment** gains the check:
     - recording new request lines (O1) and reserving a line (Q1) are refused with 409 `EVENT_CANCELLED`;
     - the check is made inside the write's transaction, after locking the event `for share`
       (`findEventForChange(…, { lock: "share" })`);
     - so a reservation either commits before the cancellation takes its lock, and F4 then releases it, or it waits and is
       refused.
   - **Venue requests and holds:** they keep their existing check, made before the transaction. A request racing the
     cancellation could survive it, which is a known gap shared with every venue status check today. Closing it means changing
     L1 and L3 and is left out.
6. **Notification (F3-AC6).** One outbox message, `event.cancelled`, on the event topic.
   - **Payload:**
     - the event (reference, name), `ownerId`, `assignedCoordinatorId`, the reason, `cancelledBy` and `cancelledAt`;
     - `bookings[]` (reference, venue name, `staffIds`) and `reservations[]` (type, quantity, `reservedBy`);
     - in F4, each entry also says it was released.
   - **Notices:** the notification service sends one notice per recipient: the owner, the coordinator, each Venue Staff member
     and each Technical Support member, each once.
7. **F4: registrations, and the Temporal workflow.**
   - **The plan (ADR-0009):** cancellation runs as a `CancelEvent` Temporal workflow, whose only purpose is the semantic lock
     on registrations held by another service. With no registration service there is nothing to lock.
   - **What F4 does instead:** the release runs directly in the core transaction, as ADR-0009's step 2 says. The response
     reports `released.registrations: 0`.
   - **Left to EN-13 or R4:**
     - the workflow, with steps 1 and 3 (`CANCEL_PENDING`, then finalise);
     - cancelling registrations and waitlist entries, and notifying attendees (F4-AC4).

     `workflows/index.ts` already says CancelEvent waits for EN-13.
8. **Idempotence (F4-AC7).** A second cancellation is refused with 409, because Cancelled is not a permitted source. Nothing
   changes. Both release functions skip anything already released.
9. **Screens.**
   - The organiser's request detail and the coordinator's review detail get a "Cancel event" button. It is shown to the owner
     and to the assigned coordinator, while the status allows it.
   - It opens a confirmation modal that restates what will happen and holds the mandatory reason (implementation.md §5).
   - A cancelled event shows a "Cancelled" banner with the date and reason.

## 4. Tests

**F3**, fixture FX-F3: event E (owner O, coordinator C), status Planning, confirmed booking B1 at V1 (staff VS), reservation R1
reserved by T, and a pending change request CR. Cards in `tests/F3/`:

| Card | AC | Case |
|---|---|---|
| F3-T1 | 1, 3 | O cancels E with a reason: Cancelled, with reason, user and time recorded, and a history entry |
| F3-T2 | 1 | C (assigned) cancels; C2 (not assigned) gets 403; O2 gets 404 |
| F3-T3 | 1 | Allowed from Draft, Submitted, Approved, Safety Review and Confirmed; refused (409) from Completed, Rejected and Cancelled, with nothing changed |
| F3-T4 | 2 | No reason, or a blank one: 400, with E still Planning and nothing released |
| F3-T5 | 4 | The cancelled event's detail shows the reason and date to O and C |
| F3-T6 | 5 | Cancelled E refuses an edit, a change request, a venue request, a hold, new equipment lines and a reservation |
| F3-T7 | 6 | One `event.cancelled` message; O, C, VS and T each get one notice |
| F3-T8 | 8 | CR becomes Closed with "event cancelled", and deciding it then gives 409 |
| F3-T9 | all | Browser walkthrough (manual) |

**F4**, fixture FX-F4: FX-F3, plus hold H at V2, a pending request P at V1 for another period, and a second reservation R2.
Cards in `tests/F4/`:

| Card | AC | Case |
|---|---|---|
| F4-T1 | 1, 2 | Cancelling releases B1 and H, and withdraws P; the response lists them |
| F4-T2 | 2 | V1's period is free again: I1's calendar and J1's search show it available |
| F4-T3 | 3 | R1 and R2 are released, and the type's availability for the period is back to full |
| F4-T4 | 5 | With the equipment release forced to fail, the response is 500; E is still Planning, and B1, H, P, R1, R2 and CR are unchanged, with no message |
| F4-T5 | 6 | Each released record keeps its row: status Released (or Withdrawn), the reason "event cancelled", the user and the time |
| F4-T6 | 7 | Calling the release functions again changes no row and no timestamp; a second cancellation gives 409 with nothing changed |
| F4-T7 | 4 | `released.registrations` is 0, and no attendee is notified (EN-13 not built) |
| F4-T8 | all | Browser walkthrough (manual) |

## 5. Out of scope

- Registrations and the waitlist, attendee notices, and the CancelEvent Temporal workflow: these wait for EN-13 (§3.7).
- Closing the venue request race (§3.5).
- Undoing a cancellation: no story defines one.
