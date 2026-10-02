# Customer change requests

**Author:** Joash · **Maintained by:** the Product Owner (PX-07, PX-14)

One entry per customer change, following the course's *Managing Changes* guide:
1. the change, why it's needed, and its type;
2. the backlog;
3. the acceptance criteria;
4. story points;
5. design documentation;
6. test cases.

Answers to the customer questions raised here go in `documentation/clarifications.md`. The stories themselves are in `final user stories.md` (revision 4).

**Handling rule (guide scenario 2):** a Done story stays Done. New behaviour gets a new story, and the Done story notes what superseded it. An incomplete story has its acceptance criteria updated in place, marked ⚠ REVISED.

---

## Week 7 changes (received 2 Oct 2026)

**Source:** `Week 7 Customer Changes.pdf`. All six are required for Release 1 (Week 12), and the customer expects no further changes.

**Timing:** the changes arrived in the last week of Sprint 2 (which ends 6 Oct), so they're planned at Sprint 3 planning. The new stories go to the backlog unestimated and are pulled in at Sprint 3 and Sprint 4 planning after poker (PX-02).

**Two earlier decisions are reversed, on the record:**
- setup and turnaround buffers were out of scope (`plan.md` §1);
- coordinators could see all events (A3).

### CR-01: Setup and turnaround time

| | |
|---|---|
| **Change** | Each venue has a configurable setup time and turnaround time, included when checking availability and detecting conflicts. An event from 10:00 to 12:00 with 30 minutes' setup and 45 minutes' turnaround occupies the venue from 09:30 to 12:45. Bookings that become problematic under the new rule are identified, not silently removed. |
| **Why** | Venue Staff need time to prepare each room before an event and to reset it afterwards. Checking only the advertised times double-books that time. |
| **Type** | New requirement. It reverses the earlier "buffers out of scope" decision. |
| **Backlog** | New: **H3**, set setup and turnaround time and flag the bookings that now conflict. Revised: H1, I1, I2, J1, L3, M1, N1, N2 (overlaps are checked on the *occupied* period). |
| **Acceptance criteria** | In H3. The revised stories now compare occupied periods. Their other criteria still hold, including "touching periods don't overlap", which now applies to the occupied periods. |
| **Story points** | Estimate H3. Re-estimate the revised stories only if the team judges the overlap change material; it's one rule applied in one place (EN-02.1). |
| **Design** | ADR-0006 already reserves `blocked_period = [start − setup, end + turnaround)` and builds the exclusion constraint on it, so the change is data, not structure. New: buffer changes flag conflicts rather than rewriting stored periods, since rewriting would break the constraint. Data model: `venue.venues` gains `setup_minutes` and `turnaround_minutes`. |
| **Tests** | Unit: the occupied-period calculation, including the customer's own example. Integration: the exclusion constraint on buffered periods, and touching buffered periods allowed. Functional: H3's cases. Regression: N1's race test re-run with buffers. |

### CR-02: Venue becomes unavailable after booking

| | |
|---|---|
| **Change** | Venue Staff mark a venue temporarily unavailable (maintenance, equipment failure, renovation, safety, other), even when future events are booked. Events aren't cancelled. The affected bookings are identified, their coordinators are told alternative arrangements are needed, and the coordinator can search for and request a replacement venue while the event's information is kept. |
| **Why** | Operational problems don't wait for empty calendars. |
| **Type** | Mostly a **clarification** of I2, which already creates the block, flags the disrupted bookings and keeps the event (clarification C-12). Requesting the replacement *in the system* is a **new requirement**: I2 had said that resolution happens outside it. |
| **Backlog** | New: **L5**, request a replacement venue for a disrupted booking. Revised: I2 (reason categories; the notification says alternative arrangements are required; replacement through L5), J1 and M1 (replacing). |
| **Acceptance criteria** | I2's other criteria remain valid. Its "resolved outside the system" criterion is replaced by L5. |
| **Story points** | Estimate L5. Re-estimate I2 only if the team finds the change material. |
| **Design** | A booking request gains a `replaces_booking_id` link. Approving the replacement releases the disrupted booking with the reason "replaced". Sequence: block, flag, notify, search, request, approve, release. |
| **Tests** | Functional: L5's cases and I2's revised cases. Integration: the disrupted booking is kept until its replacement is approved, and stays if the replacement is rejected. |

