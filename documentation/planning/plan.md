# ConnectSphere — Architecture Plan

**Read this before writing any code.** It tells you which module or service your story belongs to, what that service is allowed to own, and how it may talk to the others. `implementation.md` tells you *how* to write it. If the two disagree, raise it in the team channel rather than picking one.

**Authoritative source:** `connectsphere.dsl` (Structurizr). This document is the prose version. If you change a boundary, change the DSL in the same PR.

---

## 1. What we are building

A web system that manages the lifecycle of an event at a ConnectSphere-managed venue: an Event Organiser requests it, an auto-assigned Event Coordinator reviews and plans it, Venue Staff decide the venue booking, Technical Support Staff arrange equipment, and Attendees register. Feature scope is the 20 core features in the project instructions, expressed as the 54 stories in `Final_User_Stories.md`.

**Out of scope, confirmed with the customer:** payment and billing, multi-session events, off-site venues, staff account onboarding, a System Admin role, transit/turnaround/setup buffers.

## 2. Architectural position

**Updated 2026-10-01.** The team accepted ADR-0004 to ADR-0015 (`documentation/adr/`), which replace the six-microservice design that ADR-0001 first described. The earlier version of this section is in git history.

| Decision | Choice | Consequence you must respect |
|---|---|---|
| CAP | **CP**: consistency over availability (unchanged) | On a partition or a dependency timeout, **refuse the operation and return an error**. Never serve a stale answer, never accept a write you cannot verify. A refusal is a correct outcome; a double-booking is not. |
| Database | **ACID (Supabase Postgres)**, every invariant enforced in Postgres (ADR-0006) | Exclusion constraints and row locks taken before the read. Never read-then-write on a contended resource. |
| Style | **Modular core plus two edge services** (ADR-0004, ADR-0005) | `planning-core` holds Identity, Event, Venue, Equipment, and Change and readiness. Each is a module with its own schema and a public interface. CI blocks imports of another module's internals and SQL against another module's schema. Registration and Notification are separate deployables. |
| Event history | **Event-sourced Event aggregate** (ADR-0007, Tier 2) | The history is the stream; projections update in the same transaction. Until EN-03 lands, `event_history` stays. |
| Messaging | **Hosted Kafka**: outbox published by CDC, CloudEvents, topics per aggregate, schema registry, inbox, retry topics and DLQ (ADR-0008) | Publish only through the outbox. Every consumer is idempotent through its inbox. |
| Long-running processes | **Temporal** (ADR-0009) | Cancellation, capacity reduction, the completion timer, waitlist invitations and change fan-out are workflows, not cron jobs or hand-written retries. |
| Auth | Supabase Auth (JWT, MFA for staff). **Cerbos** for actions, **row-level security** for rows (ADR-0010) | One policy bundle governs the gateway, the services and the SPA navigation. RLS is enforced, never bypassed. |
| Edge | Kong gateway, Redis rate limits, CDN, waiting room (ADR-0011, Tier 2) | Staff and public traffic use separate routes. |
| Deployment | `npm run dev` locally. Images built in CI, then EKS, Terraform, Argo CD and canary releases (ADR-0012, Tier 2) | Nothing may depend on localhost, a local file path or an in-process cache. Config comes from environment variables only. |
| Observability | OpenTelemetry, Grafana, SLOs (ADR-0013) | Every request and message carries trace context. |
| Front ends | Staff console (Atlaskit) and attendee PWA, with shared tokens and a generated client (ADR-0014) | Logout clears the query cache; APIs send `no-store`. |
| APIs | Contract-first OpenAPI, `Idempotency-Key`, `If-Match`, RFC 9457 errors (ADR-0015) | The spec comes before the code. |

**Be ready to defend the modular core in Week 13.** The customer told us roughly 500 internal staff, so none of the staff modules needs to deploy or scale on its own. The rules that span modules (F4, F5, S2/S3, G2) need one transaction, and a module boundary enforced by CI gives the ownership a separate service gave, without the sagas. We split out only what has a different traffic or failure profile: public registration, which bursts when registration opens, and notifications, which tolerate delay. Don't claim a scale justification for the core. For registration, the justification is the burst, measured by EN-18.

**Tier 2 is cut first.** EN-03, EN-05, EN-10, EN-12, EN-16, EN-19 and EN-21 are industrial showcase. If capacity runs short, they go first and the matching ADR says what stays.

