# ConnectSphere — Final User Stories

**Revision 3.** Incorporates the customer clarification set and the INVEST review. 54 stories across 20 feature areas.

Markers used below: ⚠ **REVISED** — changed by a customer clarification; ⚠ **NEW** — story added after the clarifications; ⚠ **SPLIT** — story divided so each half can be finished in one sprint.

Changes in this revision: T1 removed (its fifteen notification triggers are now acceptance criteria on the stories that raise them; the record and recipient rules moved to T2). F3 split into F3 and F4. F1 split into F1 and F5. L3, R6, and R7 added. Stories A2, A3, B2, E1, E2, F1, I2, R2, R4, and S3 revised. The former "Section 1" shared definitions have been inlined into the acceptance criteria that used them; the Definition of Done now lives in `implementation.md` §8.3.

Sprint allocation is in `plan.md` §10 and `sprint-reallocation.csv`.

---

### **Feature 1 — User Authorisation and Authentication**

#### **A1 — Log in and start a role-scoped session**

**User Story:** As a registered user, I want to log in with my credentials, so that I can access the ConnectSphere functions that belong to my role.

**Acceptance Criteria**

* A user with valid credentials is authenticated and a session is created that carries their role (Event Organiser, Event Coordinator, Venue Staff, Technical Support Staff, or Attendee).  
* An incorrect email or an incorrect password is rejected with the same message ("email or password is incorrect") so the message does not reveal which field was wrong.  
* A rejection caused by a deactivated account is distinguishable from a rejection caused by wrong credentials.  
* On a failed login attempt no session is created and no last-login timestamp is recorded.  
* On successful login the last-login timestamp and the authenticated user are recorded.  
* Logging out ends the session; navigating back to a protected page afterwards does not display any event data.

#### **A2 — Restrict functions to the roles permitted to use them**

**User Story:** As a ConnectSphere user, I want the system to stop me performing actions that belong to another role, so that I cannot damage an event by doing something I was never meant to do.

**Acceptance Criteria**

* Every protected function has a defined list of the roles permitted to invoke it, and the same list governs what the interface offers and what the server accepts.  
* An attempt by a user whose role is not permitted is refused: the action does not execute, no record is created or modified, and the message states that the user's role is not authorised for that function.  
* The refusal applies to a direct URL or API call, not only to hidden menu items.  
* Navigation shows only the functions the signed-in user's role is permitted to use.  
* An unauthenticated request to any protected function is refused and returns no event, venue, equipment, or registration data.

#### **A3 — See only the events I am related to**

**User Story:** As a ConnectSphere user, I want to see only the events I own, am assigned to, or am registered for, so that information about other people's events stays confidential.

**Acceptance Criteria**

* An Event Organiser's event list contains only events where that organiser is the recorded owner.  
* An Event Coordinator's list contains **all events in the system**, regardless of which coordinator is assigned, with the events assigned to them distinguishable from the rest. ⚠ **REVISED — coordinators can see all events**
* Venue Staff see booking requests and confirmed bookings for their own venues, and the event details needed to assess them (name, timing, expected attendance, layout, requirements) — not the full internal event record.  
* Technical Support Staff see equipment requests and reservations, and the event timing they depend on.  
* An Attendee sees only events with registration enabled that are open to them, and only published fields — coordinator notes, review comments, clarification threads, and rejection reasons are excluded.  
* Filtering is applied when the list is retrieved, so a request for an event outside the user's relationship returns no event data at all.

---

### **Feature 2 — Event Request Creation**

#### **B1 — Create and submit an event request**

**User Story:** As an Event Organiser, I want to submit an event request with all the information ConnectSphere needs, so that a coordinator can review my event without asking me for basics.

**Acceptance Criteria**

* The request captures event name, purpose, description, proposed date, proposed start and end time, expected attendance, venue requirements, accessibility needs, equipment requirements, and whether attendee registration is required.  
* On a successful submission the request is stored with status Submitted, and the submitting organiser, submission timestamp, and a unique event reference are recorded and shown to the organiser.  
* The submitting organiser is recorded as the owner of the event.  
* The submitted request appears in the Event Coordinator review queue.  
* On submission the assigned coordinator (E1) is notified that a new event request is awaiting review.  
* If submission fails validation, no event record is created, no submission timestamp is recorded, and the entered values are preserved on screen.

#### **B2 — Validate an event request before it is submitted**

**User Story:** As an Event Coordinator, I want submitted requests to be checked for completeness and internal consistency, so that I do not spend review time on requests that were never fit to review.

**Acceptance Criteria**

* Submission is blocked unless event name, purpose, description, proposed date, start time, end time, expected attendance, and the registration-required flag are all populated.  
* When submission is blocked, the message names every field that caused the rejection, not just the first one.  
* The end date/time must be later than the start date/time; an equal or earlier end time is rejected and the message identifies this as the reason.  
* The proposed start date/time must not be in the past at the moment of submission.  
* Expected attendance must be a whole number greater than zero. It is a planning figure used for venue suitability and capacity evaluation only, and does not cap attendee registration. ⚠ **REVISED — registration is governed by venue capacity**  
* When registration is required, the registration opening and closing date/times are mandatory, the closing must be later than the opening, and the closing must be no later than the event start. No registration capacity is entered: the cap is derived from the capacity of the booked venue for the booked layout (R2). ⚠ **REVISED**  
* An equipment-required flag is mandatory. When it is set to "none required", that counts as a complete equipment arrangement for the purposes of confirmation (F5). ⚠ **NEW — equipment readiness gates confirmation**  
* A blocked submission leaves the request at status Draft (or unsaved), creates no submission record, and changes no other stored value.

---

### **Feature 3 — Draft Event Requests**

#### **C1 — Save an incomplete event request as a draft**

**User Story:** As an Event Organiser, I want to save an event request before it is complete, so that I can gather missing details without losing what I have already entered.

**Acceptance Criteria**

* A request can be saved once the event name is present; every other field may be empty.  
* The saved record has status Draft and stores the owning organiser and a last-saved timestamp.  
* The submission validation rules in B2 are not applied on save, except that any date or time that is entered must be a valid date or time.  
* A draft does not appear in the Event Coordinator review queue and is not visible to any user other than its owner.  
* If the save fails, the previously saved version of the draft is unchanged and the last-saved timestamp is not updated.