### CR-03: Several venues for one event

| | |
|---|---|
| **Change** | One event can have several venue bookings at once (for example an auditorium plus three breakout rooms). Each is checked separately for suitability, availability and conflicts, and changing or cancelling one leaves the others alone unless that's explicitly required. |
| **Why** | ConnectSphere now runs larger events that use several spaces at once. |
| **Type** | New requirement. |
| **Backlog** | New: **L4**, book more than one venue for an event. Revised: F5 and F4 (all bookings), K1 (per booking), L1, L3 (one hold per venue), R2 and R7 (whose capacity: CQ-04), S3 (per booking). |
| **Acceptance criteria** | L1 already records layout, attendance, facilities and accessibility *per request*, and already allows requests for different venues. So each venue is judged against its own request, which keeps K1 testable. F5's "a confirmed venue booking" becomes "every active booking, at least one" (CQ-05). |
| **Story points** | Estimate L4. Re-estimate F5, R2 and R7 once CQ-04 and CQ-05 are answered. |
| **Design** | `venue_slots` is already one row per booking, carrying `event_id`. The event-to-booking relationship becomes one-to-many everywhere: the readiness read (F5), cancellation (F4) and impact flags (S3). C4: no change. Class or data model: event 1..* booking. |
| **Tests** | Integration: two venues booked for one event; rejecting one leaves the other; cancelling the event releases both. Functional: L4's cases. Regression: F5 and F4. |

### CR-04: Tentative holds expire

| | |
|---|---|
| **Change** | Every hold has an expiry date and time. If it's not converted or released by then, it expires and the venue becomes available. The coordinator is told before or at expiry, and an expired hold is never treated as a booking. |
| **Why** | Holds shouldn't reserve a venue indefinitely. |
| **Type** | New requirement. It replaces L3's explicit criterion "holds do not expire in this release". |
| **Backlog** | New: **L6**, tentative holds expire. Revised: L3 (its no-expiry criterion is replaced, and the one-hold limit becomes one per venue under CR-03). |
| **Acceptance criteria** | L3's other criteria remain valid. Who places holds, and who sets the expiry, is CQ-06. |
| **Story points** | Estimate L6. L3 is unchanged in size apart from the expiry field. |
| **Design** | A durable timer: the `HoldExpiry` Temporal workflow (ADR-0009, EN-11), with a reminder before expiry. Until EN-11 lands, a sweep job like F1's completion sweep. Hold statuses gain Expired. |
| **Tests** | Unit: expiry boundary (exactly at expiry). Integration: an expired hold frees the slot, and the reminder fires once. Functional: L6's cases. |

### CR-05: Event Coordinator Lead

