# Jira Update Instructions — ConnectSphere Backlog (post-clarification revision)

**For:** Rovo agent
**Scope:** 23 changes — 5 new work items, 1 deletion, 17 edits.
**Explicitly out of scope:** A3, B2, E1, E2. These have already been updated separately (automatic assignment logic for E1, proposal handshake for E2, cross-service dependency tasks, and the Sprint 1 test kit) — do not touch them here.

## How to apply

Each work item below is identified by its story code (e.g. `I2`), which appears at the start of the summary field. For each:

- **REPLACE DESCRIPTION** — overwrite the entire description with the block provided.
- **REPLACE LINE** — find the single bullet quoted under *Find* and replace it with the bullet under *Replace*. Leave every other bullet untouched.
- **ADD LINE** — insert the bullet under *Add* immediately before the bullet quoted under *Before*.
- **CREATE** — create a new story in the stated epic, with the summary and description given.
- **DELETE** — see T1; do not hard-delete.

If a *Find* string does not match exactly, stop and report that item rather than guessing. Do not reword, reformat, or "improve" any text. Keep the existing bullet-list formatting of the description field.

---

## 1. A2 — Restrict functions to the roles permitted to use them

**REPLACE LINE** (user story)

*Find:* `As ConnectSphere, I want every function to be restricted to the roles permitted to perform it, so that users cannot carry out actions belonging to another role.`

*Replace:* `As a ConnectSphere user, I want the system to stop me performing actions that belong to another role, so that I cannot damage an event by doing something I was never meant to do.`

**REPLACE LINE** (first acceptance criterion)

*Find:* `Each protected function declares the roles permitted to invoke it, and the permitted-role list is defined in one place used by both the interface and the server.`

*Replace:* `Every protected function has a defined list of the roles permitted to invoke it, and the same list governs what the interface offers and what the server accepts.`

---

## 2. B1 — Create and submit an event request

**ADD LINE**

*Add:* `On submission the assigned coordinator (E1) is notified that a new event request is awaiting review.`

*Before:* `If submission fails validation, no event record is created, no submission timestamp is recorded, and the entered values are preserved on screen.`

---

## 3. D3 — Respond to a clarification request

**ADD LINE**

*Add:* `The coordinator who requested the clarification is notified that the organiser has responded.`

*Before:* `An organiser who does not own the event cannot view or answer the clarification.`

---

## 4. F1 — Move events through a controlled status lifecycle

**UPDATE SUMMARY** to: `F1 — Trust that an event's status reflects what has actually happened`

**REPLACE LINE** (user story)

*Find:* `As ConnectSphere, I want event status to change only as a consequence of a defined action, so that the status always reflects what has actually happened to the event.`

*Replace:* `As an Event Coordinator, I want an event's status to change only when something real has happened to it, so that I can rely on the status when deciding what to work on next.`

**REPLACE LINE** (Confirmed criterion)

*Find:* `An event reaches Confirmed only while a confirmed venue booking exists for it (source of truth: the booking record).`

*Replace:* `An event reaches Confirmed only through the confirmation action specified in F5, which defines the conditions that must hold. This story defines that Confirmed is a permitted status and that reaching it writes a history entry like any other transition.`

**NOTE FOR THE BOARD:** F1 has been split. This story now covers the status lifecycle, permitted transitions, and history only, and is scheduled for Sprint 1 because B1, C2, and D1 all change status and cannot precede the state machine. The readiness conditions for Confirmed move to the new F5, scheduled for Sprint 4, because they depend on M1 (confirmed booking) and Q1 (equipment reservation). Re-estimate F1 from 8 to 5 points.

**LINK:** add a "relates to" link from F1 to the new F5.

---

## 5. F3 — Cancel an event

**REPLACE DESCRIPTION**

```
User Story: As an Event Organiser, I want to cancel my event, so that everyone involved knows it will not go ahead.

Acceptance Criteria
- Cancellation can be performed by the owning organiser or the assigned coordinator, for events not in status Completed, Rejected, or Cancelled. There is no deadline: cancellation may be requested at any point.
- A cancellation reason is mandatory; without it the event status is unchanged and nothing is released.
- On cancellation the status becomes Cancelled and the reason, acting user, and timestamp are recorded.
- The cancelled event remains visible to the users related to it, showing the reason and the cancellation date.
- A cancelled event cannot be edited, submitted, or have new bookings, reservations, or registrations raised against it.
- The owning organiser, the assigned coordinator, the Venue Staff of any booked venue, and the Technical Support Staff of any reserved equipment are notified of the cancellation.
- Releasing the event's arrangements is specified separately in F4.
```

