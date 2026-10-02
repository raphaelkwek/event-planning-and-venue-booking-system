# Week 7 customer changes: impact and proposed handling

**Author:** Joash · **Date:** 2 Oct 2026 · **Status:** accepted 2 Oct 2026 (Joash), and checked against the course's *Managing Changes* guide. It is carried out in `documentation/change-requests.md` (CR-01 to CR-06) and story revision 4. The new story ids differ from this draft: A4, E3, E4, E5, H3, L4, L5, L6 and U1.
**Source:** `Week 7 Customer Changes.pdf` (IS212 Scrum Project folder). All six changes are required for Release 1 (Week 12), and the customer expects no more. The course's guide on managing the changes is in the same folder; this note should be checked against it.

## Summary

| # | Change | Stories it revises | New stories | Built code affected | Size of the hit |
|---|---|---|---|---|---|
| 1 | Setup and turnaround time per venue | H1, I1, J1, K1, L1, L3, M1, N1, N2 | Change a venue's buffers and flag the bookings that now conflict | none yet (venue isn't built) | Small. The design already stores `blocked_period` |
| 2 | Venue unavailable after booking | I2, L1, J1 | Request a replacement venue for a disrupted booking | none yet | Small. I2 already covers most of it (C-12) |
| 3 | Several venues for one event | L1, L3, M1, K1, F4, F5, R2, R7, S3, G2 | possibly per-space requirements | none yet | Large. "The booked venue" is singular in F5, R2, R7 and S3 |
| 4 | Tentative holds expire | L3 (it says holds never expire) | Hold expiry and its reminder | none yet | Medium. Needs a timer (EN-11, Temporal) |
| 5 | Event Coordinator Lead | E1, E2, A2, A3, D1 | Lead's unassigned queue; Lead assigns; Lead reassigns; Lead oversees | **yes**: E1, E2, A3 and D1 are Done in Sprint 1 | Large. It reverses E1's automatic assignment and A3's "coordinators see all events" |
| 6 | Safety Officer and Operational Safety Check | F1 (the status list), F5, A2 | Safety check: approve, reject or request changes | **yes**: F1's status machine, which Raphael is building | Medium to large. It adds a lifecycle stage |

**Two earlier decisions are reversed:**
- `plan.md` §1 lists setup and turnaround buffers as out of scope, confirmed with the customer. Change 1 brings them in.
- A3 was revised so that coordinators see all events. Change 5 limits a coordinator to their assigned events.

Record both openly as evolving requirements (PX-14). That is the rubric's "handling evolving requirements" evidence.

## Each change in detail

### 1. Setup and turnaround time

- **Venue (H1):** gains `setup_minutes` and `turnaround_minutes`.
- **The occupied period is `[start − setup, end + turnaround)`.** ADR-0006 already reserved exactly this as `blocked_period` ("buffers are zero in Release 1, so switching them on is a data change, not a redesign"), and the exclusion constraint already uses it. EN-02.1 only has to fill it from the venue's buffers.
- **N1's "periods that merely touch don't overlap"** now applies to the *buffered* periods.
- **I1, J1, L3, M1 and N2** compare buffered periods.
- **"Identify, don't silently remove":** raising a venue's buffers can make two existing bookings overlap, and the exclusion constraint would reject rewriting their periods.
  - Keep each slot's stored period.
  - Compute the new periods, and flag the bookings that would now overlap as Requires Reconfirmation, the same flag I2 uses.
  - This is a new story, and an amendment to ADR-0006.

### 2. Venue unavailable after booking

- **I2 already does most of this** (clarification C-12): the block is created, disrupted bookings get Requires Reconfirmation, the event isn't cancelled, and the coordinator is notified.
- **Four deltas:**
  - reason categories: maintenance, equipment failure, renovation, safety, other;
  - the notification says alternative arrangements are required;
  - the coordinator can search for (J1) and request (L1) a replacement venue **in the system**, linked to the disrupted booking;
  - the original event information is unchanged throughout.
- **I2 says resolution happens "outside the system"; that changes.** The disrupted booking stays on record until its replacement is confirmed.

### 3. Several venues for one event

- **The data model already allows it:** `venue_slots` is one row per booking, and a booking carries its `event_id`. The **stories** are what assume one venue:
  - F5 needs "a confirmed venue booking";
  - R2 and R7 use "the capacity of the booked venue";
  - L3 allows "at most one active hold per event";
  - S3 flags "the booked venue".
- **Each booking is checked on its own** for suitability (K1), availability and conflicts (N1, N2).
- **Changing or cancelling one booking leaves the others alone.** F4 (cancelling the event) still releases them all.
- **F5:** every active booking must be confirmed, or at least one; a customer question.
- **R2 and R7:** registration capacity needs a rule; a customer question.
- **K1:** a breakout room can't be judged against the whole event's attendance, so each booking probably needs its own space requirement (attendance, layout, facilities); a customer question.

### 4. Tentative holds expire