#### **C2 — Resume, edit and submit a draft**

**User Story:** As an Event Organiser, I want to reopen and continue editing my draft, so that I can finish and submit the request later.

**Acceptance Criteria**

* Opening one of my own drafts restores every previously saved field with the exact value that was saved.  
* Saving an edited draft updates the last-saved timestamp and retains status Draft.  
* Submitting from a draft applies the full validation in B2; on success the status changes Draft → Submitted and the submission timestamp is recorded.  
* After submission the request is no longer editable through the draft screen (further changes go through G1 or S1).  
* A user who is not the owning organiser cannot open, edit, or submit the draft, and receives no draft content.

#### **C3 — Tell drafts apart from submitted requests**

**User Story:** As an Event Organiser, I want my drafts to be clearly distinguishable from requests I have already submitted, so that I do not think an unfinished request is under review.

**Acceptance Criteria**

* The organiser's event list shows the status of every request, with Draft visually distinct from Submitted and later statuses.  
* The list can be filtered to show only drafts or only submitted-and-later requests.  
* A draft row shows its last-saved date/time; a submitted row shows its submission date/time.  
* A draft row displays no assigned coordinator, no review outcome, and no event reference number.

---

### **Feature 4 — Event Review and Approval**

#### **D1 — Review the queue of submitted event requests**

**User Story:** As an Event Coordinator, I want to see and open the event requests awaiting a decision, so that I can review them in the order they arrived.

**Acceptance Criteria**

* The queue lists every event with status Submitted, Under Review, or Awaiting Clarification that has no recorded decision.  
* Each row shows event reference, event name, proposed date and time, expected attendance, submitting organiser, submission timestamp, and current status.  
* The queue is ordered by submission timestamp, oldest first, by default.  
* Opening a request shows the full submitted content in read-only form, including accessibility, venue, and equipment requirements.  
* Opening a request with status Submitted changes it to Under Review and records the reviewing coordinator and the timestamp.  
* If the request is already Under Review by another coordinator, the name of that coordinator is displayed and the reviewer on the record is not overwritten.  
* Requests with status Draft never appear in the queue.

#### **D2 — Request clarification from the organiser**

**User Story:** As an Event Coordinator, I want to ask the organiser for clarification or amendments, so that I can decide on the request without rejecting it outright.

**Acceptance Criteria**

* A clarification message is mandatory and must contain at least one non-whitespace character; an empty message is refused, no message is stored, and the event status is unchanged.  
* On sending, the event status changes to Awaiting Clarification and the requesting coordinator and timestamp are recorded.  
* The message is stored against the event and is visible to the owning organiser and to Event Coordinators; it is not visible to Attendees or Venue Staff.  
* The organiser receives a notification identifying the event and the fact that clarification is required.  
* Multiple clarification messages on the same event are retained in order rather than overwriting each other.

#### **D3 — Respond to a clarification request**

**User Story:** As an Event Organiser, I want to answer the coordinator's clarification and amend my request, so that the review can continue.

**Acceptance Criteria**

* The organiser can see any outstanding clarification message on their own event.  
* The organiser can reply with a message, amend the request fields, or both; a response with neither is refused and no timestamp is recorded.  
* On response the event status returns to Under Review and the response timestamp is recorded.  
* The values as originally submitted are retained in the event history alongside the amended values.  
* The coordinator who requested the clarification is notified that the organiser has responded.  
* An organiser who does not own the event cannot view or answer the clarification.

#### **D4 — Approve an event request**

**User Story:** As an Event Coordinator, I want to approve an event request, so that planning for the event can begin.

**Acceptance Criteria**

* Approve is available only when the event status is Under Review or Awaiting Clarification.  
* On approval the status changes to Approved and the approving coordinator and approval timestamp are recorded.  
* The approval outcome and its date are visible to the owning organiser.  
* The organiser receives a notification of the approval.  
* Approval alone creates no venue booking and no equipment reservation.  
* An event that already carries a recorded decision cannot be approved again: the action is unavailable and no second approval timestamp is written.

#### **D5 — Reject an event request**

**User Story:** As an Event Coordinator, I want to reject a request that cannot be supported, with a reason, so that the organiser understands the outcome.

**Acceptance Criteria**

* Rejection requires a reason of at least one non-whitespace character; without it the rejection is not performed, the status is unchanged, and no rejection timestamp is recorded.  
* On rejection the status changes to Rejected and the reason, rejecting coordinator, and timestamp are recorded.  
* The reason is visible to the owning organiser.  
* The organiser receives a notification of the rejection.  
* A rejected event cannot be edited or resubmitted; its fields become read-only. ⚠ (see clarification C-04)

---

### **Feature 5 — Coordinator Assignment**

#### **E1 — Get a named coordinator as soon as I submit**

**User Story:** As an Event Organiser, I want a coordinator assigned to my event as soon as I submit it, so that I know who to contact without waiting for someone to pick my request up. ⚠ **REVISED — assignment is automatic**

**Acceptance Criteria**

* Assignment happens automatically as part of the submission of an event request (B1); no user chooses the assignee and there is no manual assignment screen.  
* Only active users holding the Event Coordinator role are eligible for automatic assignment.  
* Exactly one coordinator is assigned per event. The allocation rule is applied consistently to every event and is recorded with the assignment so any given outcome can be explained.  
* On assignment the assigned coordinator, the allocation rule applied, and the assignment timestamp are recorded.  
* The assigned coordinator's name is shown to the owning organiser as the point of contact.  
* An event has at most one active assigned coordinator at any time; a second active assignment is never created.  
* The newly assigned coordinator receives a notification identifying the event.  
* If no eligible coordinator exists, the event is still submitted and recorded as awaiting assignment; it is not rejected, and it is visible to all Event Coordinators (A3).

#### **E2 — Reassign an event to a different coordinator**

**User Story:** As the assigned Event Coordinator, I want to hand an event over to a colleague who has accepted it, so that coordination continues when I am unavailable and no event is left with an owner who did not agree to it. ⚠ **REVISED — reassignment requires acceptance**

**Acceptance Criteria**