**LINK:** add a "relates to" link from F3 to the new F4.

---

## 6. F4 — Release the arrangements of a cancelled event

**CREATE** in the same epic as F3 (Feature 6 — Event Status Management).

**Summary:** `F4 — Release the arrangements of a cancelled event`

**Description:**

```
User Story: As an Event Coordinator, I want a cancelled event's venue, equipment, and attendee places to be freed together, so that nothing stays committed to an event that will not happen and no attendee is left thinking they have a place.

Acceptance Criteria
- Release is triggered by the cancellation of an event (F3), and runs for every confirmed booking, tentative hold, equipment reservation, and active registration belonging to that event.
- Confirmed venue bookings and tentative holds for the event are released, and the venue becomes available again for the corresponding period in the calendar (I1) and in venue search (J1).
- Equipment reservations for the event are released, and the reserved quantities return to availability for the corresponding period.
- Active attendee registrations and waitlist entries become Cancelled, and each affected attendee receives a notification.
- All-or-nothing: if any release step fails, the cancellation is not recorded and no booking, hold, reservation, or registration is left partially released; the event remains in its pre-cancellation status and the acting user is told the cancellation did not complete.
- Released bookings and reservations are retained with status Released rather than deleted, each recording the release reason, acting user, and timestamp.
- Releasing an arrangement that is already released changes no quantity and writes no second release timestamp, so a retried cancellation produces the same end state.
```

---

## 7. F5 — Confirm an event only when venue and equipment are ready

**CREATE** in the same epic as F1 (Feature 6 — Event Status Management). **Sprint 4. 5 points.**

**Summary:** `F5 — Confirm an event only when venue and equipment are ready`

**Description:**

```
User Story: As an assigned Event Coordinator, I want to confirm an event only once both the venue and the equipment are actually arranged, so that a Confirmed event is one I can rely on rather than one that is still missing something.

Acceptance Criteria
- Confirmation is performed by the assigned Event Coordinator, on an event in status Approved or Planning.
- Confirmation is refused unless a confirmed venue booking exists for the event. A tentative hold is not sufficient.
- Confirmation is refused unless the event's equipment arrangements are complete: every equipment request line reserved in full, or the event marked as requiring no equipment, which counts as complete. A partially reserved line is not complete.
- Both conditions are read live from the venue booking record and the equipment reservation records at the moment of confirmation; a stored or cached readiness value is never used.
- If either the booking or the reservation information cannot be retrieved, confirmation is refused and nothing is changed.
- A refusal names which of the two arrangements is outstanding, and for equipment names the specific lines that are not reserved in full.
- Confirmation is refused while any arrangement for the event carries a Requires Reconfirmation or unsuitable flag (S3, I2); the refusal names the outstanding flags.
- On success the status becomes Confirmed and the acting coordinator and timestamp are recorded, with a history entry written as for any other transition (F1).
- The owning organiser is notified of the confirmation, as are the Venue Staff of the booked venue and the Technical Support Staff of any reservation.
- A refused confirmation changes no status, no booking, and no reservation.
```

**LINK:** "relates to" F1, M1, Q1.

---

## 8. G1 — Update non-significant event information

**REPLACE LINE**

*Find:* `The significant fields listed in Section 1 are not editable on this screen; attempting to edit them directs the user to the change-request process and stores no value.`

*Replace:* `The significant fields — event date, start/end time, expected attendance, venue requirements, and equipment requirements — are not editable on this screen; attempting to edit them directs the user to the change-request process and stores no value.`

---

## 9. I2 — Record a period of venue unavailability

**REPLACE DESCRIPTION**

```
User Story: As a Venue Staff member, I want to record periods when my venue cannot be used — including periods that are already booked — so that coordinators know an arrangement has been disrupted and can re-plan it.

Acceptance Criteria
- A block records venue, start date/time, end date/time, and a reason or type, all mandatory.
- The end must be later than the start; otherwise no block is created and the message identifies this as the cause.
- A block that overlaps an existing confirmed booking (two periods overlap when one starts before the other ends and ends after the other starts; periods that merely touch do not overlap) is created. Venue Staff are shown, before confirming, each confirmed booking the block would disrupt, with its booking reference, event reference, and overlapping period.
- Each disrupted confirmed booking is set to Requires Reconfirmation and records the blocking reason, the acting Venue Staff member, and the timestamp.
- The block does not cancel or release a disrupted booking: the booking record is retained, the venue is not released for the booked period, and the corresponding event's status is unchanged. Resolution is initiated by the assigned Event Coordinator, who agrees a new arrangement with the Event Organiser outside the system and records it through the normal change path (S1, S2, L1).
- The assigned Event Coordinator of each disrupted event receives a notification naming the venue, the booking reference, the event reference, the blocked period, and the recorded reason.
- Pending booking requests and tentative holds overlapping the block are flagged in the same way, and the requesting coordinator is notified.
- A created block makes the venue unavailable for that period in both the calendar (I1) and venue search (J1), so no new request can be raised for it.
- Creating and removing a block each record the acting user and timestamp. Removing a block restores availability for that period, clears the Requires Reconfirmation flag on any booking disrupted only by that block, and notifies the affected coordinators.
- A failed block creation leaves availability for the period unchanged, flags no booking, and sends no notification.
```