- **L3's last criterion ("holds don't expire in this release") is replaced.** Each hold gets an expiry date and time.
- **On expiry** the hold becomes Expired and the venue is free. An expired hold is never treated as a booking.
- **The coordinator is notified** before expiry and at it.
- **This is a durable timer:** a `HoldExpiry` Temporal workflow (ADR-0009, EN-11). Until EN-11 lands, it could be a sweep like F1's completion job.
- **Wording to check:** the customer writes "Venue Staff sometimes temporarily hold a venue", but L3 and the Cerbos policy let only the assigned coordinator place holds.

### 5. Event Coordinator Lead

- **New role `EVENT_COORDINATOR_LEAD`,** which changes several things already built:
  - the contracts `ROLES` list, the identity seed users and the Cerbos policies;
  - the staff console's navigation (A2) and the C4 model.
- **E1:** submissions are no longer assigned automatically. They join an **unassigned queue** that the Lead sees, and the Lead assigns a coordinator. The round-robin allocation and `EVENT_COORDINATOR_POOL` in `submitEvent.ts` go.
- **E2:** the Lead can reassign. Whether the coordinator-to-coordinator proposal flow stays is a customer question.
- **A3:** a coordinator manages **only assigned events**. The Lead sees all assignments and active events. `resolveAccessScope` changes (coordinator: ALL becomes ASSIGNED; Lead: ALL), and so does the RLS work in EN-07.2.
- **D1:** each coordinator's queue holds their assigned events, and the Lead's holds the unassigned ones.
- **Notifications** go out on every assignment and reassignment.
- **Handling the built work:** E1, E2, A3 and D1 are Done. Don't reopen them. Add new stories that change the behaviour, and keep the Sprint 1 record intact.

### 6. Safety Officer and the Operational Safety Check

- **New role `SAFETY_OFFICER`.** Once the venue and the technical arrangements are confirmed (F5), the Safety Officer reviews the event:
  - attendance against capacity and layout;
  - emergency access;
  - accessibility;
  - equipment placement;
  - crowd movement;
  - venue restrictions.
- **Three outcomes:** approve, reject the safety arrangement, or request changes, which sends the event back to an earlier planning stage. The event can't proceed to preparation until it's approved.
- **F1's exhaustive status list changes.** One option: Confirmed, then **Safety Review**, then **Ready** ("preparation"), with request changes going back to Planning. Raphael is building F1's status machine now, so agree this with him first.
- **Ownership:** the change and readiness module, which owns F5, is the natural home.

## Questions for the customer (proposed CQ-04 to CQ-10)

1. **Several venues and registration:** which capacity limits registrations (R2, R7)? A designated main venue, the sum of all the venues, or something else?
2. **Several venues and suitability:** does each venue booking carry its own space requirement (expected attendance, layout, facilities), so that a breakout room isn't judged against the whole event's attendance?
3. **Several venues and confirmation (F5):** must every venue booking be confirmed before the event is Confirmed?
4. **Holds:** who places a hold, Venue Staff or the assigned coordinator? Who sets the expiry, is there a default or a maximum, and how long before expiry should the reminder go out?
5. **Lead:** does coordinator-to-coordinator reassignment (E2) remain, or does only the Lead reassign? Can a coordinator still *view* events that aren't assigned to them, or nothing beyond their own?
6. **Safety check:** what does "reject the safety arrangement" lead to? Is the event rejected, or sent back like "request changes"? Which earlier stage does "request changes" return to? Do the venue and equipment bookings stay in place meanwhile?
7. **Buffers:** do setup and turnaround also apply to holds and to unavailability blocks? Must the buffered period fit inside the venue's operating hours?

## Proposed handling

1. **Check this note against the course's change-management guide,** then have the PO confirm the plan.
2. **Log each change** as a clarification (`documentation/clarifications.md`, PX-07). Write the PX-14 changed-requirements note: what changed, why, and how it was re-planned.
3. **Update `final user stories.md`** with the existing ⚠ REVISED and ⚠ NEW markers. Revise the stories still to come (H1 to N2, L3, F5, R2, R7, S3, F1). For changed Done stories (E1, E2, A3, D1), add **new** stories rather than editing Done ones.
4. **Jira:** create the new stories, revise the acceptance criteria on the open ones, and send CQ-04 to CQ-10 through the PO.
5. **Estimate everything new or revised at planning poker** (PX-02). Points come only from the team (Gate C).
6. **Sequence:**
   - **Sprint 3:** changes 1 and 2, which sit inside the venue stories already planned there, and 4, which goes with L3.
   - **Sprint 3 or 4:** change 5 (the Lead), which touches Done code, so plan it deliberately.
   - **Sprint 4:** changes 3 and 6.
7. **Follow-on design updates:**
   - ADR-0006: buffered periods and flagging bookings when buffers change;
   - ADR-0009: a `HoldExpiry` workflow;
   - ADR-0010: two new roles in the Cerbos policies (their tests then require it);
   - C4 model: two new people;
   - `implementation.md` §4.6.

**Until the stories are updated:** H1 should add the setup and turnaround fields from the start, so it isn't reworked, and EN-02.1 should build `blocked_period` from the venue's buffers.
