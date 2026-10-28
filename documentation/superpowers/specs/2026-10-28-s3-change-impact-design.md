# S3 — Reconsider arrangements affected by an approved change (SPM-59): design

**Date:** 2026-10-28 · **Author:** Raphael, via Claude · **Sprint:** 4 · **Branch:** `feature-raphael/s3-change-impact` (from `main`)

## 1. The story

As an Event Coordinator, I want existing bookings, reservations, and registrations to be flagged when a
significant change is approved, so that I can decide what to re-arrange rather than having the system
decide for me.

| # | Acceptance criterion (Jira, revised by CR-03 and the Week 9 answers) |
|---|---|
| AC1 | On approval of a change to a significant field, the system lists every confirmed venue booking, every equipment reservation, and the active registration count for the event. |
| AC2 | A confirmed booking whose period no longer matches the event's new date/time is set to Requires Reconfirmation; its period is not moved and the venue is not released. |
| AC3 | An equipment reservation whose period no longer matches the event's new window is flagged for review; nothing is released (Q2 releases). |
| AC4 | When the new expected attendance exceeds the booked venue's capacity for the booked layout, the booking is flagged unsuitable, showing both values. |
| AC5 | CR-03: with several venues (L4), each booking is assessed and flagged on its own. |
| AC6 | Flagging does not change the status of an event that is not Confirmed. |
| AC7 | Week 9: an approved change to a **Confirmed** event returns it to Planning with its flags; it is confirmed again only after F5 and a new safety check (U1). |
| AC8 | Every outstanding flag is visible on the event to the owning organiser, the assigned coordinator and Event Coordinators, saying which arrangement and why. |
| AC9 | An event cannot be confirmed (F5) while any arrangement carries a Requires Reconfirmation, Unsuitable or Flagged for review flag; the refusal names them. |
| AC10 | Venue Staff of the affected booking, Technical Support Staff of the affected reservation, and attendees with an active registration are notified. |
| AC11 | If flagging fails, the change is not applied and no arrangement is altered. |

## 2. What already exists

- **S2** `decideChangeRequest` (change module) approves a request inside one transaction: it locks the
  request and the event, calls `applyApprovedChange`, records the decision, and writes
  `change-request.approved` to the outbox.
- **F5** readiness (`change/domain/readiness.ts`) already names the three flags and refuses confirmation
  for any of them. It reads them through `venueArrangementsForEvent` and `equipmentArrangementsForEvent`,
  which today return only I2's `REQUIRES_RECONFIRMATION`. So AC9 needs only those two reads extended.
- **Venue:** `venue_slots` (status HELD/CONFIRMED, `requires_reconfirmation` from I2, which I2 and H3 also clear when
  their own block or buffer conflict goes). An L3 hold places a HELD slot; converting it into a booking request (L1) keeps
  that slot HELD under the request's reference, and M1 approving the request confirms the same slot in place. A request not
  converted from a hold gets a new CONFIRMED slot from M1. A confirmed
  booking's layout and attendance are on the booking request whose `booking_id` is the slot (M1).
  A venue's `layouts` jsonb holds each layout's name and capacity.
- **Equipment:** `equipment.reservations` (status RESERVED, `starts_at`/`ends_at`, `reserved_by`).
- **Registrations:** none. EN-13 (registration service) is To Do, so no event has registrations yet.
- **Status machine** (`event/domain/statusMachine.ts`): S3 adds one row.

## 3. Decisions (Claude's recommendations, taken per Raphael's standing preference)

1. **Same transaction as the approval (AC11).** `decideChangeRequest` calls the new flagging step after
   `applyApprovedChange` and before `recordDecision`. Any error rolls back the change, the decision and
   every flag together.
2. **One pure assessment, shared with G2.** `assessChangeImpact(arrangements, before, after, changedFields)`
   in `change/domain/changeImpact.ts` decides every flag and its reason. S3 applies its result; G2 will
   call the same function read-only on the review screen.