---

## 10. J1 — Filter venues against event requirements

**REPLACE LINE**

*Find:* `Venues with a confirmed booking or recorded unavailability overlapping the requested window are excluded, using the overlap rule in Section 1 and the sources of truth in Section 1.`

*Replace:* `Venues with a confirmed booking or recorded unavailability overlapping the requested window are excluded, using the overlap rule above, read from the venue's confirmed bookings, tentative holds, recorded unavailability, and operating hours.`

---

## 11. L3 — Place a tentative hold on a venue

**CREATE** in the epic for Feature 12 — Venue Booking Request.

**Summary:** `L3 — Place a tentative hold on a venue`

**Description:**

```
User Story: As an assigned Event Coordinator, I want to hold a venue and time slot while the event is still being planned, so that it is not taken by another event before the booking request is decided.

Acceptance Criteria
- Only the coordinator assigned to the event can place a hold, and only for an event not in status Completed, Cancelled, or Rejected.
- A hold records the venue, date, start and end time, the event, the holding coordinator, and the timestamp.
- At most one active tentative hold or confirmed booking exists for a given venue and period: a hold is refused when the period overlaps an existing hold or confirmed booking (two periods overlap when one starts before the other ends and ends after the other starts), and the refusal names the conflicting reference and period. Two events can never hold the same venue and period.
- Holds are allocated first-come, first-served. There is no override, appeal, or priority rule, and no user can displace an existing hold or confirmed booking.
- An event has at most one active hold at a time; placing a second is refused and names the existing one.
- A held period is shown as held on the availability calendar (I1), labelled with the event reference, and is excluded from venue search results for that period (J1).
- A hold can be converted into a booking request (L1) for the same venue and period without re-checking availability, and is superseded by the resulting request.
- A hold can be released by the holding coordinator; the record is retained with status Released and the period becomes available again.
- A hold is released automatically when the event is cancelled (F4).
- A hold creates no confirmed booking and does not by itself allow the event to become Confirmed (F5).
- Holds do not expire in this release; a hold remains active until it is converted, released, or the event is cancelled.
```

---

## 12. M2 — Reject a venue booking request

**ADD LINE**

*Add:* `The requesting coordinator and the owning organiser are notified of the rejection, including the reason and any suggested alternative.`

*Before:* `The event's own status is unchanged, and the coordinator can submit a further request for another venue or period.`

---

## 13. N1 — Prevent double-booking of a venue

**REPLACE LINE**

*Find:* `Overlap is evaluated with the single rule in Section 1; two bookings where one ends exactly when the other begins are not treated as overlapping and are both permitted.`

*Replace:* `Two periods overlap when one starts before the other ends and ends after the other starts. Two bookings where one ends exactly when the other begins merely touch, are not treated as overlapping, and are both permitted.`

---

## 14. P1 — Check whether enough equipment is available for a period

**REPLACE LINE**

*Find:* `Overlap uses the single rule in Section 1.`

*Replace:* `Two periods overlap when one starts before the other ends and ends after the other starts; periods that merely touch do not overlap.`

---

## 15. Q2 — Release an equipment reservation

**REPLACE LINE**

*Find:* `A reservation is released when Technical Support Staff release it with a reason, when its request line is cancelled, or when the event is cancelled (F3).`

*Replace:* `A reservation is released when Technical Support Staff release it with a reason, when its request line is cancelled, or when the event is cancelled, as part of the release run in F4.`

**Why:** F3 was split into F3 (cancellation decision) and F4 (the actual release orchestration). Q2 wasn't in the original revised-stories list, but it still pointed at F3 for the release behaviour that now lives in F4 — left as-is, whoever builds this could wire up a second, duplicate release path straight off the cancellation event instead of calling F4.

---

## 16. R1 — Browse events open for registration

