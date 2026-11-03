# Permission policies (A2)

**Author:** Joash · **Jira:** EN-07.1 (SPM-163) · **Decision:** ADR-0010

These [Cerbos](https://docs.cerbos.dev) policies are the single list of who may do what, as A2's first criterion requires. Since EN-07 they are evaluated at request time: every planning-core route asks a Cerbos policy decision point (PDP) for its action (`requireRole("event", "approve")`), and the staff console's navigation asks `POST /api/v1/permissions/check`, which asks the same PDP. No route or screen lists roles any more. The gateway (EN-12) will ask the same PDP when it exists.

## Two rules of thumb

- **Cerbos answers *who*; the domain answers *when*.** Policies hold roles and relationships, such as owner, assigned coordinator or venue manager. Status rules like "not once Completed" or "only while Pending" stay in each module's `domain/` code, so they exist in exactly one place.
- **Cerbos decides actions; row-level security decides rows (A3).** "May a coordinator open an event?" is a policy. "Which events does this organiser see?" is a Postgres RLS policy (EN-07.2).

## Layout

```
derived_roles/connectsphere.yaml   owner, assigned_coordinator, nominated_coordinator, venue_manager, registrant
resources/<kind>.yaml              one policy per resource kind; each rule is named after its story
tests/<kind>_test.yaml             every role against every action; unlisted combinations must be denied
tests/testdata/                    the shared principals and resources the tests use
```

Role names come from `backend/packages/contracts` (`ROLES`). `contracts/tests/policyRoles.test.ts` fails if a policy uses any other name, or if a role has no permission at all.

## The attributes a caller must send

| Attribute | On | Used by |
|---|---|---|
| `ownerId` | every resource that belongs to an event | `owner` |
| `assignedCoordinatorId` | every resource that belongs to an event | `assigned_coordinator` |
| `pendingNomineeId` | event | `nominated_coordinator` (E2) |
| `registrationOpen` | event | attendees viewing an event (R1) |
| `venueStaffIds` | venue, booking_request | `venue_manager` (M1, M2, N2) |
| `attendeeId` | registration | `registrant` (R3, R4, R6) |

## A2: function to rule

| Story | Function | Resource and action | Who |
|---|---|---|---|
| B1, C1 | Create a request or draft | event `create` | Event Organiser |
| C2 | Open, edit or submit a draft | event `view_draft`, `update_draft`, `submit_draft` | its owner |
| R2, R4 | Set the registration window and withdrawal deadline | event `configure_registration` | its owner |
| C3, D1, F2 | Open an event | event `view` | its owner; the assigned coordinator (A4); Venue Staff, Tech Support (rows per A3); the Lead (E3, E5); Attendees only if open for registration (R1) |
| F2, D2, E2 | History, clarifications, proposals | event `view_history`, `view_clarifications`, `view_reassignments` | its owner (history, clarifications); the assigned coordinator (A4) |
| D1, D2, D4, D5 | Review, ask, approve, reject | event `review`, `request_clarification`, `approve`, `reject` | the assigned coordinator (A4) |
| D3 | Answer a clarification | event `respond_to_clarification` | its owner |
| E2 | Propose reassignment (retired by E4: the route answers 410) | event `propose_reassignment` | Event Coordinators |
| E2 | Accept or decline | event `respond_to_reassignment` | the nominated coordinator only |
| F3 | Cancel | event `cancel` | owner or assigned coordinator |
| F5, S2 | Confirm; decide a change | event `confirm`, `decide_change` | the assigned coordinator |
| U1 | View the safety queue and a review; record the safety decision | event `view_safety_queue`, `view_safety_review`, `decide_safety` | the Safety Officer |
| U1 | Mark an approved event Confirmed | event `mark_confirmed` | the assigned coordinator |
| G1 | Edit non-significant details | event `update_details` | owner or assigned coordinator |
| G2 | Impact of a change | event `preview_change_impact` | its owner; the assigned coordinator (A4) |
| S3 | Reconsider arrangements | event `reconsider_arrangements` | the assigned coordinator (A4) |
| S1 | Request a change | event `request_change` | its owner |
| H1, H3 | Add a venue; update or deactivate one | venue `create`; `update`, `deactivate` | Venue Staff; Venue Staff of that venue |
| H1, H2, I1 | Read venues and the calendar | venue `view`, `view_calendar` | Organisers, Coordinators, Venue Staff, Tech Support; never Attendees |
| I2 | See, record and remove unavailability | venue `view_unavailability`, `record_unavailability`, `remove_unavailability` | Venue Staff of that venue |
| J1, J2, K1, K2 | Search and assess venues | venue `search`, `check_suitability`, `justify_unsuitable` | Event Coordinator |
| L1, L2, L3 | Request, withdraw, hold | booking_request `create`, `withdraw`, `request_hold`, `convert_hold` | the assigned coordinator |
| L1, L2, L3 | An event's venue requests and holds | booking_request `list` | its owner; the assigned coordinator |
| L1, L3, M1 | The request and hold queues | booking_request `view_queue` | Venue Staff (rows: their venues) |
| L3 | Place a hold, set its expiry | booking_request `place_hold` | Venue Staff of that venue |
| L3 | Release a hold | booking_request `release_hold` | the assigned coordinator (A4), the new one after a reassignment |
| A3, M1, M2, N2 | See and decide bookings | booking_request `view`, `approve`, `reject`, `view_conflicts` | Venue Staff of that venue (`view` also for the assigned coordinator, A4) |
| O1 | Record equipment lines | equipment_request_line `create`, `update`, `remove`, `view` | the assigned coordinator (A4) |
| O2, P1, Q1, Q2 | Arrange equipment | equipment_request_line `update_status`, `check_availability`, `reserve`, `release` | Tech Support |
| P2 | Maintain inventory | equipment_type `create`, `update`, `record_unavailability` | Tech Support only |
| P1 | A type's availability over a period | equipment_type `check_availability` | Tech Support |
| B1, D1 | Name people by id | user `view` | every internal role, never Attendees |
| R2, R6 | Register, join the waitlist | registration `create`, `join_waitlist` | Attendee |
| R3, R4, R6 | My registration | registration `view`, `withdraw`, `leave_waitlist` | that attendee |
| R5 | See an event's registrations | registration `view` | owner or assigned coordinator |
| R7 | Add an attendee manually | registration `add_manually` | owner or assigned coordinator |

F4 has no action of its own. Releasing a cancelled event's arrangements happens inside the cancel workflow (ADR-0009).

## Running the PDP

```sh
npm run cerbos:start   # http://127.0.0.1:3592, which is CERBOS_URL's local value; npm run dev starts it too
```

`backend/cerbos/config.yaml` serves `policies/` from disk and reloads a policy when the file changes.
planning-core **fails closed** in production: if the PDP doesn't answer, every protected request is
refused with `503 POLICY_UNAVAILABLE`. In development only, if no PDP answers at `CERBOS_URL` when
planning-core starts (Windows without WSL, say), it evaluates these policies itself and logs
"LOCAL-POLICIES MODE"; see `documentation/evidence/EN-07/README.md`. In CI the integration job runs the PDP as a service container and the
Playwright stack runs the binary; each Kubernetes namespace has its own (EN-10).

**Adding an action:** add it to the resource's policy and its test here, then gate the route with
`requireRole("<kind>", "<action>")`. `routePermissions.unit.test.ts` fails on a route with no gate or an
action no policy grants, and the generated matrix (`authorisationMatrix.test.ts`) checks the route's
answers against the PDP for every role, on a related and an unrelated record.

## Running the tests

```sh
npm run policies:test
```

`backend/scripts/cerbos.ts` downloads the pinned Cerbos release, checks its SHA-256 against the release's `checksums.txt`, caches it under `node_modules/.cache/cerbos/`, and runs `cerbos compile policies`, which also runs every test suite. No Docker.

**On Windows** Cerbos publishes no build, so the script runs the Linux build inside WSL when a Linux distribution is installed (`wsl --install -d Ubuntu`); without one it says so and exits. CI runs the same command on every pull request (the "Permission policy tests" step).