* Only the currently assigned coordinator can propose a reassignment, and only for events not in status Completed, Cancelled, or Rejected.  
* A proposal records the proposing coordinator, the nominated coordinator, the proposal timestamp, and an optional reason; the nominated user must hold the Event Coordinator role.  
* The nominated coordinator receives a notification and can accept or decline the proposal.  
* **Until the proposal is accepted the outgoing coordinator remains the assigned coordinator** and retains every coordinator action on the event; the nominated coordinator gains no coordinator actions while the proposal is pending.  
* On acceptance the outgoing assignment is closed with an end timestamp and retained in the assignment history, and the new assignment is recorded with the accepting coordinator and a start timestamp. Only then can the new coordinator perform coordinator actions and the previous coordinator no longer can.  
* On decline the assignment is unchanged, the declining coordinator and timestamp are recorded, and the proposing coordinator is notified.  
* An event has at most one pending reassignment proposal; a second proposal is refused and names the pending one.  
* On acceptance the owning organiser sees the updated point of contact and both coordinators are notified.  
* Proposing a reassignment to the coordinator who is already assigned is refused and creates no history entry.

---

### **Feature 6 — Event Status Management**

#### **F1 — Trust that an event's status reflects what has actually happened**

**User Story:** As an Event Coordinator, I want an event's status to change only when something real has happened to it, so that I can rely on the status when deciding what to work on next.

**Acceptance Criteria**

* The permitted statuses are exactly: Draft, Submitted, Under Review, Awaiting Clarification, Approved, Planning, Confirmed, Completed, Cancelled, Rejected.  
* Status can only be changed by an action defined in another story; there is no screen that lets a user type or pick an arbitrary status.  
* An attempted transition that is not permitted from the current status is refused: no status change is stored, and the message names the current status and the attempted target.  
* Every status change writes a history entry containing previous status, new status, the acting user, their role, the timestamp, and the triggering action.  
* An event reaches Confirmed only through the confirmation action specified in F5, which defines the conditions that must hold. This story defines that Confirmed is a permitted status and that reaching it writes a history entry like any other transition. ⚠ **SPLIT — the readiness conditions moved to F5**  
* An event moves to Completed only after its recorded end date/time has passed.

#### **F2 — View an event's current status and history**

**User Story:** As a user related to an event, I want to see its current status and how it got there, so that I know what stage the event has reached.

**Acceptance Criteria**

* The current status is shown on the event detail screen for every user permitted to view the event.  
* Internal roles (Event Organiser for their own event, assigned Event Coordinator, and Event Coordinators generally) can see the full status history.  
* Attendees see the current status only, and never the history, review comments, or rejection reasons.  
* History entries are listed in chronological order and each shows previous status, new status, acting user's role, and timestamp.  
* History entries cannot be edited or deleted from any screen.

#### **F3 — Cancel an event**

**User Story:** As an Event Organiser, I want to cancel my event, so that everyone involved knows it will not go ahead.

**Acceptance Criteria**

* Cancellation can be performed by the owning organiser or the assigned coordinator, for events not in status Completed, Rejected, or Cancelled. There is no deadline: cancellation may be requested at any point.  
* A cancellation reason is mandatory; without it the event status is unchanged and nothing is released.  
* On cancellation the status becomes Cancelled and the reason, acting user, and timestamp are recorded.  
* The cancelled event remains visible to the users related to it, showing the reason and the cancellation date.  
* A cancelled event cannot be edited, submitted, or have new bookings, reservations, or registrations raised against it.  
* The owning organiser, the assigned coordinator, the Venue Staff of any booked venue, and the Technical Support Staff of any reserved equipment are notified of the cancellation.  
* Releasing the event's arrangements is specified separately in F4.

#### **F4 — Release the arrangements of a cancelled event**

**User Story:** As an Event Coordinator, I want a cancelled event's venue, equipment, and attendee places to be freed together, so that nothing stays committed to an event that will not happen and no attendee is left thinking they have a place.

**Acceptance Criteria**

* Release is triggered by the cancellation of an event (F3), and runs for every confirmed booking, tentative hold, equipment reservation, and active registration belonging to that event.  
* Confirmed venue bookings and tentative holds for the event are released, and the venue becomes available again for the corresponding period in the calendar (I1) and in venue search (J1).  
* Equipment reservations for the event are released, and the reserved quantities return to availability for the corresponding period.  
* Active attendee registrations and waitlist entries become Cancelled, and each affected attendee receives a notification.  
* **All-or-nothing:** if any release step fails, the cancellation is not recorded and no booking, hold, reservation, or registration is left partially released; the event remains in its pre-cancellation status and the acting user is told the cancellation did not complete.  
* Released bookings and reservations are retained with status Released rather than deleted, each recording the release reason, acting user, and timestamp.  
* Releasing an arrangement that is already released changes no quantity and writes no second release timestamp, so a retried cancellation produces the same end state.

#### **F5 — Confirm an event only when venue and equipment are ready** ⚠ **NEW — split from F1; both arrangements must be complete**

**User Story:** As an assigned Event Coordinator, I want to confirm an event only once both the venue and the equipment are actually arranged, so that a Confirmed event is one I can rely on rather than one that is still missing something.

**Acceptance Criteria**

* Confirmation is performed by the assigned Event Coordinator, on an event in status Approved or Planning.  
* Confirmation is refused unless a confirmed venue booking exists for the event. A tentative hold (L3) is not sufficient.  
* Confirmation is refused unless the event's equipment arrangements are complete: every equipment request line reserved in full, or the event marked as requiring no equipment, which counts as complete. A partially reserved line is not complete.  
* Both conditions are read live from the venue booking record and the equipment reservation records at the moment of confirmation; a stored or cached readiness value is never used.  
* If either the booking or the reservation information cannot be retrieved, confirmation is refused and nothing is changed.  
* A refusal names which of the two arrangements is outstanding, and for equipment names the specific lines that are not reserved in full.  
* Confirmation is refused while any arrangement for the event carries a Requires Reconfirmation or unsuitable flag (I2, S3); the refusal names the outstanding flags.  
* On success the status becomes Confirmed and the acting coordinator and timestamp are recorded, with a history entry written as for any other transition (F1).  
* The owning organiser is notified of the confirmation, as are the Venue Staff of the booked venue and the Technical Support Staff of any reservation.  
* A refused confirmation changes no status, no booking, and no reservation.