3. **The rules.**
   - Period (AC2, AC3): only when `proposedStartAt` or `proposedEndAt` changed. A CONFIRMED booking, a HELD
     hold, a PENDING booking request or a RESERVED reservation whose period is not exactly the event's new
     start to end is flagged (`REQUIRES_RECONFIRMATION` / `FLAGGED_FOR_REVIEW`). The comparison is exact, so a
     booking or reservation deliberately for a different window (a request that `differs_from_event`, an
     equipment line's own required window) is flagged on any time change; the coordinator judges it.
   - Capacity (AC4): only when `expectedAttendance` changed. A booking, hold or pending request whose layout
     capacity (the request's layout, matched to the venue's `layouts` ignoring case and surrounding spaces;
     the venue's `max_capacity`, naming no layout, if there is no match) is below the new attendance is
     flagged `UNSUITABLE`, recording both numbers.
   - A rule whose input the event no longer has (no start, end or attendance) is skipped, not an error.
   - Venue requirements, equipment required and equipment requirements are free text or yes/no, so they
     are listed (AC1) but not flagged automatically. The coordinator judges them.
   - Held holds and pending requests are flagged too: F5 refuses while they exist, but either can become a
     CONFIRMED booking for the old period afterwards (M1), which would then pass F5 unflagged. A request
     converted from a hold whose slot is still HELD is assessed once, as the hold.
   - Each arrangement is assessed alone (AC5); an already-flagged arrangement gets the new reason added.
4. **Storage.** Venue migration 0018: `period_mismatch` and `unsuitable` (boolean, not null, default false) on
   both `venue_slots` and `booking_requests`, and `venue.arrangement_flags` (slot or booking request, exactly
   one; event, change request, flag, reason text, details jsonb, flagged_at). S3's Requires Reconfirmation is
   `period_mismatch`, not I2's `requires_reconfirmation`, which I2 and H3 reset from their own records; F5
   reads either as one `REQUIRES_RECONFIRMATION`. A hold's flags are on its slot, which M1 confirms in place.
   When M1 approves a flagged request it copies the request's columns and flag rows to the confirmed slot
   (`carryRequestFlagsToBooking`, venue module), so the booking stays flagged.
   Equipment migration 0009: `reservations.flagged_for_review boolean not null default false`, and
   `equipment.reservation_flags` (same shape). The booleans are what F5 reads; the rows say why (AC8).
   Each module writes only its own schema, through a function exported from its `index.ts`.
5. **Status (AC6, AC7).** New transition `RECONSIDER_AFTER_CHANGE: CONFIRMED → PLANNING`, applied
   through `transitionEvent` when the approved event is Confirmed. Every significant field counts as
   material (Week 9 lists date, time, attendance, venue, layout and equipment). Any other status is
   left alone, Safety Review included, as AC6 says.
6. **Registrations.** The count is always 0 until EN-13 exists; the response reports it as
   `activeRegistrations: 0`. Notifying attendees (AC10) is left to the registration stories, which
   will consume the same message.
7. **Notifications (AC10).** One outbox message, `change-request.arrangements-flagged`, on the event
   topic, listing each flagged booking (with its venue's staff ids) and reservation (with `reservedBy`).
   The notification service turns it into one notice per recipient. No flags, no message.
8. **Clearing a flag** is out of scope: no story defines it yet. The coordinator releases and rebooks.

## 4. API and screens

| Route | Who | What |
|---|---|---|
| `POST /api/v1/change-requests/{id}/decision` (S2) | assigned coordinator | An approval's 200 now also returns `impact`: the bookings, holds and pending requests (each with its `arrangement`: `BOOKING`, `HOLD`, `BOOKING_REQUEST`), reservations, registration count, and the flags set. |
| `GET /api/v1/events/{id}/arrangement-flags` (new, change module) | owner, assigned coordinator, Event Coordinators | Every flag F5 would refuse on (AC8, AC9): arrangement, reference, venue or equipment name, flag, reason; each arrangement and flag once, with the newest reason. A Requires Reconfirmation set by I2 or H3 has the reason "The venue's availability changed after this booking was made; Venue Staff must reconfirm it." 404 for anyone else (as S1). |

Screens: after approving, the coordinator sees the impact list. The event page shows an "Outstanding
flags" panel to the three roles in AC8.

## 5. Tests

Cards in `tests/S3/`, fixture **FX-S3**: event E (owner O, coordinator C), venues V1 (layout "Theatre",
capacity 100) and V2 (layout "Hall", capacity 200), confirmed bookings B1 at V1 and B2 at V2 for E's period, reservation R1 for E's
period, a pending change request CR on E.

| Card | AC | Case |
|---|---|---|
| S3-T1 | 1 | Approving a date change returns B1, B2, R1 and `activeRegistrations: 0` |
| S3-T2 | 2 | Date moved: B1 and B2 Requires Reconfirmation, periods unchanged, still CONFIRMED |
| S3-T3 | 3 | Date moved: R1 Flagged for review, still RESERVED with the same quantity |
| S3-T4 | 4 | Attendance 150: B1 Unsuitable, reason names 150 and 100 |
| S3-T5 | 5 | Attendance 150, B2 in a 200-capacity layout: only B1 flagged |
| S3-T6 | 6 | Event in Planning: status still Planning after flagging |
| S3-T7 | 7 | Confirmed event: returns to Planning, with history |
| S3-T8 | 8 | Owner, coordinator and an Event Coordinator see the flags; another organiser gets 404 |
| S3-T9 | 9 | F5 confirmation refused, naming each flag |
| S3-T10 | 10 | One `arrangements-flagged` message; Venue Staff and the reserving Technical Support member each get a notice |
| S3-T11 | 11 | Flagging forced to fail: request still Pending, event unchanged, no flags |
| S3-T12 | 1–4 | A change to descriptive-only significant fields (venue requirements) lists arrangements and flags none |
| S3-T13 | all | Browser walkthrough (manual) |
| S3-T14 | 2, 9 | A request pending at approval is flagged; M1 then confirms it and the booking stays flagged, so F5 refuses |

## 6. Out of scope

Clearing a flag, notifying attendees (needs EN-13), and G2's review-screen preview (next story, reuses §3.2).
U1's safety approval (`APPROVE_SAFETY`, Safety Review → Confirmed) is not built yet: a change approved during
Safety Review leaves the event there (AC6) with its flags, so when U1 applies that transition it must refuse
while any arrangement flag is outstanding, as F5 does.
