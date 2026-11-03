# G2 — Warn which arrangements a significant change would affect (SPM-31): design

**Date:** 2026-10-29 · **Author:** Raphael, via Claude · **Sprint:** 4 · **Branch:** `feature-raphael/g2-change-impact-preview`, stacked on `feature-raphael/s3-change-impact` (PR #69), since it reuses S3's assessment. Retarget to `main` once #69 merges.

## 1. The story

As an Event Coordinator, I want to see which existing arrangements a proposed significant change would
affect, so that I can weigh the consequences before deciding on it.

| # | Acceptance criterion (Jira) |
|---|---|
| AC1 | The list of significant fields is held in one place and used by both the edit screen (G1) and the change-request screens (S1, S2). |
| AC2 | When a change request touches a significant field, the review screen lists the confirmed venue booking, equipment reservations, and count of active registrations for that event, read from the booking, reservation and registration records. |
| AC3 | For each listed arrangement the screen states specifically why it is affected (for example, the booked period no longer matches the proposed date/time, or proposed attendance exceeds the booked venue's capacity for the booked layout). |
| AC4 | No booking, reservation, or registration is altered while the change request is only being viewed. |

## 2. What already exists

- **AC1:** `SIGNIFICANT_EVENT_FIELDS` in `@connectsphere/contracts` (`eventFields.ts`), used by G1's edit
  and S1/S2. G2 checks the web app reads the same list rather than its own copy, and fixes it if not.
- **S3 (#69):** the pure `assessChangeImpact` and `valuesAfterChange` (change module), the venue read
  `bookingsForImpact` (confirmed bookings, holds and pending requests, with layout capacity) and the
  equipment read `reservationsForImpact`. Both reads lock their rows `for update`, because S3 writes.
- **S3's screen:** `ChangeImpactView` shows an impact's arrangements, flags and reasons.
- **Registrations:** none until EN-13, so the count is 0, as in S3.

## 3. Decisions (Claude's recommendations, taken per Raphael's standing preference)

1. **One assessment, two callers.** G2 calls S3's `assessChangeImpact` with the event's current values
   overlaid by the request's proposed values, so the preview says exactly what approval would flag.
2. **Reads without locks (AC4).** `bookingsForImpact` and `reservationsForImpact` gain an option
   `{ lock: false }`; G2 runs them in a `read only` transaction, so viewing can't write or block anyone.
3. **Route:** `GET /api/v1/change-requests/{id}/impact`, same visibility as S1's read of the request
   (owner organiser, assigned coordinator, Event Coordinators; 404 otherwise). Only a **Pending**
   request has a preview: a decided one answers 409 `ALREADY_DECIDED` with its decision time (S2's
   code), since S3 already reported what approval did.
4. **Response:** S3's `impact` shape, `{ bookings, reservations, activeRegistrations, flags }`, where
   `flags` are the flags approval *would* set.
5. **Screen:** the coordinator's review page (`ReviewDetail`) shows "If this change is approved" above
   the Approve/Reject actions for a pending request, reusing `ChangeImpactView`. It says "No venue
   bookings or equipment reservations would be affected." when there are none.

## 4. Tests

Cards in `tests/G2/`, fixture **FX-G2** = S3's FX-S3 (event E, coordinator C, owner O, V1 "Theatre" 100,
V2 "Hall" 200, bookings B1 and B2, reservation R1) with a pending change request.

| Card | AC | Case |
|---|---|---|
| G2-T1 | 1 | The edit screen and the change-request screens take their significant fields from the one contracts list (unit test of the web app's import) |
| G2-T2 | 2 | A pending date change previews B1, B2, R1 and `activeRegistrations: 0` |
| G2-T3 | 3 | Date moved: each booking and the reservation carries Requires Reconfirmation / Flagged for review with the period reason |
| G2-T4 | 3 | Attendance 150: B1 Unsuitable naming 150 and 100; B2 (200) not flagged |
| G2-T5 | 4 | After the preview: slots, reservation, flag tables, request status, event and outboxes unchanged |
| G2-T6 | 2 | A descriptive-only significant change (venue requirements) lists the arrangements and flags none |
| G2-T7 | — | Owner, coordinator and an Event Coordinator get 200; another organiser 404; a decided request 409 |
| G2-T8 | all | Browser walkthrough (manual) |

## 5. Out of scope

Previewing a decided request, notifying anyone, and changing what approval does (S3).