## 3. Containers

| Deployable | Owns | Stories | Scales on | Why it stands alone |
|---|---|---|---|---|
| **staff-console** (static, CDN) | All internal role screens | A–Q, S, T2 screens | CDN | Dense Atlaskit UI for four internal roles |
| **attendee-app** (static PWA, CDN) | Browse, register, my registrations | R1–R7 screens | CDN | Public, mobile-first, different design language |
| **api-gateway** (Kong, Tier 2) | JWT check, rate limits, routing, trace context | A2 (partly) | Requests per second | One place for edge policy. The web app uses the Vite proxy until EN-12. |
| **planning-core** | Modules: Identity (A1–A3), Event (B1–E2, F1–F4, G1, G2), Venue (H1–N2, L3), Equipment (O1–Q2), Change and readiness (F5, S1–S3) | as listed | CPU and RPS (HPA) | Rules that span modules need one transaction |
| **registration-service** | Seat inventory, registrations, waitlist | R1–R7 | RPS (HPA) | Keeps a registration surge away from staff work |
| **notification-service** | Notification records, read state, delivery | T2 | Kafka consumer lag (KEDA) | Asynchronous and tolerant of delay |
| **workflow-workers** (Temporal) | CancelEvent, ReduceCapacity, CompleteEvent, WaitlistInvitation, ChangeImpactNotify | F1, F3, F4, R6, S3 | Task-queue backlog (KEDA) | Long-running processes survive restarts |
| **cdc-connector** (Tier 2) | Outbox tables → Kafka | — | n/a | Replaces the polling relay once the EN-05 spike passes |

**Managed and shared:**
- Hosted Kafka, plus a schema registry.
- Supabase Postgres: the core's schemas, and the registration and notification schemas.
- Supabase Auth.
- Supabase Storage, for event attachments (B1).
- Temporal.
- Cerbos.
- Redis, for rate limits (Tier 2).

**The Scheduled Job Runner is gone.** Its jobs were the completion sweep, the registration windows, conflict-flag recalculation and reminders. They become Temporal timers (ADR-0009), except conflict flags, which become a projection updated in the writing transaction.

## 4. Module and service ownership, and data

Each module or service owns exactly one Postgres schema and is the only writer to it.

| Module / service | Schema | Key tables |
|---|---|---|
| Identity (core) | `identity` | users, user_roles, login_audit. Permission rules live as Cerbos policies in the repo (ADR-0010), replacing `role_policy`. |
| Event (core) | `event` | event_stream and the events projection (drafts included, at status Draft), clarifications, assignments, assignment_cursor, event_comments, attachments, outbox. `event_history` stays until EN-03 replaces it with the stream. |
| Venue (core) | `venue` | venues, venue_layouts, operating_hours, **venue_slots** (holds and bookings, `blocked_period`, `requires_reconfirmation` flag), unavailability_blocks, booking_requests, outbox |
| Equipment (core) | `equipment` | equipment_types, **equipment_units**, **unit_reservations**, bulk reservations, equipment_unavailability, request_lines, outbox |
| Change and readiness (core) | `change` | change_requests (moving from `event` when EN-01 splits the module out), impact flags |
| Registration service | `registration` | **seats** (public and VIP pools), registrations, waitlist_entries, inbox, outbox |
| Notification service | `notification` | notifications, notification_read_state, inbox (was consumed_messages) |

**Inside the core, modules still reference each other by ID only.** There are no foreign keys across module schemas, so a module can be extracted later if it ever needs its own release cadence (the scale-out trigger in ADR-0004). Read another module's data through its public interface, never by querying its tables.

**Drafts are rows at status Draft** in the events projection. Submitting a draft updates that row, so it keeps its id and its history. The A3 scope rule, now enforced by RLS, is what keeps a draft private to its owner (C1).

## 5. How things talk

**Inside `planning-core`:** function calls through each module's public index. One Postgres transaction may span modules, which is the point of ADR-0004. That covers F4's releases, F5's readiness read, S2/S3's approve-and-flag and G2's impact read.

**Synchronous HTTP between deployables, only for these:**
- Browser → gateway → core, registration or notification.
- Registration → core: read published event information (R1). Never inside a transaction.
- Temporal workers ↔ core and registration: workflow activities (CancelEvent freeze, commit and finalise; ReduceCapacity).

