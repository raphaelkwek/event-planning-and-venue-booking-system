# Permission policies (A2)

**Author:** Joash · **Jira:** EN-07.1 (SPM-163) · **Decision:** ADR-0010

These [Cerbos](https://docs.cerbos.dev) policies are the single list of who may do what, as A2's first criterion requires. The gateway, the services and the staff console's navigation will all ask the same policies. Wiring them in comes after EN-12 (gateway) and as each module adopts them; until then, handlers still check roles with `requireRole`. Keep the two in step.

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
| `heldById` | booking_request | releasing a hold (L3) |
| `attendeeId` | registration | `registrant` (R3, R4, R6) |

## A2: function to rule

| Story | Function | Resource and action | Who |
|---|---|---|---|
| B1, C1 | Create a request or draft | event `create` | Event Organiser |
| C2 | Edit or submit a draft | event `update_draft`, `submit_draft` | its owner |
| C3, D1, F2 | Open an event | event `view` | its owner; Coordinators, Venue Staff, Tech Support (rows per A3); Attendees only if open for registration (R1) |
| F2, D2, E2 | History, clarifications, proposals | event `view_history`, `view_clarifications`, `view_reassignments` | its owner (history, clarifications); Coordinators |
| D1, D2, D4, D5 | Review, ask, approve, reject | event `review`, `request_clarification`, `approve`, `reject` | Event Coordinator |
| D3 | Answer a clarification | event `respond_to_clarification` | its owner |
| E2 | Propose reassignment | event `propose_reassignment` | the assigned coordinator only |
| E2 | Accept or decline | event `respond_to_reassignment` | the nominated coordinator only |
| F3 | Cancel | event `cancel` | owner or assigned coordinator |
| F5, S2 | Confirm; decide a change | event `confirm`, `decide_change` | the assigned coordinator |
| G1 | Edit non-significant details | event `update_details` | owner or assigned coordinator |
| G2, S3 | Impact of a change | event `preview_change_impact`, `reconsider_arrangements` | Event Coordinator |
| S1 | Request a change | event `request_change` | its owner |
| H1 | Maintain venues | venue `create`, `update`, `deactivate` | Venue Staff |
| H1, H2, I1 | Read venues and the calendar | venue `view`, `view_calendar` | every internal role, never Attendees |
| I2 | Record unavailability | venue `record_unavailability`, `remove_unavailability` | Venue Staff |
| J1, J2, K1, K2 | Search and assess venues | venue `search`, `check_suitability`, `justify_unsuitable` | Event Coordinator |
| L1, L2, L3 | Request, withdraw, hold | booking_request `create`, `withdraw`, `place_hold` | the assigned coordinator |
| L3 | Release a hold | booking_request `release_hold` | the coordinator who holds it |
| A3, M1, M2, N2 | See and decide bookings | booking_request `view`, `approve`, `reject`, `view_conflicts` | Venue Staff of that venue (`view` also for Coordinators) |
| O1 | Record equipment lines | equipment_request_line `create`, `update`, `remove` | the assigned coordinator |
| O2, P1, Q1, Q2 | Arrange equipment | equipment_request_line `update_status`, `check_availability`, `reserve`, `release` | Tech Support |
| P2 | Maintain inventory | equipment_type `create`, `update`, `record_unavailability` | Tech Support only |
| R2, R6 | Register, join the waitlist | registration `create`, `join_waitlist` | Attendee |
| R3, R4, R6 | My registration | registration `view`, `withdraw`, `leave_waitlist` | that attendee |
| R5 | See an event's registrations | registration `view` | owner or assigned coordinator |
| R7 | Add an attendee manually | registration `add_manually` | owner or assigned coordinator |

F4 has no action of its own. Releasing a cancelled event's arrangements happens inside the cancel workflow (ADR-0009).

## Running the tests

```sh
npm run policies:test
```

`backend/scripts/cerbos.ts` downloads the pinned Cerbos release, checks its SHA-256 against the release's `checksums.txt`, caches it under `node_modules/.cache/cerbos/`, and runs `cerbos compile policies`, which also runs every test suite. No Docker.

**On Windows** Cerbos publishes no build, so the script says so and exits. CI runs the same command on every pull request (the "Permission policy tests" step). To run it locally, use WSL: `wsl --install -d Ubuntu`, then run the command inside it.
