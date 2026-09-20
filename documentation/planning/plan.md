# ConnectSphere — Architecture Plan

**Read this before writing any code.** It tells you which service your story belongs to, what that service is allowed to own, and how it may talk to the others. `implementation.md` tells you *how* to write it. If the two disagree, raise it in the team channel rather than picking one.

**Authoritative source:** `connectsphere.dsl` (Structurizr). This document is the prose version. If you change a boundary, change the DSL in the same PR.

---

## 1. What we are building

A web system that manages the lifecycle of an event at a ConnectSphere-managed venue: an Event Organiser requests it, an auto-assigned Event Coordinator reviews and plans it, Venue Staff decide the venue booking, Technical Support Staff arrange equipment, and Attendees register. Feature scope is the 20 core features in the project instructions, expressed as the 54 stories in `Final_User_Stories.md`.

**Out of scope, confirmed with the customer:** payment and billing, multi-session events, off-site venues, staff account onboarding, a System Admin role, transit/turnaround/setup buffers.

## 2. Architectural position

| Decision | Choice | Consequence you must respect |
|---|---|---|
| CAP | **CP** — consistency over availability | On a partition or a dependency timeout, **refuse the operation and return an error**. Never serve a stale answer, never accept a write you cannot verify. A refusal is a correct outcome; a double-booking is not. |
| Database | **ACID (Supabase Postgres)** | All invariants are enforced in the database, not in application memory. Exclusion constraints and conditional updates, not read-then-write. |
| Style | Microservices, schema-per-service | No cross-schema joins, no cross-schema foreign keys. You read another service's data through its API or through a Kafka-fed projection — never by querying its tables. |
| Messaging | **Apache Kafka**, one hosted cluster shared by the team (ADR-0003) | Every domain event is published via the transactional outbox. Direct HTTP calls to another service's write endpoint are allowed only for the synchronous cases listed in §5. |
| Auth | Supabase Auth (JWT) + our own role rules | The token proves identity. Authorisation is ours and is re-checked in every service. |
| Deployment | Local Node processes now (`npm run dev`), cloud later. **No Docker** (ADR-0003) | Nothing may depend on localhost, a local file path, or a shared in-process cache. Config comes from environment variables only. |

**Be ready to defend the microservice choice in Week 13.** The customer told us roughly 500 internal staff. That does not require microservices. Our reason is that we drew boundaries around transactional invariants and gave each member a service they own end-to-end. Do not claim a scale justification.

## 3. Containers

| Container | Owns | Stories |
|---|---|---|
| **Web App (SPA)** | All five role UIs | all |
| **API Gateway** | JWT verification, coarse role check, routing, rate limiting, correlation IDs | A2 (partly) |
| **Identity & Access Service** | Users, roles, account state, login audit, the permitted-role policy, access-scope rules | A1, A2, A3 |
| **Event Service** | The event aggregate and its status lifecycle | B1, B2, C1–C3, D1–D5, E1, E2, F1–F4, G1, G2, S1–S3 |
| **Venue Service** | Venues, availability, holds, bookings, conflict detection | H1, H2, I1, I2, J1, J2, K1, K2, L1–L3, M1, M2, N1, N2 |
| **Equipment Service** | Inventory, request lines, availability, reservations, readiness | O1, O2, P1, P2, Q1, Q2 |
| **Registration Service** | Registrations, waitlist, capacity | R1–R7 |
| **Notification Service** | Notification records and read state | T2 |
| **Scheduled Job Runner** | Completion sweep, registration windows, conflict-flag recalculation, reminders | F1, R2, N2 |
| **Apache Kafka** (hosted) | Domain events + structured logs | — |
| **Supabase Postgres** | One schema per service | — |
| **Supabase Auth** | Credentials, JWT issuing | A1 |
| **Supabase Storage** | Event attachments | B1 |

**Why the Event Service is the biggest:** features 2–7 and 19 all mutate the same aggregate, and F1 says status changes only as a consequence of a defined action. Splitting it would put the status machine behind a network call. Accept the imbalance; don't "fix" it by inventing a second event service.

