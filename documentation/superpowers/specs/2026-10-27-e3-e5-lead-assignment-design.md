# E3, E4, E5 — the Event Coordinator Lead assigns, reassigns and oversees

**Author:** Seann, via Claude · **Date:** 27 Oct 2026 · **Stories:** E3 (SPM-176), E4 (SPM-177),
E5 (SPM-178), from CR-05 (Week 7) and the Week 9 answers to CQ-07 (W9-20, W9-34, W9-35, W9-58,
W9-59, W9-60). The criteria are in `final user stories.md`, revision 5.

## 1. What changes

Today a submitted event gets a coordinator automatically (E1, round robin over a configured pool),
and a coordinator can hand an event to a colleague who accepts (E2). After these stories:

- a new role, **Event Coordinator Lead**, assigns every new request from an unassigned queue (E3);
- the Lead alone reassigns, immediately, with no acceptance (E4); E2's proposals are retired
  (W9-FX-5);
- the Lead sees every active event, every coordinator's load and each event's assignment history
  (E5).

The Lead does not coordinate events (W9-35). Several Leads may exist, each seeing everything
(W9-30, W9-57). Accounts and roles are pre-loaded, one role per account (W9-66).

## 2. The role

| Where | Change |
|---|---|
| `contracts` `ROLES` | adds `EVENT_COORDINATOR_LEAD`. **Shared contract: needs a second owner's review.** |
| identity migration `0003` | widens the role checks on `identity.user_roles` and `identity.role_policy`; adds the role's `role_policy` row |
| identity seed `0004`, `seed-auth-users.ts` | `lead@connectsphere.test`, user `00000000-…-0009`, auth user `10000000-…-0009`, the seeded test password |
| `resolveAccessScope` | `events` → `ALL` for the Lead (E5 sees every event); other resources → `NONE` |
| Cerbos | `event.yaml` gains `assign`, `reassign` and `view_assignments`, Lead only; tests cover every role |
| web | role label "Event Coordinator Lead"; home is the unassigned queue; navigation shows "Unassigned" and "Assignments" only |

The Lead is not in `requireRole("EVENT_COORDINATOR")` anywhere, so every coordinator action
refuses it (A2), and opening an event never claims it for review.

## 3. E3 — the unassigned queue and assigning

- **Submission no longer assigns** (B1, C2). `submitEvent` stops calling the round-robin
  allocation; the event is submitted with no active assignment. `allocateCoordinator`, its config
  (`EVENT_COORDINATOR_POOL`) and its cursor repo functions are removed; the
  `event.assignment_cursor` table stays (no destructive migration).
- **`GET /api/v1/assignments/unassigned`** (Lead only): every event not Draft, Completed, Cancelled
  or Rejected with no active assignment, oldest submission first, with reference, name, proposed
  start and end, expected attendance and submission time.
- **`GET /api/v1/coordinators`** (Lead only): the active users holding Event Coordinator, with
  display name and number of active assigned events. Identity owns who holds the role
  (`listActiveUsersWithRole` in its `index.ts`); the event module adds the counts.
- **`POST /api/v1/events/:id/assignment`** `{ coordinatorId }` (Lead only), in one transaction:
  - lock the event row; refuse Draft and the three terminal statuses (409);
  - refuse an event that already has an active assignment (409 `ALREADY_ASSIGNED`, naming the
    coordinator; E4 reassigns);
  - refuse a coordinator who is not an active Event Coordinator (400, nothing stored);
  - insert the assignment, `assignment_rule = 'LEAD'`, `created_by` = the Lead;
  - write `event.coordinator-assigned` with new optional fields `ownerId` and `assignedBy`; the
    notification rule tells the coordinator, as now, and the owner when `ownerId` is present.
  The `assignments_one_active_per_event` index still guarantees one active assignment if two Leads
  race; the loser gets the 409.
- **D1 for coordinators:** the review queue leaves out events with no active assignment, and a
  coordinator opening an unassigned Submitted event sees it but does not claim it for review. Only
  the Lead's queue holds unassigned requests. (Restricting coordinators to their *own* events is
  A4, which waits on CQ-11.)
- The organiser already sees "awaiting assignment" when there is no coordinator (E1's fallback).

## 4. E4 — reassigning as the Lead, and retiring E2

- **`POST /api/v1/events/:id/reassignment`** `{ coordinatorId }` (Lead only), in one transaction:
  - lock the event row and its active assignment; refuse Draft and terminal statuses (409);
  - refuse an event with no active assignment (409, use E3);
  - refuse the coordinator already assigned (409, no history entry);
  - refuse a coordinator who is not an active Event Coordinator (400);
  - close the active assignment (`ended_at`, `is_active = false`), insert the new one
    (`assignment_rule = 'LEAD'`, `created_by` = the Lead);
  - close a pending E2 proposal for the event, unaccepted: status `CLOSED` (migration `0010`
    widens the check), `resolved_at`;
  - write a new message `event.coordinator-reassigned` (contract and topic) naming the outgoing
    and new coordinators, the owner and the Lead; the notification rule tells all three, and the
    organiser's names the new point of contact by event.
- From then on the new coordinator holds every coordinator action that checks the assignment; the
  outgoing one does not. Nothing else changes: those checks already read the active assignment.
- **E2 retired (W9-FX-5):** proposing a reassignment is refused, 410 `REASSIGNMENT_RETIRED`, "The
  Event Coordinator Lead reassigns events." The web app drops "Propose reassignment". A proposal
  already pending may still be accepted or declined until the Lead reassigns the event, which
  closes it. E2's cards and records are not edited; its integration tests that proposed through
  the API now create the pending proposal in SQL, and a new test asserts the refusal. The
  FX-REASSIGNMENT-PENDING fixture (`tests/README.md`) becomes an SQL statement.

## 5. E5 — the overview

- **`GET /api/v1/assignments`** `?coordinatorId=` (Lead only): every active event (not Draft,
  Completed, Cancelled or Rejected) with reference, name, status and assigned coordinator, or
  none; and every active coordinator with their count of active assigned events. The filter keeps
  the events of one coordinator; the counts are always for all.
- **`GET /api/v1/events/:id/assignments`** (Lead only): the event's assignments, oldest first,
  each with the coordinator, who made it (`created_by`; E1's are shown as automatic), start and
  end.
- **Web:** "Assignments" lists the events, filters by coordinator, and shows each coordinator's
  count. An event opens `/assignments/:eventId`: its basic information, current coordinator,
  Assign or Reassign, and the assignment history. The same page serves E3's "open a request".
- No other role reaches these routes or the screen (A2).

## 6. Not in scope

- A4 (coordinators act and see only their own events) waits on CQ-11.
- The Lead coordinating events (W9-35 says it can't).
- Workload limits (W9-21: at the Lead's discretion).

## 7. Order of work

Three stacked branches, one PR each: E3 (role, queue, assign, coordinators), then E4 (reassign,
E2 retired), then E5 (overview, history, screen filter). Each follows the usual order: cards,
failing tests, code, runner, records, traceability, CHANGELOG.

Seeding the Lead account runs `npm run seed:auth` and the identity seed against the shared
project: it adds one test user and changes no existing data.