**Asynchronous (Kafka) for everything else.** For example, `booking.confirmed` builds the seat inventory in Registration, every notification trigger feeds the notification service, and projections are rebuilt from events. Never call another deployable just to tell it something happened: publish through the outbox.

**Contracts:** OpenAPI per deployable, and AsyncAPI for every topic (ADR-0015).

**Forbidden:**
- A module querying another module's schema.
- Any HTTP call inside a database transaction.
- Publishing outside the outbox.
- A consumer without an inbox check.

## 6. Invariants

These are the things that break if we're careless. Each has one owner. The mechanisms follow ADR-0006, and `implementation.md` §4.6 has the SQL.

| Invariant | Owner | Mechanism |
|---|---|---|
| One active hold **or** confirmed booking per venue and period, no override | Venue | `EXCLUDE USING gist` on `venue_slots.blocked_period` for HELD or CONFIRMED |
| A block can't slip past an in-flight approval (I2 against M1) | Venue | Both take `SELECT … FOR UPDATE` on the venue row first |
| A flagged booking keeps its slot | Venue | Requires Reconfirmation is a flag column, never a status |
| A converted hold keeps its slot until decided (L3 → L1) | Venue | The slot stays HELD until M1 or M2 decides |
| Serialized equipment never double-reserved | Equipment | Per-unit exclusion constraint on `unit_reservations` |
| Bulk equipment never over-reserved in a window | Equipment | Type row lock, then a peak-concurrent-use check |
| Registrations never exceed capacity | Registration | One row per seat, claimed with `FOR UPDATE SKIP LOCKED` |
| No lost updates on event edits | Event | Expected stream version, `If-Match` |
| An event reaches Confirmed only when venue **and** equipment are ready (F5) | Change and readiness | One core transaction reads the booking and the reservations |
| Cancellation releases everything or nothing (F4) | Event, with Temporal | One core transaction, plus a semantic lock on registrations (§7) |
| A notification exists only if its trigger committed | all | Transactional outbox, with an inbox for effectively-once processing |

**Consistency guarantee.** We provide **linearizability per aggregate**, not strict serializability. Each venue slot, equipment unit or type, seat and event behaves as if operations on it happened one at a time. The guarantee per operation:

| Operation | Guarantee |
|---|---|
| Place a hold, approve a booking (L3, M1, N1) | Linearizable per venue slot |
| Reserve equipment (Q1) | Linearizable per unit or type |
| Register, add a VIP (R2, R7) | Exact capacity, never exceeded |
| Confirm an event (F5); approve a change and flag (S2, S3) | Atomic, one core transaction |
| Cancel an event (F3, F4) | All or nothing |
| Create a notification (T2) | Effectively once, visible within 10 s (CQ-03) |
| Staff calendar and queues (I1, D1, M1) | Read your own writes |
| Attendee browse list (R1) | At most 5 s stale; registering re-checks live |

**Shared rules that must exist in exactly one place.** Don't copy-paste these:
- **Overlap:** use `&&` on half-open ranges. Touching periods don't overlap. Never hand-roll the comparison.
- **Significant fields (Event):** date, start/end time, expected attendance, venue requirements, equipment requirements.
- **Permitted-role policy:** the Cerbos bundle, read by the gateway, the services and the SPA navigation.
- **Access scope:** RLS policies in Postgres, never a UI-level filter.

## 7. The distributed-transaction problem (know this for the Q&A)

**Under ADR-0004, most of what used to be distributed is now local.** F5, S2/S3 and G2 are single transactions inside `planning-core`. F4 still crosses two deployables, because registrations live in the registration service.

**How F4 stays all-or-nothing** (ADR-0009, run as a Temporal workflow):
1. **Freeze.** The registration service marks the event's registrations `CANCEL_PENDING`. They still count, so nothing is freed.
2. **Commit.** The core commits the cancellation and releases the venue slot and equipment reservations **in one transaction**.
3. **Finalise.** Registration marks the registrations Cancelled. This step can't fail on business grounds and is retried until done.

If step 1 or 2 fails, the workflow unfreezes the registrations. That undo can't conflict, because nothing was released. This is the semantic-lock countermeasure from Richardson's *Microservices Patterns* (chapter 4). It replaces ADR-0002's saga, whose compensation (re-booking a released slot) could fail if someone took the slot first.