---

### **Feature 7 — Event Information Management**

#### **G1 — Update non-significant event information**

**User Story:** As an assigned Event Coordinator, I want to update descriptive event information during planning, so that the record stays accurate without disturbing arrangements already made.

**Acceptance Criteria**

* The owning organiser and the assigned coordinator can edit event purpose, description, accessibility notes, and contact details while the event is in status Approved, Planning, or Confirmed.  
* The significant fields — event date, start/end time, expected attendance, venue requirements, and equipment requirements — are not editable on this screen; attempting to edit them directs the user to the change-request process and stores no value.  
* Each saved edit records the editing user, the timestamp, and the before and after value of each changed field.  
* An edit attempted by a user who is neither the owner nor the assigned coordinator is refused and stores no value and no history entry.  
* If the save fails, no field is changed and no history entry is written.

#### **G2 — Warn which arrangements a significant change would affect**

**User Story:** As an Event Coordinator, I want to see which existing arrangements a proposed significant change would affect, so that I can weigh the consequences before deciding on it.

**Acceptance Criteria**

* The list of significant fields is held in one place and used by both the edit screen (G1) and the change-request screens (S1, S2).  
* When a change request touches a significant field, the review screen lists the confirmed venue booking, equipment reservations, and count of active registrations for that event, read from the booking, reservation, and registration records.  
* For each listed arrangement the screen states specifically why it is affected (for example, the booked period no longer matches the proposed date/time, or proposed attendance exceeds the booked venue's capacity for the booked layout).  
* No booking, reservation, or registration is altered while the change request is only being viewed.

---

### **Feature 8 — Venue Catalogue**

#### **H1 — Maintain venue records**

**User Story:** As a Venue Staff member, I want to create and update the record for my venue, so that coordinators plan against accurate venue information.

**Acceptance Criteria**

* A venue record holds name, building/location, maximum capacity, supported room layouts with the capacity for each layout, facilities, accessibility features, and operating hours per day of week.  
* Maximum capacity and each per-layout capacity must be whole numbers greater than zero, and at least one layout must be recorded.  
* Only Venue Staff can create or update venue records; Event Coordinators, Event Organisers, and Technical Support Staff have read access only, and an update attempt by them changes nothing.  
* Each create or update records the acting user and the timestamp, and retains the previous values of changed fields.  
* Marking a venue inactive removes it from venue search results for future dates while retaining its existing bookings, its history, and its visibility on the availability calendar.  
* A rejected update leaves every stored venue field unchanged.

#### **H2 — View full venue details**

**User Story:** As an Event Coordinator, I want to see everything recorded about a venue, so that I can judge it against my event's requirements.

**Acceptance Criteria**

* The venue detail screen shows every catalogue attribute listed in H1, read from the venue catalogue.  
* Accessibility features are listed individually rather than as a single yes/no indicator.  
* Each supported layout is shown with its own capacity, so a coordinator can see that capacity varies by layout.  
* Operating hours are shown per day of week.  
* Attendees cannot access the venue catalogue screens.

---

### **Feature 9 — Venue Availability Calendar**

#### **I1 — View a venue's availability calendar**

**User Story:** As an Event Coordinator, I want to see when a venue is already committed, so that I request a period the venue can actually offer.

**Acceptance Criteria**

* An internal user selects a venue and a date range and sees each day's committed and free periods.  
* Confirmed bookings are shown as unavailable, labelled with the event reference.  
* Pending booking requests are shown in a visually distinct state from confirmed bookings and are labelled as pending.  
* Recorded unavailability (maintenance, closure) is shown with its recorded type or reason.  
* Periods outside the venue's recorded operating hours are shown as unavailable.  
* After a booking is approved, rejected, withdrawn, or released, the calendar reflects the new state when it is next loaded.  
* Attendees have no access to the calendar.

#### **I2 — Record a period of venue unavailability**

**User Story:** As a Venue Staff member, I want to record periods when my venue cannot be used — including periods that are already booked — so that coordinators know an arrangement has been disrupted and can re-plan it. ⚠ **REVISED — see clarification C-12**

**Acceptance Criteria**

* A block records venue, start date/time, end date/time, and a reason or type, all mandatory.  
* The end must be later than the start; otherwise no block is created and the message identifies this as the cause.  
* A block that overlaps an existing confirmed booking (two periods overlap when one starts before the other ends and ends after the other starts; periods that merely touch do not overlap) **is created**. Venue Staff are shown, before confirming, each confirmed booking the block would disrupt, with its booking reference, event reference, and overlapping period.  
* Each disrupted confirmed booking is set to Requires Reconfirmation and records the blocking reason, the acting Venue Staff member, and the timestamp.  
* The block does not cancel or release a disrupted booking: the booking record is retained, the venue is not released for the booked period, and the corresponding event's status is unchanged. Resolution is initiated by the assigned Event Coordinator, who agrees a new arrangement with the Event Organiser outside the system and records it through the normal change path (S1, S2, L1).  
* The assigned Event Coordinator of each disrupted event receives a notification naming the venue, the booking reference, the event reference, the blocked period, and the recorded reason.  
* Pending booking requests and tentative holds overlapping the block are flagged in the same way, and the requesting coordinator is notified.  
* A created block makes the venue unavailable for that period in both the calendar (I1) and venue search (J1), so no new request can be raised for it.  
* Creating and removing a block each record the acting user and timestamp. Removing a block restores availability for that period, clears the Requires Reconfirmation flag on any booking disrupted only by that block, and notifies the affected coordinators.  
* A failed block creation leaves availability for the period unchanged, flags no booking, and sends no notification.

---

### **Feature 10 — Venue Search and Filtering**

#### **J1 — Filter venues against event requirements**

**User Story:** As an Event Coordinator, I want to filter venues by my event's requirements, so that I only consider venues that could actually host it.

**Acceptance Criteria**

* Filters available are: date and time window, minimum capacity, location/building, required accessibility features, required room layout, and required facilities.  
* Only venues satisfying every selected filter are returned; a venue missing one required facility is excluded.  
* Venues with a confirmed booking or recorded unavailability overlapping the requested window are excluded, using the overlap rule above, read from the venue's confirmed bookings, tentative holds, recorded unavailability, and operating hours.  
* Venues marked inactive are excluded.  
* Capacity filtering uses the capacity of the required layout when a layout filter is selected, and the venue maximum capacity otherwise.  
* When no venue matches, the result is an empty list with a message restating the filters that were applied — not an error.  
* When the search is opened from an event, the date, time, minimum capacity, accessibility, layout, and facility filters are pre-filled from that event's recorded requirements and remain editable.

#### **J2 — Search venues by name or location**

**User Story:** As an Event Coordinator, I want to search for a venue by name or building, so that I can go straight to a venue I already have in mind.

**Acceptance Criteria**

* A partial, case-insensitive match on venue name or building returns every matching active venue.  
* The text search can be combined with the filters in J1, and the result satisfies both.  
* Each result row shows venue name, building, maximum capacity, and key facilities.  
* An empty search term with no filters returns all active venues rather than an error.

---

### **Feature 11 — Venue Suitability Checking**

#### **K1 — See whether a venue is suitable for an event, and why not**

**User Story:** As an Event Coordinator, I want the system to tell me whether a venue suits my event and what fails, so that I do not request a venue that cannot host the event.

**Acceptance Criteria**

* For a selected event and venue the screen shows one of: Suitable, Suitable with warnings, or Not suitable.  
* Not suitable is shown when expected attendance exceeds the capacity of the selected layout, a required facility is absent, a required accessibility feature is absent, or the requested period falls outside the venue's operating hours.  
* Every failing condition is listed separately with the specific values compared (for example, expected attendance 150 against layout capacity 120\) — a single generic message is not sufficient.  
* All compared values are read from the event record and the venue catalogue; the coordinator does not re-enter them.  
* The indicator is advisory: displaying it creates, changes, or blocks no booking record.  
* When no failing condition exists, the result is Suitable and no reasons are listed.

#### **K2 — Justify booking a venue flagged as unsuitable**

**User Story:** As an Event Coordinator, I want to record a justification when I proceed with an unsuitable venue, so that Venue Staff can see why the request was made anyway.

**Acceptance Criteria**

* Proceeding from a Suitable or Suitable-with-warnings result requires no justification.  
* Proceeding from a Not suitable result requires a justification of at least one non-whitespace character; without it no booking request is created.  
* The justification is stored with the booking request together with the failing conditions as evaluated at the time of the request, the coordinator, and the timestamp.  
* The justification and the failing conditions are shown to Venue Staff on the pending request.

---

### **Feature 12 — Venue Booking Request**

#### **L1 — Submit a venue booking request**

**User Story:** As an assigned Event Coordinator, I want to request a venue for my event, so that Venue Staff can assess and confirm it.

**Acceptance Criteria**

* Only the coordinator assigned to the event can raise a booking request for that event.  
* The request records venue, date, start and end time, room layout, expected attendance, and the required facilities and accessibility features.  
* The date, times, and expected attendance default from the event record; if the coordinator changes any of them, the request is flagged as differing from the event and the differing values are shown to Venue Staff.  
* On success the request is stored with status Pending and records the requesting coordinator, the timestamp, and a unique booking reference.  
* The request appears in the queue for that venue's Venue Staff, appears as pending on the availability calendar, and triggers a notification to the venue's staff.  
* A second pending request for the same event, venue, and overlapping period is refused, naming the existing pending booking reference.  
* A refused request creates no booking record and changes no venue availability.

#### **L2 — Withdraw a pending booking request**

**User Story:** As an assigned Event Coordinator, I want to withdraw a pending venue request, so that Venue Staff are not asked to assess a request I no longer need.

**Acceptance Criteria**

* Only the assigned coordinator for the event can withdraw that event's pending request.  
* Withdrawal is available only while the request status is Pending; approved or rejected requests offer no withdraw action.  
* On withdrawal the status becomes Withdrawn and the acting user and timestamp are recorded; the request record is retained, not deleted.  
* The withdrawn request no longer appears in the Venue Staff queue and no longer appears as pending on the calendar.  
* Withdrawal does not change the event's status.

#### **L3 — Place a tentative hold on a venue** ⚠ **NEW — tentative holding is in scope**

**User Story:** As an assigned Event Coordinator, I want to hold a venue and time slot while the event is still being planned, so that it is not taken by another event before the booking request is decided.

**Acceptance Criteria**

* Only the coordinator assigned to the event can place a hold, and only for an event not in status Completed, Cancelled, or Rejected.  
* A hold records the venue, date, start and end time, the event, the holding coordinator, and the timestamp.  
* At most one active tentative hold **or** confirmed booking exists for a given venue and period: a hold is refused when the period overlaps an existing hold or confirmed booking (two periods overlap when one starts before the other ends and ends after the other starts), and the refusal names the conflicting reference and period. Two events can never hold the same venue and period.  
* Holds are allocated first-come, first-served. There is no override, appeal, or priority rule, and no user can displace an existing hold or confirmed booking.  
* An event has at most one active hold at a time; placing a second is refused and names the existing one.  
* A held period is shown as held on the availability calendar (I1), labelled with the event reference, and is excluded from venue search results for that period (J1).  
* A hold can be converted into a booking request (L1) for the same venue and period without re-checking availability, and is superseded by the resulting request.  
* A hold can be released by the holding coordinator; the record is retained with status Released and the period becomes available again.  
* A hold is released automatically when the event is cancelled, as part of the release run in F4.  
* A hold creates no confirmed booking and does not by itself allow the event to become Confirmed (F5).  
* Holds do not expire in this release; a hold remains active until it is converted, released, or the event is cancelled.

---

### **Feature 13 — Venue Booking Approval**

#### **M1 — Approve a venue booking request**

**User Story:** As a Venue Staff member, I want to approve a booking request for my venue, so that the event has a confirmed place to be held.

**Acceptance Criteria**

* The queue shows pending requests for the approver's own venues with booking reference, event reference, requested date and period, layout, expected attendance, requesting coordinator, and any unsuitability justification from K2.  
* Approval sets the request status to Approved, creates a confirmed booking for the venue and period, and records the approving Venue Staff member and the timestamp.  
* Approval is refused when the requested period now overlaps a confirmed booking or recorded unavailability; the message names the conflicting record, no confirmed booking is created, and the request stays Pending.  
* A confirmed booking makes the venue unavailable for that period in the calendar (I1) and excludes it from search for that period (J1).  
* The requesting coordinator and the owning organiser receive a notification of the approval.  
* An already-decided request cannot be approved again and no second approval timestamp is written.

#### **M2 — Reject a venue booking request**

**User Story:** As a Venue Staff member, I want to reject a booking request with a reason, so that the coordinator can plan an alternative.

**Acceptance Criteria**

* Rejection requires a reason of at least one non-whitespace character; without it the request stays Pending and no rejection timestamp is recorded.  
* Suggested alternative dates or venues may optionally be recorded with the rejection.  
* On rejection the request status becomes Rejected and the reason, approver, and timestamp are recorded and shown to the requesting coordinator.  
* The venue remains available for the requested period and the request is removed from the pending state on the calendar.  
* The requesting coordinator and the owning organiser are notified of the rejection, including the reason and any suggested alternative.  
* The event's own status is unchanged, and the coordinator can submit a further request for another venue or period.

---

### **Feature 14 — Booking Conflict Detection**

#### **N1 — Prevent double-booking of a venue**

**User Story:** As a Venue Staff member, I want the system to prevent overlapping confirmed bookings for a venue, so that two events are never promised the same room at the same time.

**Acceptance Criteria**

* Two periods overlap when one starts before the other ends and ends after the other starts. Two bookings where one ends exactly when the other begins merely touch, are not treated as overlapping, and are both permitted.  
* Confirmation of a booking is atomic: when two approvals for overlapping periods at the same venue are processed simultaneously, exactly one results in a confirmed booking and the other is refused.  
* The refused approval creates no confirmed booking, leaves its request Pending, and returns a message naming the conflicting event reference and period.  
* The existing confirmed booking is unchanged by a refused competing approval.  
* Bookings with status Withdrawn, Rejected, Cancelled, or Released never block a new booking for the same period.  
* The same overlap rule is applied by venue search exclusion (J1), unavailability blocks (I2), and booking approval (M1).

#### **N2 — Flag potential conflicts before a decision is made**

**User Story:** As a Venue Staff member, I want pending requests that clash with other bookings to be flagged, so that I can decide between them deliberately rather than first-come-first-served.

**Acceptance Criteria**

* Each pending request in the queue is flagged when its period overlaps another pending request or a confirmed booking for the same venue.  
* The flag names each conflicting booking reference and its period.  
* The requesting coordinator sees the same flag on their own pending request.  
* The flag is recalculated whenever a booking for that venue is created, approved, rejected, withdrawn, or released.  
* The flag is informational: its presence alone neither approves nor rejects any request.

---

### **Feature 15 — Equipment Request Management**

#### **O1 — Record the equipment an event requires**

**User Story:** As an assigned Event Coordinator, I want to record the equipment my event needs, so that Technical Support Staff know what to arrange.

**Acceptance Criteria**

* A request is made of line items; each line records equipment type, quantity, technical requirements/notes, and the required-from and required-to date/time.  
* Required-from and required-to default from the event's date and times and remain editable; required-to must be later than required-from.  
* Quantity must be a whole number greater than zero.  
* On save each line has status Submitted and is visible to Technical Support Staff, and the requesting coordinator and timestamp are recorded.  
* Lines may be edited or removed by the assigned coordinator while their status is Submitted or Under Review; a line with status Reserved cannot be edited or removed here.  
* Removing a line records the acting user, the timestamp, and the equipment type and quantity removed.  
* A rejected save creates or changes no line item.

#### **O2 — Update an equipment request as arrangements are made**

**User Story:** As a Technical Support Staff member, I want to update the status of each requested equipment line, so that the coordinator knows what will be provided.

**Acceptance Criteria**

* A line status can be set to Under Review, Confirmed, Unavailable, or Substituted, and each change records the acting staff member and the timestamp.  
* Setting a line to Unavailable requires a reason; without it the status is unchanged and no equipment is reserved.  
* Setting a line to Substituted records the originally requested type and quantity together with the substitute type and quantity; the original values are not overwritten.  
* The assigned coordinator receives a notification identifying the event, the equipment line, and the new status.  
* A status change that fails leaves the line status, notes, and any reservation unchanged.

---

### **Feature 16 — Equipment Availability Checking**

#### **P1 — Check whether enough equipment is available for a period**

**User Story:** As a Technical Support Staff member, I want to see how many units of an equipment type are free for the event's period, so that I only promise equipment we actually have.

**Acceptance Criteria**

* Available quantity is calculated as total units of that type, minus units reserved for events whose reservation period overlaps the requested period, minus units recorded unavailable over an overlapping period.  
* Two periods overlap when one starts before the other ends and ends after the other starts; periods that merely touch do not overlap.  
* The result states the available quantity as a number, not only a yes/no answer.  
* When the requested quantity exceeds the available quantity, the shortfall quantity is shown.  
* Units recorded as unavailable (for example under maintenance) are never counted as available, regardless of whether they are reserved.  
* Performing the check creates no reservation and changes no quantity.

#### **P2 — Maintain equipment inventory and unavailability**

**User Story:** As a Technical Support Staff member, I want to maintain the equipment inventory and mark units out of service, so that availability figures reflect reality.

**Acceptance Criteria**

* An equipment type records a name, description, technical characteristics, and total quantity held; total quantity must be zero or greater.  
* Units can be marked unavailable for a stated period with a mandatory reason; the end of the period must be later than the start.  
* Reducing the total quantity below the quantity already reserved for any overlapping period is refused, and the message names the affected event references and reserved quantities; the total quantity is unchanged.  
* Every inventory or unavailability change records the acting user, the timestamp, and the previous and new quantity.  
* Only Technical Support Staff can change inventory; a change attempted by another role stores nothing.

---

### **Feature 17 — Equipment Reservation**

#### **Q1 — Reserve equipment for an event**

**User Story:** As a Technical Support Staff member, I want to reserve equipment for an event, so that it is held for that event and cannot be promised to another.

**Acceptance Criteria**

* A reservation records the event, equipment type, quantity reserved, reservation start and end date/time, the acting staff member, and the timestamp; the linked request line's status becomes Reserved.  
* The reservation is atomic with respect to the availability check: when two reservations for overlapping periods are processed simultaneously and only one unit remains, exactly one succeeds.  
* The unsuccessful attempt creates no reservation, changes no quantity, and returns a message naming insufficient availability and the shortfall.  
* After a successful reservation the available quantity for any overlapping period is reduced by exactly the quantity reserved.  
* A quantity smaller than the requested quantity may be reserved only when explicitly chosen, and the reservation records the quantity actually reserved rather than the quantity requested.  
* Reserving more than the available quantity is refused and no partial reservation is silently created.

#### **Q2 — Release an equipment reservation**

**User Story:** As a Technical Support Staff member, I want reservations to be released when they are no longer needed, so that the equipment can be used by other events.

**Acceptance Criteria**

* A reservation is released when Technical Support Staff release it with a reason, when its request line is cancelled, or when the event is cancelled, as part of the release run in F4.  
* On release the reserved quantity returns to the available quantity for the corresponding period.  
* The reservation record is retained with status Released and records the releasing user, timestamp, and reason; it is not deleted.  
* Releasing a reservation that is already Released changes no quantity and writes no second release timestamp.  
* The assigned coordinator receives a notification when a reservation for their event is released.

---

### **Feature 18 — Attendee Registration**

#### **R1 — Browse events open for registration**

**User Story:** As an Attendee, I want to see the events I can register for, so that I can choose which to attend.

**Acceptance Criteria**

* The list contains only events with registration enabled and status Confirmed, whose registration closing date/time has not passed.  
* Each entry shows event name, description, date, start and end time, venue name and location, and the number of places remaining, derived from the capacity of the booked venue for the booked layout (R2).  
* Internal information (review comments, clarification threads, coordinator notes, booking and equipment records) is not shown.  
* An event whose places remaining is zero is shown with a Full label and offers no register action.  
* Events that are Draft, Submitted, Under Review, Approved, Planning, Rejected, or Cancelled do not appear.

#### **R2 — Register for an event**

**User Story:** As an Attendee, I want to register for an event, so that my place is reserved.

**Acceptance Criteria**

* A successful registration is stored with the attendee, the event, status Registered, and the registration timestamp, and the attendee sees a confirmation.  
* The number of places is derived from the capacity of the booked venue for the booked layout, less any attendees added manually (R7). There is no separately entered registration capacity, and expected attendance does not cap registration. ⚠ **REVISED — capacity comes from the venue**  
* The capacity check and the registration are atomic: when two attendees register simultaneously for the last remaining place, exactly one registration is created.  
* The unsuccessful attempt creates no registration record, leaves places remaining unchanged, returns a message naming capacity as the cause, and offers the attendee a place on the waitlist (R6). ⚠ **REVISED**  
* A second registration by the same attendee for the same event is refused, no second record is created, and the message names the existing registration.  
* Registration is accepted within the registration window set by the Event Organiser for that event — from the opening instant up to and including the closing instant — and refused outside it, naming the window as the cause. ⚠ **REVISED — window is at the organiser's discretion (supersedes C-10)**  
* On success, places remaining decreases by exactly one; on any refusal it is unchanged.  
* The attendee receives a registration confirmation notification.

#### **R3 — View my own registrations**

**User Story:** As an Attendee, I want to see the events I have registered for and my status for each, so that I know where I stand.

**Acceptance Criteria**

* The list shows every registration belonging to the signed-in attendee with event name, date, time, venue location, and registration status (Registered, Withdrawn, or Cancelled).  
* Registrations belonging to other attendees are never shown, including by direct reference.  
* When an event is cancelled, the attendee's registration is shown as Cancelled.  
* Each entry shows the timestamp of the registration and, where applicable, of the withdrawal.

#### **R4 — Withdraw my registration**

**User Story:** As an Attendee, I want to withdraw my registration, so that my place is freed for someone else when I cannot attend.

**Acceptance Criteria**

* An attendee can withdraw only their own registration, and only while its status is Registered.  
* On withdrawal the registration status becomes Withdrawn and the withdrawal timestamp is recorded; the record is retained, not deleted.  
* Places remaining for the event increases by exactly one on a successful withdrawal, and any waitlisted attendees are notified that a place has become available (R6).  
* Withdrawal is refused after the withdrawal deadline recorded for that event, with a message naming the deadline as the cause; the status and places remaining are unchanged. The deadline is set by the Event Organiser per event; where none is set, withdrawal is permitted up to the event's start date/time. ⚠ **REVISED — withdrawal terms are at the organiser's discretion (supersedes C-11)**  
* The attendee receives confirmation of the withdrawal, and the owning organiser sees the updated totals (R5).  
* Registering again after withdrawing creates a new registration and is subject to the same capacity and registration-window rules as R2.

#### **R5 — View the registrations for an event I manage**

**User Story:** As an Event Organiser, I want to see who has registered for my event, so that I can plan for the people who will attend.

**Acceptance Criteria**

* The owning organiser and the assigned coordinator can view the registration list for that event; other users cannot, and receive no registration data.  
* Each row shows the attendee's name, the registration timestamp, and the current registration status.  
* Totals are shown for registered, withdrawn, and places remaining, derived from the registration records.  
* A withdrawal is reflected in both the row status and the totals when the list is next loaded.

#### **R6 — Join and be invited from the waitlist** ⚠ **NEW — waitlist, with manual promotion**

**User Story:** As an Attendee, I want to join a waitlist when an event is full, so that I have a chance of a place if one becomes available.

**Acceptance Criteria**

* When registration is refused because no places remain, the attendee is offered a place on the waitlist; joining stores the attendee, the event, status Waitlisted, and the timestamp.  
* An attendee cannot hold both an active registration and a waitlist entry for the same event, and a second waitlist entry for the same attendee and event is refused.  
* Waitlist entries are retained in the order they were created, and that order is visible to the owning organiser and assigned coordinator.  
* **Promotion is not automatic.** When a place becomes available — through a withdrawal (R4), a capacity increase, or a manual release — waitlisted attendees are notified that a place is open and invited to apply; no registration is created on their behalf.  
* An invited attendee registers through R2 and is subject to the same capacity, duplicate, and registration-window rules; places are taken on a first-come basis among those invited.  
* An attendee can leave the waitlist at any time; the entry is retained with status Withdrawn and the attendee is not notified of further openings.  
* Waitlist entries do not consume places and are never counted as registrations in the totals shown in R5.  
* When an event is cancelled, active waitlist entries become Cancelled and each waitlisted attendee is notified.

#### **R7 — Add an attendee manually** ⚠ **NEW — manual VIP addition**

**User Story:** As an Event Organiser, I want to add a VIP attendee myself after registration is full, so that someone who must attend is not shut out by the registration process.

**Acceptance Criteria**

* Only the owning organiser or the assigned coordinator can add an attendee manually, and only to an event they manage.  
* A manual addition is permitted even when no registration places remain and when the registration window has closed.  
* A manual addition is refused when it would take the total number of attendees above the capacity of the booked venue for the booked layout; the refusal names the venue capacity and the current total, and creates no record.  
* A manual addition is refused when the event has no confirmed venue booking, because the capacity ceiling is not yet known.  
* The registration is stored with status Registered, marked as manually added, and records who added it, when, and an optional reason.  
* Manually added attendees appear in the organiser's registration list (R5) distinguishable from self-registered attendees, and are included in the totals and in the places-remaining calculation (R2).  
* A duplicate manual addition for an attendee who already holds an active registration is refused and names the existing registration.  
* The added attendee receives a notification and can withdraw their own registration under the same terms as R4.

---

### **Feature 19 — Event Change Requests**

#### **S1 — Request a change after submission**

**User Story:** As an Event Organiser, I want to request a change to my submitted event, so that it can reflect new circumstances without me starting again.

**Acceptance Criteria**

* A change request can be raised by the owning organiser for events with status Submitted or later, excluding Completed, Cancelled, and Rejected.  
* The request records the field or fields to change, the proposed new value of each, a mandatory reason, the requesting organiser, and the timestamp.  
* A snapshot of the current value of each affected field is stored with the request.  
* The event's own field values are unchanged while the request is Pending.  
* A second pending change request for the same event is refused, naming the existing pending request.  
* The assigned coordinator receives a notification identifying the event and the fields proposed for change.  
* A refused request stores nothing and changes no event field.

#### **S2 — Review and decide a change request**

**User Story:** As an assigned Event Coordinator, I want to approve or reject a change request, so that only changes ConnectSphere can support are applied.

**Acceptance Criteria**

* Only the assigned coordinator can decide the request, and only while its status is Pending.  
* Rejection requires a reason; without it the request stays Pending, no decision timestamp is recorded, and no event field changes.  
* On approval the event's fields are updated to the proposed values, and the event history records for each field the before value, the after value, the deciding coordinator, and the timestamp.  
* On rejection no event field changes and the stored snapshot values remain the event's live values.  
* The requesting organiser receives a notification of either outcome, including the rejection reason where applicable.  
* A request that already carries a decision offers no further approve or reject action.

#### **S3 — Reconsider arrangements affected by an approved change**

**User Story:** As an Event Coordinator, I want existing bookings, reservations, and registrations to be flagged when a significant change is approved, so that I can decide what to re-arrange rather than having the system decide for me. ⚠ **REVISED — see clarification C-13**

**Acceptance Criteria**

* On approval of a change to date, time, expected attendance, venue requirements, or equipment requirements, the system lists every confirmed venue booking, equipment reservation, and the active registration count for that event.  
* A confirmed venue booking whose period no longer matches the event's new date/time is set to Requires Reconfirmation; the booked period is not moved automatically and the venue is not released for the old period.  
* An equipment reservation whose period no longer matches the event's new required window is flagged for review; its reserved quantity is not released until Technical Support Staff release it (Q2).  
* When the new expected attendance exceeds the capacity of the booked venue for the booked layout, the booking is flagged unsuitable with the two compared values shown.  
* **The event's status is not changed by flagging.** An event that was Confirmed remains Confirmed and is displayed with its outstanding flags; no status transition is performed automatically. Any change of status is made by the assigned Event Coordinator through an action defined elsewhere (F1), after agreeing the new arrangement with the Event Organiser outside the system.  
* Every outstanding flag is visible on the event to the owning organiser, the assigned coordinator, and Event Coordinators, each stating which arrangement is affected and why.  
* An event that is **not** currently Confirmed cannot become Confirmed while any arrangement carries a Requires Reconfirmation or unsuitable flag (F5 readiness rule); the refusal names the outstanding flags.  
* Venue Staff for the affected booking and Technical Support Staff for the affected reservations are notified, as are attendees with an active registration.  
* Where the change is approved but flagging fails, the change is not applied and no arrangement is altered.

---

### **Feature 20 — Notification System**

*T1 has been removed: enumerating fifteen triggers in one story made it an epic that could not be finished until every other feature existed. Each trigger now lives as an acceptance criterion on the story that causes it.*

#### **T2 — Read and manage my notifications**

**User Story:** As a ConnectSphere user, I want to see my unread notifications in one place, so that I can act on the ones that matter.

*Note: the individual notification triggers are specified as acceptance criteria on the stories that raise them (B1, D2–D5, E1, E2, F3, F4, L1, M1, M2, O2, Q2, R2, R4, R6, R7, S1, S2). This story specifies what a notification record is and how a user reads and manages their own.*

**Acceptance Criteria**

* Each notification records the recipient, the notification type, the related event reference (and booking, reservation, or registration reference where applicable), the creation timestamp, and a message stating what happened and to which event.  
* Only users with a relationship to the event receive its notifications: the owning organiser, the assigned coordinator, the relevant Venue Staff, the relevant Technical Support Staff, and, where the notification concerns them, registered and waitlisted attendees.  
* A notification is created as part of the same operation as the triggering action; if the triggering action does not complete, no notification exists.  
* The stored notification record is the source of truth; no notification is stated to be delivered within any particular time, and the delivery channel is not specified by this story.  
* The notification list shows the signed-in user's own notifications, newest first, with an unread count.  
* A notification can be marked read individually, and all can be marked read in one action; read state is held per user.  
* Read state persists across sessions.  
* Opening a notification navigates to the related event when the user still has access to it; when access has been lost, a message is shown and no event data is displayed.  
* Notifications belonging to other users are never shown.

&nbsp;