## 4. Service ownership and data

Each service owns exactly one Postgres schema and is the only writer to it.

| Service | Schema | Key tables |
|---|---|---|
| Identity | `identity` | users, user_roles, login_audit, role_policy |
| Event | `event` | events (drafts included, at status Draft), event_history, clarifications, assignments, assignment_cursor, change_requests, event_comments, attachments, outbox |
| Venue | `venue` | venues, venue_layouts, operating_hours, unavailability_blocks, venue_holds, booking_requests, confirmed_bookings, outbox |
| Equipment | `equipment` | equipment_types, equipment_unavailability, request_lines, reservations, outbox |
| Registration | `registration` | registrations, waitlist_entries, capacity_counters, open_event_projection, outbox |
| Notification | `notification` | notifications, notification_read_state, consumed_messages |

**Cross-service references are IDs only.** `venue.booking_requests.event_id` is a plain UUID with no foreign key to `event.events`. Referential integrity across services is our responsibility, not the database's.

**Two deliberate merges in the Event schema.** An earlier version of this list named `event_drafts` and `status_history` separately; both have been folded in.

- **Drafts are rows in `event.events` at status Draft**, which is what F1 already implies by naming Draft among the ten statuses. Submitting a draft updates that row in place, so it keeps its id and its history. The consequence to remember: the A3 scope filter, not a table boundary, is what keeps a draft private to its owner (C1), so the coordinator scope reads "every event, plus my own drafts".
- **`event_history` holds every status change (F1) and every field-level amendment (D3)**, distinguished by `entry_type`. Both are append-only records of what happened to one event; G1 and S2 will add field changes to the same table rather than creating another.

## 5. How services talk

**Synchronous HTTP (JSON), only for these:**

- Event → Venue: readiness check, impact assessment, release/reconfirm (F1, G2, S3, F4)
- Event → Equipment: readiness check, impact, release (F1, G2, S3, F4)
- Event → Registration: active count, bulk cancel (G2, S3, F4)
- Venue → Event: read event timing/attendance/requirements (K1, L1)
- Equipment → Event: read event date/times (O1)
- Registration → Event: read published event info (R1)
- Registration → Venue: read booked venue capacity (R2, R7 — the capacity ceiling)
- Any service → Identity: role and scope resolution

**Asynchronous (Kafka) for everything else.** Notifications, projections, and cross-service reactions. Never call another service just to tell it something happened — publish.

**Forbidden:** service A writing to service B's schema; a synchronous chain more than two hops deep; any HTTP call inside a database transaction.

## 6. Cross-service invariants

These are the things that will break if we're careless. Each has one owner.

| Invariant | Owner | Mechanism |
|---|---|---|
| One active hold **or** confirmed booking per venue+period, first-come-first-served, no override | Venue | Postgres `EXCLUDE USING gist` over `tstzrange` — see implementation.md |
| Equipment never over-reserved | Equipment | Conditional `UPDATE ... WHERE available >= qty` |
| Registration never exceeds booked venue capacity | Registration | Ceiling read synchronously from Venue at registration time, then conditional update against a counter row. Cached ceilings are display-only. |
| Event reaches Confirmed only when venue **and** equipment are ready | Event | Readiness check calling both services synchronously before the transition |
| Cancellation releases everything or nothing | Event | Orchestrated saga with idempotent, compensatable release calls (F4) |
| A notification exists only if its trigger committed | all | Transactional outbox |

**Consistency guarantee:** we provide **linearizability per aggregate**, not strict serializability. Each venue slot, equipment type, and event registration count behaves as if operations on it happened one at a time, enforced by a database constraint or a single conditional statement. Strict serializability is a global real-time ordering across all services, which this architecture does not and need not provide — see implementation.md §4.5.

**Shared rules that must exist in exactly one place per service** — do not copy-paste these:

- Overlap predicate (Venue + Equipment): two periods overlap when one starts before the other ends and ends after the other starts; touching periods do not overlap.
- Significant fields (Event): date, start/end time, expected attendance, venue requirements, equipment requirements.
- Permitted-role policy (Identity): consumed by the gateway, the SPA nav, and every service.
- Access-scope rules (Identity): applied as a query-time filter inside each service, never as a UI-level filter.

## 7. The distributed-transaction problem (know this for the Q&A)

F4 requires venue, equipment, and registration releases to succeed together or not at all — a transaction across three services, which Postgres cannot give us. Our approach: **orchestrated saga with compensation**, driven by the Event Service. Each release endpoint is idempotent; on any failure the orchestrator compensates and the cancellation is not recorded.

This is the weakest point in the architecture and an instructor will probably find it. The honest answer is that there is a window during which state is inconsistent, and that compensation can itself fail; we chose it over eventual consistency because the acceptance criterion is explicitly all-or-nothing. Note that the customer did *not* extend that requirement to significant changes (S3), which are flag-and-notify — evidence they tolerate asynchrony where it isn't a hard release.

## 8. Local topology

```
Browser → SPA (Vite dev server / static)
        → API Gateway :8080
            → identity-svc :8081    → Supabase Postgres (schema: identity)
            → event-svc    :8082    → Supabase Postgres (schema: event)
            → venue-svc    :8083    → Supabase Postgres (schema: venue)
            → equipment-svc:8084    → Supabase Postgres (schema: equipment)
            → registration-svc:8085 → Supabase Postgres (schema: registration)
            → notification-svc:8086 → Supabase Postgres (schema: notification)
        all services ⇄ hosted Kafka cluster (domain events + logs)
        scheduler → services over HTTP
```

`npm run dev` at the repo root starts the services and the web app together; Supabase and Kafka are hosted and shared, so nothing else runs locally. Ports are fixed so our test kit and each other's local runs are interchangeable.

## 9. Sprint sequence

Four two-week sprints, Weeks 4–11. The final sprint closes in Week 11, leaving Week 12 for the submission package. Week 7 (the scrum process consultation) falls inside Sprint 2.

Re-sequenced against the revised backlog: T1 removed, F4 / L3 / R6 / R7 added, F1 split. Full move-by-move record with reasons in `/documentation/sprint-reallocation.csv`.

**Every story is a vertical slice.** A story includes its own UI, API, domain logic, repository, migration and tests, and is built by whoever owns it — there is no separate frontend workstream and no one is "the UI person". A story is not Done until the Product Owner can click through it in the sprint review, which is what the Definition of Done (`implementation.md` §8.3) requires. The shared UI shell that no single story owns — route guard, session store, API client, role-based navigation, the refusal/error display, the status lozenge map — is Sprint 1 work and is listed in `implementation.md` §7.3.

| Sprint | Weeks | Theme | Stories | Points |
|---|---|---|---|---|
| 1 | 4–5 | Foundations, request and review, end to end *(as delivered)* | A1, A2, A3, B1, B2, C1, C2, C3, D1, D2, D3, D4, D5, E1, E2 | **47** |
| 2 | 6–7 | Status, notifications, venue catalogue, equipment intake | F1, F2, T2, F3, G1, H1, H2, I1, J1, J2, K1, O1, O2, P2 | **46** |
| 3 | 8–9 | Holds, booking, conflict, reservation, attendee shell | I2, K2, L1, L2, L3, M1, M2, N1, N2, P1, Q1, Q2, R1, S1, S2 | **55** |
| 4 | 10–11 | Registration, readiness, change impact *(showcase)* | F4, F5, G2, R2, R3, R4, R5, R6, R7, S3 | **47** |

**195 points across 54 stories.** Sprint 1 is shown **as delivered**: it was scoped to A1–E2 and finished all fifteen, including the whole review workflow (D2–D5) and the reassignment handshake (E2). F1, F2 and T2 are counted in Sprint 2. Sprints 2–4 are still the plan.