**The honest weak points to say in the Q&A:**
- Between steps 2 and 3, the registrations show `CANCEL_PENDING` rather than Cancelled.
- The finalise step depends on retries.
- Workflow code must stay deterministic, which replay tests guard.
- T2's notifications become visible within about 10 seconds of the action, not inside its transaction. CQ-03 asks the customer to accept that.

## 8. Topology

**Local (`npm run dev`):**

```
Browser → staff console / attendee app (Vite dev servers, Vite proxy until the gateway exists)
        → planning-core            → Supabase Postgres (identity, event, venue, equipment, change schemas)
        → registration-service     → Supabase Postgres (registration schema)
        → notification-service     → Supabase Postgres (notification schema)
        all ⇄ hosted Kafka cluster (domain events, logs)
        workflow workers ⇄ Temporal dev server (Temporal CLI, no Docker), from EN-11
```

`npm run dev` at the repo root starts everything. Supabase and Kafka are hosted and shared, so nothing else runs locally. EN-01 merged Identity and Event into planning-core on 2 Oct 2026; it runs on port 8090 (`PLANNING_CORE_PORT`), and the Vite dev server proxies `/identity/*` and `/event/*` to it.

**Staging (EN-10, Tier 2):**
- EKS in ap-southeast-1, provisioned by Terraform and synced by Argo CD from a config repo.
- Kong and a CDN in front.
- Argo Rollouts canary releases (EN-16).
- Images are built in CI only (ADR-0012).

## 9. Sprint sequence

Four two-week sprints, Weeks 4–11. The final sprint must end by Friday of Week 12 at the latest (project instructions). Week 7, the scrum process consultation, falls inside Sprint 2.

**Jira is the single source of story points (PX-01).** Points are written to Jira only from the team's planning poker (PX-02), and this table copies Jira. The move-by-move record with reasons is in `documentation/sprint allocation.csv`.

**Every story is a vertical slice.** A story includes its own UI, API, domain logic, repository, migration and tests, and whoever owns it builds all of it. There is no separate frontend workstream and no one is "the UI person". A story is not Done until the Product Owner can click through it in the sprint review, which is what the Definition of Done (`implementation.md` §8.3) requires. The shared UI shell that no single story owns (route guard, session store, API client, role-based navigation, the refusal/error display, the status lozenge map) was Sprint 1 work and is listed in `implementation.md` §7.3.

| Sprint | Weeks | Dates (SGT) | Theme | Stories | Story points (Jira) | Enablers and tasks |
|---|---|---|---|---|---|---|
| 1 | 4–5 | 9–20 Sep, closed | Foundations, request and review, end to end *(as delivered)* | A1, A2, A3, B1, B2, C1, C2, C3, D1, D2, D3, D4, D5, E1, E2 | **35** | — |
| 2 | 6–7 | 23 Sep – 6 Oct, active | Status, notifications, venue catalogue, equipment intake | F1, F2, G1, H1, H2, I1, J1, J2, K1, O1, O2, **P1**, P2, T2 | **34**, plus P1 not yet estimated | EN-01 to EN-09; SPM-113 to 116 (12 pts); PX-01 to PX-14; CQ-01 to CQ-03 |
| 3 | 8–9 | 7–20 Oct | Holds, booking, conflict, reservation, attendee shell | I2, K2, L1, L2, L3, M1, M2, N1, N2, Q1, Q2, S1, S2, **F5** | 5 (F5); the rest to be poker'd | EN-10 to EN-15 |
| 4 | 10–11 | 21 Oct – 3 Nov | Registration, readiness, change impact *(showcase)* | **F3**, F4, G2, **R1**, R2, R3, R4, R5, R6, R7, S3 | 3 (F3); the rest to be poker'd | EN-16 to EN-23 |

There are 54 stories, and T1 is removed (closed in Jira, not deleted). Stories in **bold** moved on 1 Oct 2026 (§9.1).

**A note on the earlier figures.** Earlier versions of this table gave Sprint 1 as 44 points planned and 47 delivered. The Sprint 1 planning transcript totals 34, and a CHANGELOG entry said 52. All of these came from document estimates (for example A3 = 5, B2 = 5) that never matched the team's planning-poker votes in Jira (A3 = 1, B2 = 2). Jira holds the votes, so **Sprint 1 is 35**, all fifteen stories Done.