**REPLACE LINE**

*Find:* `Each entry shows event name, description, date, start and end time, venue name and location, and — when a registration capacity is set — the number of places remaining.`

*Replace:* `Each entry shows event name, description, date, start and end time, venue name and location, and the number of places remaining, derived from the capacity of the booked venue for the booked layout (R2).`

**Why:** R1 wasn't in the original revised-stories list either, but its sibling story R2 now states capacity is always derived from the booked venue, never a separate optional field. R1's old wording ("when a registration capacity is set") describes a field that no longer exists.

---

## 17. R2 — Register for an event

**REPLACE DESCRIPTION**

```
User Story: As an Attendee, I want to register for an event, so that my place is reserved.

Acceptance Criteria
- A successful registration is stored with the attendee, the event, status Registered, and the registration timestamp, and the attendee sees a confirmation.
- The number of places is derived from the capacity of the booked venue for the booked layout, less any attendees added manually (R7). There is no separately entered registration capacity, and expected attendance does not cap registration.
- The capacity check and the registration are atomic: when two attendees register simultaneously for the last remaining place, exactly one registration is created.
- The unsuccessful attempt creates no registration record, leaves places remaining unchanged, returns a message naming capacity as the cause, and offers the attendee a place on the waitlist (R6).
- A second registration by the same attendee for the same event is refused, no second record is created, and the message names the existing registration.
- Registration is accepted within the registration window set by the Event Organiser for that event — from the opening instant up to and including the closing instant — and refused outside it, naming the window as the cause.
- On success, places remaining decreases by exactly one; on any refusal it is unchanged.
- The attendee receives a registration confirmation notification.
```

---

## 18. R4 — Withdraw my registration

**REPLACE DESCRIPTION**

```
User Story: As an Attendee, I want to withdraw my registration, so that my place is freed for someone else when I cannot attend.

Acceptance Criteria
- An attendee can withdraw only their own registration, and only while its status is Registered.
- On withdrawal the registration status becomes Withdrawn and the withdrawal timestamp is recorded; the record is retained, not deleted.
- Places remaining for the event increases by exactly one on a successful withdrawal, and any waitlisted attendees are notified that a place has become available (R6).
- Withdrawal is refused after the withdrawal deadline recorded for that event, with a message naming the deadline as the cause; the status and places remaining are unchanged. The deadline is set by the Event Organiser per event; where none is set, withdrawal is permitted up to the event's start date/time.
- The attendee receives confirmation of the withdrawal, and the owning organiser sees the updated totals (R5).
- Registering again after withdrawing creates a new registration and is subject to the same capacity and registration-window rules as R2.
```

---

## 19. R6 — Join and be invited from the waitlist

**CREATE** in the epic for Feature 18 — Attendee Registration.

**Summary:** `R6 — Join and be invited from the waitlist`

**Description:**

```
User Story: As an Attendee, I want to join a waitlist when an event is full, so that I have a chance of a place if one becomes available.

Acceptance Criteria
- When registration is refused because no places remain, the attendee is offered a place on the waitlist; joining stores the attendee, the event, status Waitlisted, and the timestamp.
- An attendee cannot hold both an active registration and a waitlist entry for the same event, and a second waitlist entry for the same attendee and event is refused.
- Waitlist entries are retained in the order they were created, and that order is visible to the owning organiser and assigned coordinator.
- Promotion is not automatic. When a place becomes available — through a withdrawal (R4), a capacity increase, or a manual release — waitlisted attendees are notified that a place is open and invited to apply; no registration is created on their behalf.
- An invited attendee registers through R2 and is subject to the same capacity, duplicate, and registration-window rules; places are taken on a first-come basis among those invited.
- An attendee can leave the waitlist at any time; the entry is retained with status Withdrawn and the attendee is not notified of further openings.
- Waitlist entries do not consume places and are never counted as registrations in the totals shown in R5.
- When an event is cancelled, active waitlist entries become Cancelled and each waitlisted attendee is notified.
```

---

## 20. R7 — Add an attendee manually

**CREATE** in the epic for Feature 18 — Attendee Registration.

**Summary:** `R7 — Add an attendee manually`

**Description:**