The planned shape was a lighter first sprint while the infrastructure was unknown, a heavier middle, and a showcase sprint lighter than the two before it. Sprint 1 came in at 47 against a planned 44 — see §9.2.

### 9.1 What moved, and why

**F1 split, and counted in Sprint 2.** F1 (5) covers the lifecycle, permitted transitions and history. The Confirmed gate is carved out as **F5 — Confirm an event only when venue and equipment are ready** (5), which lands in Sprint 4 because it needs both M1 and Q1 to exist. Add F5 to Jira; it is not in `Jira.md`.

Worth being straight about in the review: B1, C2 and D1 all change event status, so the state machine itself had to be written inside Sprint 1 to make those stories work. Sprint 1 was scoped to A1–E2, so **F1 is not counted there** — the story, including its history view, is Sprint 2 work, and what Sprint 1 produced is the transition rule its own stories needed.

**T2 is Sprint 2 work, and its triggers are not.** Removing T1 put notification acceptance criteria on B1, D2–D5, E1 and E2 — those stories, in Sprint 1, must emit the right message to the right recipient. Reading and managing notifications (T2) needs Kafka, the outbox relay and the Notification Service, none of which exist; it is counted in Sprint 2.

**Four stories moved later because they act on things that did not exist yet:** I2 → Sprint 3 (flags confirmed bookings, needs M1), G2 → Sprint 4 (reads bookings, reservations and registration counts), F4 → Sprint 4 (releases all three), and the F3 remainder stays in Sprint 2 as cancel-and-record only.

**Five moved earlier because they had no blocking dependency:** K1 (advisory, needs only venue + event), O1, O2 and P2 (equipment intake and inventory are independent of venue — the customer confirmed technical support is planned in parallel), and Q1/Q2 (both the readiness gate and registration depend on reservations, so they cannot sit in the final sprint).

**S1 and S2 moved to Sprint 3** purely to balance load; they need only a submitted event.

**R1 moved to Sprint 3, and the attendee UI shell goes with it.** The attendee surface is a different design language from the internal screens — single column, public-facing, no Atlaskit — and leaving all of it to the final sprint means inventing that language under deadline. R1 is a simple list and can be demonstrated in Sprint 3 against a seeded Confirmed event, before F5 exists. Sprint 4 then fills in screens against an established shell rather than starting from a blank page.

### 9.2 Known risks

**Sprint 1 was planned at 44 points against a velocity you had not measured,** in the sprint that also stands up the repo, Supabase, the hosted Kafka cluster, the outbox, CI and the first test kit. Treat the infrastructure as work: either give it its own story points or expect the sprint to miss. Missing a first sprint is acceptable to the graders if the retrospective shows you learned from it — silently carrying stories is not.

**What actually happened in Sprint 1: 47 points delivered against a planned 44, and the scope was not what was planned.** The sprint was scoped to A1–E2 and delivered all of it, D2–D5 and E2 included, which had been planned for Sprint 2. F1, F2 and T2 are counted in Sprint 2 instead. Kafka and the outbox relay did not happen — the outbox rows are written but nothing publishes them, so every notification acceptance criterion stops at the outbox. Worth taking into the retrospective: the sprint's shape moved under it, and the infrastructure it was supposed to stand up is still outstanding.

**Sprint 3 is the heaviest at 55** and contains the two hardest items in the system (N1 slot exclusivity, Q1 reservation atomicity). If anything slips, it slips here, and it pushes into the showcase sprint. Protect it: build the concurrency tests first, not last.

**Same-sprint ordering matters in Sprint 3.** L3 before L1, M1 before I2, P1 before Q1. Put these in the sprint backlog order, not just the sprint.

**Two dependencies still cross a sprint boundary by design.** F5 (Sprint 4) completes behaviour begun by F1 (Sprint 2); G2 (Sprint 4) completes the change-request picture begun by S1/S2 (Sprint 3). Both are visible and intentional — say so in the Week 7 consultation rather than being asked.

Notification ACs land with their triggering story, not in a lump at the end.