| | |
|---|---|
| **Change** | A new role oversees incoming requests. New submissions go to an **unassigned queue** for the Lead, who assigns a coordinator and can reassign. Coordinators manage only their assigned events. The Lead sees all assignments and active events, and the people concerned are notified of every assignment and reassignment. |
| **Why** | ConnectSphere introduced the role to oversee and balance coordinators' work. |
| **Type** | New requirement. It changes the behaviour of Done stories E1 (automatic assignment), E2 (peer reassignment), A3 (coordinators see all events) and D1 (the queue). |
| **Backlog** | New: **E3** (the unassigned queue and the Lead assigning), **E4** (the Lead reassigns), **E5** (the Lead's oversight), **A4** (coordinators act only on their assigned events). E1, E2, A3 and D1 stay Done, each with a note naming its successor (guide scenario 2). |
| **Acceptance criteria** | Done stories' criteria aren't edited. The new stories state the new behaviour, and where one replaces a Done criterion it says so. Whether peer reassignment (E2) stays is CQ-07. |
| **Story points** | Estimate E3, E4, E5 and A4. Don't re-estimate the Done stories. |
| **Design** | New role `EVENT_COORDINATOR_LEAD` in contracts `ROLES`, the identity seed, the Cerbos policies (and their tests, which require every role to have a permission), A2's navigation and the C4 model. `resolveAccessScope`: Coordinator goes from ALL to ASSIGNED, and Lead gets ALL. The RLS work (EN-07.2) follows. `submitEvent` stops allocating by round-robin, and `EVENT_COORDINATOR_POOL` is retired. API: queue and assignment endpoints in the OpenAPI spec. |
| **Tests** | Regression: the E1, E2, A3 and D1 tests are updated in the same PR as the behaviour change, each noting the new story. Functional: the E3, E4, E5 and A4 cases. Policy tests: the Lead and coordinator matrix. |

### CR-06: Operational Safety Check

| | |
|---|---|
| **Change** | A new role, the Safety Officer, reviews an event's operational safety after its venue and technical arrangements are confirmed. The review covers attendance, venue capacity and layout, emergency access, accessibility, equipment placement, crowd movement and venue restrictions. The Safety Officer approves, rejects the safety arrangement, or requests changes, which returns the event to an earlier planning stage. The event can't proceed to preparation until approved, and the Safety Officer always responds. |
| **Why** | ConnectSphere requires a safety review before events go ahead. |
| **Type** | New requirement. |
| **Backlog** | New: **U1**, conduct an Operational Safety Check (new feature 21). Revised: F1 (the status list gains **Safety Review**) and F5 (confirming the arrangements leads to Safety Review, and only the Safety Officer's approval leads to Confirmed). |
| **Acceptance criteria** | Proposed lifecycle: Planning, then F5, then **Safety Review**. From there, approve goes to **Confirmed** (ready for preparation) and request changes goes back to **Planning**. What "reject the safety arrangement" leads to is CQ-08. F1's other criteria remain valid, and the change has to be agreed with F1's assignee. |
| **Story points** | Estimate U1. F1 and F5 have more work remaining; re-estimate it if the team judges it material. |
| **Design** | New role `SAFETY_OFFICER` (contracts, identity, Cerbos, navigation, C4). Status machine: one new status and three transitions. Owned by the change and readiness module, alongside F5. Sequence diagram: confirm arrangements, safety review, then approve, request changes or reject. Where emergency access and venue restrictions are recorded is CQ-10. |
| **Tests** | Unit: the new transitions in the status machine (domain stays at 100% coverage). Functional: U1's cases. Regression: F1's and F5's cases with the new status. |

---

## Customer questions raised by the Week 7 changes

These go to the customer through the PO. Record each answer in `clarifications.md`, and only then update the affected story.

| Id | Question | Affects |
|---|---|---|
| CQ-04 | When an event uses several venues, which capacity limits registrations: a designated main venue, the total of all its venues, or another rule? | R2, R7 (CR-03) |
| CQ-05 | Must *every* active venue booking be confirmed before an event can be confirmed, or is one enough? | F5 (CR-03) |
| CQ-06 | Who places a tentative hold, Venue Staff or the assigned coordinator? Who sets the expiry, is there a default or maximum, and how long before expiry should the reminder go out? | L3, L6 (CR-04) |
| CQ-07 | Does coordinator-to-coordinator reassignment (E2) remain alongside the Lead's? May a coordinator still *view* events that aren't assigned to them? | E2, E4, A4 (CR-05) |
| CQ-08 | What does "reject the safety arrangement" lead to: is the event rejected, or sent back like "request changes"? Which earlier stage does "request changes" return to, and do the venue and equipment bookings stay in place meanwhile? | U1, F1 (CR-06) |
| CQ-09 | Do setup and turnaround times also apply to tentative holds and unavailability blocks, and must the buffered period fit inside the venue's operating hours? | H3, I2, L3 (CR-01) |
| CQ-10 | Are emergency access and known venue restrictions new details on the venue record, maintained by Venue Staff? | H1, H3, U1 (CR-06) |