```
User Story: As an Event Organiser, I want to add a VIP attendee myself after registration is full, so that someone who must attend is not shut out by the registration process.

Acceptance Criteria
- Only the owning organiser or the assigned coordinator can add an attendee manually, and only to an event they manage.
- A manual addition is permitted even when no registration places remain and when the registration window has closed.
- A manual addition is refused when it would take the total number of attendees above the capacity of the booked venue for the booked layout; the refusal names the venue capacity and the current total, and creates no record.
- A manual addition is refused when the event has no confirmed venue booking, because the capacity ceiling is not yet known.
- The registration is stored with status Registered, marked as manually added, and records who added it, when, and an optional reason.
- Manually added attendees appear in the organiser's registration list (R5) distinguishable from self-registered attendees, and are included in the totals and in the places-remaining calculation (R2).
- A duplicate manual addition for an attendee who already holds an active registration is refused and names the existing registration.
- The added attendee receives a notification and can withdraw their own registration under the same terms as R4.
```

---

## 21. S3 — Reconsider arrangements affected by an approved change

**REPLACE DESCRIPTION**

```
User Story: As an Event Coordinator, I want existing bookings, reservations, and registrations to be flagged when a significant change is approved, so that I can decide what to re-arrange rather than having the system decide for me.

Acceptance Criteria
- On approval of a change to date, time, expected attendance, venue requirements, or equipment requirements, the system lists every confirmed venue booking, equipment reservation, and the active registration count for that event.
- A confirmed venue booking whose period no longer matches the event's new date/time is set to Requires Reconfirmation; the booked period is not moved automatically and the venue is not released for the old period.
- An equipment reservation whose period no longer matches the event's new required window is flagged for review; its reserved quantity is not released until Technical Support Staff release it (Q2).
- When the new expected attendance exceeds the capacity of the booked venue for the booked layout, the booking is flagged unsuitable with the two compared values shown.
- The event's status is not changed by flagging. An event that was Confirmed remains Confirmed and is displayed with its outstanding flags; no status transition is performed automatically. Any change of status is made by the assigned Event Coordinator through an action defined elsewhere (F1), after agreeing the new arrangement with the Event Organiser outside the system.
- Every outstanding flag is visible on the event to the owning organiser, the assigned coordinator, and Event Coordinators, each stating which arrangement is affected and why.
- An event that is not currently Confirmed cannot become Confirmed while any arrangement carries a Requires Reconfirmation or unsuitable flag (F5 readiness rule); the refusal names the outstanding flags.
- Venue Staff for the affected booking and Technical Support Staff for the affected reservations are notified, as are attendees with an active registration.
- Where the change is approved but flagging fails, the change is not applied and no arrangement is altered.
```

---

## 22. T1 — Receive notifications about events relevant to me

**DELETE — do not hard-delete.** Instead:

1. Transition T1 to `Won't Do` (or your board's equivalent closed-unresolved status).
2. Add this comment: `Superseded. T1 enumerated fifteen notification triggers in one story, which made it an epic that could not be completed until every other feature existed. Each trigger is now an acceptance criterion on the story that raises it (B1, D2–D5, E1, E2, F3, F4, L1, M1, M2, O2, Q2, R2, R4, R6, R7, S1, S2). The cross-cutting rules — what a notification record contains, who may receive one, and that it is created in the same operation as its trigger — have moved to T2.`
3. Do not delete the issue; the history is evidence of backlog refinement.

---

## 23. T2 — Read and manage my notifications

**REPLACE DESCRIPTION**

```
User Story: As a ConnectSphere user, I want to see my unread notifications in one place, so that I can act on the ones that matter.

Note: the individual notification triggers are specified as acceptance criteria on the stories that raise them (B1, D2-D5, E1, E2, F3, F4, L1, M1, M2, O2, Q2, R2, R4, R6, R7, S1, S2). This story specifies what a notification record is and how a user reads and manages their own.

Acceptance Criteria
- Each notification records the recipient, the notification type, the related event reference (and booking, reservation, or registration reference where applicable), the creation timestamp, and a message stating what happened and to which event.
- Only users with a relationship to the event receive its notifications: the owning organiser, the assigned coordinator, the relevant Venue Staff, the relevant Technical Support Staff, and, where the notification concerns them, registered and waitlisted attendees.
- A notification is created as part of the same operation as the triggering action; if the triggering action does not complete, no notification exists.
- The stored notification record is the source of truth; no notification is stated to be delivered within any particular time, and the delivery channel is not specified by this story.
- The notification list shows the signed-in user's own notifications, newest first, with an unread count.
- A notification can be marked read individually, and all can be marked read in one action; read state is held per user.
- Read state persists across sessions.
- Opening a notification navigates to the related event when the user still has access to it; when access has been lost, a message is shown and no event data is displayed.
- Notifications belonging to other users are never shown.
```

---

## Report back

After applying, report: items updated, items created, items closed, and any *Find* string that did not match.