Sprint 2's story points come from the team's estimates entered in Jira on 27 Sep: 37 before the 1 Oct moves, and 34 after F3 left. The documents had said 46. The per-sprint totals of 46, 55 and 47 were document estimates too, so they are no longer quoted as plan figures. Sprint 3 and 4 points will be set by poker before each sprint starts.

### 9.1 What moved, and why

**On 1 Oct 2026, by team decision (Gate B), recorded as a mid-sprint change in Sprint 2:**

| Story | From | To | Reason |
|---|---|---|---|
| F3 | Sprint 2 | Sprint 4 | Cancellation is one command with F4. Shipping it alone means rewriting it. |
| P1 | Sprint 3 | Sprint 2 | Shares its time-based availability model with P2 (waits on CQ-02) |
| F5 | Sprint 4 | Sprint 3 | Readiness becomes an in-core query once M1 and Q1 exist |
| R1 | Sprint 3 | Sprint 4 | Built on the registration service's seat inventory. The attendee shell moves into EN-13 (Sprint 3). |
| S1, S2 | Sprint 3 | Sprint 3, behind flag `change-approval` | Approval stays off in production until S3 lands (EN-15) |

Twenty-three enablers (EN-01 to EN-23) were added to the backlog and placed in their planned sprints. Fourteen scrum-evidence tasks and three customer questions were added to Sprint 2. Sprint 2 now carries far more than the measured velocity of 35, and most of the enablers and PX tasks will carry over. The Sprint 2 review and retro should say so plainly.

**Earlier, in the Revision 3 re-sequencing (before Sprint 1):** T1 was removed, F4, L3, R6 and R7 were added, and F1 was split.
- **F1 split.** F1 covers the lifecycle, permitted transitions and history. The Confirmed gate became **F5**, which needs M1 and Q1 to exist. B1, C2 and D1 all change event status, so the transition rule had to be written inside Sprint 1 for those stories to work. Sprint 1 was scoped to A1–E2, so **F1 is counted in Sprint 2**.
- **T2 is Sprint 2 work, and its triggers are not.** Removing T1 put notification acceptance criteria on the stories that raise them (B1, D2–D5, E1, E2 and onwards). Reading and managing notifications (T2) needs Kafka, the outbox relay and the notification service (EN-04).
- **Moved later** because they act on things that didn't exist yet: I2 to Sprint 3 (flags confirmed bookings, needs M1), G2 and F4 to Sprint 4.
- **Moved earlier** because they had no blocking dependency: K1 (advisory), O1, O2 and P2 (equipment intake is independent of venue; the customer confirmed technical support plans in parallel), and Q1/Q2 (the readiness gate and registration both depend on reservations).

### 9.2 Known risks

- **Sprint 2 is overloaded on purpose.** It holds the enablers that de-risk Sprints 3 and 4 (EN-01 modular core, EN-02 invariant kernel, EN-04 messaging, EN-06 CI). Expect carry-over, and record it honestly rather than trimming scope silently. Tier 2 items (EN-03, EN-05) are cut first.
- **Sprint 1 outcome:** 35 points delivered, all fifteen stories Done, D2–D5 and E2 included. Kafka and the outbox relay didn't happen. Outbox rows are written, but nothing publishes them, so every notification criterion stops at the outbox until EN-04 and SPM-113 land.
- **Sprint 3 holds the two hardest stories:** N1 (slot exclusivity) and Q1 (reservation atomicity). EN-02 in Sprint 2 builds their constraints and the race harness first, which is the point of doing it early.
- **Same-sprint ordering matters.** In Sprint 3, L3 before L1, and M1 before I2. P1 (Sprint 2) now comes before Q1 (Sprint 3). Put these in backlog order, not just in the sprint.
- **Dependencies that cross a sprint boundary:**
  - EN-11 (Sprint 3) blocks F1's "Completed after the end time" criterion (Sprint 2), so F1 may carry over or have that criterion split off.
  - F5 (Sprint 3) completes behaviour begun by F1.
  - G2 (Sprint 4) completes the change-request picture begun by S1/S2 (Sprint 3).

  Raise all three at the Sprint 2 review rather than waiting to be asked.
- **Customer answers pending:** CQ-01 (R7 VIP pool), CQ-02 (P1 peak or summed) and CQ-03 (T2 visibility). P1 and T2 are in Sprint 2, so CQ-02 and CQ-03 are needed first.

Notification ACs land with their triggering story, not in a lump at the end.
