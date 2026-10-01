# Jira and repo change set, October 2026

**Status:** Applied on 2026-10-01 (Batches 1 to 4). See the CHANGELOG entries of that date.
**Author:** Joash, 2026-10-01.
**Built from:**
- `documentation/proposals/2026-10-01-target-architecture-and-jira-plan.md` (the plan)
- `documentation/planning/jira-snapshot-2026-10.md` (the snapshot, taken the same day)
- The target architecture page (§3 decisions, §13 diff, §13b enablers explained)
- The sprint evidence playbook (§6 gaps, §7 Week 7 questions, §8 templates)

---

## 0. Decisions filled in, and where each one comes from

| # | Decision | Value | Source |
|---|---|---|---|
| Z1 | Gates A, B and D | **Passed, reported by Joash on 2026-10-01** as approved by the team. The meeting date, the channel and individual names are not recorded yet, so the gate log says so rather than guessing. | Joash, 1 Oct 2026 |
| Z2 | Enabler points (Gate C) | **Not written.** Each enabler's description carries "Proposed estimate (to be poker'd): N". Gate C stays open until the team pokers (PX-02). | Plan rule 2. Playbook gap 1: "don't outsource the estimate … the planning-document figures shouldn't be your estimates" and "point your platform enablers too" (by poker). |
| Z2a | EN-04 and EN-06 overlap with SPM-113 to 116 | No points to clash, since Z2 writes none. Each description names the overlapping tasks so the poker session sizes only the remaining scope. | Follows from Z2 |
| Z2b | Sprint 3 and 4 story points | **Not written to Jira.** The CSV and `plan.md` show Jira's values and leave the rest blank ("to be poker'd"). | Playbook gap 1: "remove the points from plan.md and the CSV, or generate them from Jira" |
| Z3 | Test issues SPM-82 to 107 | **Open item, not restored.** Nobody has said what happened to them (details in §6). | Your instruction: "if nobody knows yet, skip" |
| Z4 | Assignees | **None.** CQ-01 to 03 go to the Sprint 2 PO once one is named (PX-11). | Playbook gap 10: no PO has been named for Sprint 2 |
| Z5 | Sprint dates | Sprint 3: **Wed 7 Oct 15:30 to Tue 20 Oct 23:30 SGT**. Sprint 4: **Wed 21 Oct 15:30 to Tue 3 Nov 23:30 SGT**. | Same Wednesday-to-Tuesday, two-week rhythm as Sprints 1 and 2. The Week 4 instructions require the final sprint to end "by Friday Week 12 at the latest", which these dates meet whether or not there is a recess week. |
| Z6 | ADR owners | Each ADR's owner is whoever takes its matching enabler (table in §5.2), and they present it in the Week 13 Q&A. Until then the line reads "Owner: assignee of EN-xx (not yet assigned)". | Architecture page §11: "Each ADR has an owner who presents it in the Q&A" |

---

## 1. How the writes are made

| What | How |
|---|---|
| Project | `SPM`, team-managed, board **2**, cloudId `0a39bd75-ca73-4c09-9a58-fc7ade485bc3` |
| New issue type | **Task** (10010) for every EN, PX and CQ item |
| Epic | `parent` = the epic key |
| Links | Link type `Blocks`, enabler → story ("EN-01 blocks F5"), and `Relates` where noted |
| Summaries | `EN-<nn> — <title>`, `PX-<nn> — <title>`, `CQ-<nn> — <title>`, with an em dash |
| Duplicate check | Before every create, run `project = SPM AND summary ~ "<code>"`. If it's found, update that issue instead. |
| Deletes | **None.** Sprint create and start go through `manageJiraSprint`, which the MCP files under its "destructive" tier because closing a sprint is one-way. Close is never called. |
| CHANGELOG | One entry per batch: SGT timestamp, `**Author:** Joash`, the reason and a numbered list. Batches 1 to 3 go under `# Jira changes`, newest first. |

---

## 2. Batch 1: housekeeping

| # | Action | Target | Detail |
|---|---|---|---|
| 1.1 | START sprint | SPM Sprint 2 (id 68) | Start 2026-09-23 15:30 SGT, end 2026-10-06 23:30 SGT, both kept as they are. Goal: **"Status, notifications, venue catalogue, equipment intake"**, which is `plan.md` §9's Sprint 2 theme (the goal is empty now). If Jira won't take the past start date, the date it actually used is recorded. |
| 1.2 | TRANSITION → Done | SPM-62, 63, 64, 65, 66 (Feature 1 to 5 epics) | Every story under them is Done |
| 1.3 | COMMENT | SPM-60 (T1) | T1 is **already Done** (Chai closed it on 2026-09-15), so it only gets the comment: *"Removed in Revision 3 of the user stories. T1 was an epic in disguise: its fifteen triggers became acceptance criteria on the stories that raise them, and its record and recipient rules moved to T2 (SPM-61). Closed, not deleted, per implementation.md §4.3."* |
| 1.4 | CREATE sprint | `SPM Sprint 3`, board 2 | 2026-10-07 15:30 to 2026-10-20 23:30 SGT. Goal: **"Holds, booking, conflict, reservation, attendee shell"** (`plan.md` §9) |
| 1.5 | CREATE sprint | `SPM Sprint 4`, board 2 | 2026-10-21 15:30 to 2026-11-03 23:30 SGT. Goal: **"Registration, readiness, change impact (showcase)"** (`plan.md` §9) |

Batch 1 starts Sprint 2 before Batch 3 adds scope to it. Jira will show the enablers and PX tasks as scope added mid-sprint, which is true and matches Gate B's "recorded mid-sprint change".

---

## 3. Batch 2: new work items

### 2.1 Epics

| # | Action | Summary | Labels |
|---|---|---|---|
| 2.1a | CREATE Epic | Platform and quality enablers | `enabler` |
| 2.1b | CREATE Epic | Scrum process evidence | `process` |

Each epic's description gets one line pointing to the plan file and the architecture page.

### 2.2 Enablers EN-01 to EN-23

All are **Task**, with parent *Platform and quality enablers*, labels `enabler` plus `tier-1` or `tier-2`, and no sprint yet (Batch 3 places them). No points (Z2).

Every description follows this template:

```
Tier <t> · Proposed sprint: <s> · Proposed estimate (to be poker'd): <est>
Blocks: <as in the plan>

What it is: <architecture page §13b, "What it is">
Why we need it: <architecture page §13b, "Why we need it">

Acceptance criteria
- <one bullet per sentence of the plan's §5 criteria, wording kept>

In the Week 13 Q&A: "<architecture page §13b, "Say it">"

Source: documentation/proposals/2026-10-01-target-architecture-and-jira-plan.md §5 and the architecture page §13b.
```

| ID | Summary | Tier | Spr | Est | Acceptance criteria (one bullet each) |
|---|---|---|---|---|---|
| EN-01 | EN-01 — Modular core with boundary checks | 1 | 2 | 5 | Identity and Event run as one deployable `planning-core`, each a module with a public index · dependency-cruiser fails CI on cross-module internal imports · A check fails CI on SQL touching another module's schema · All A–E tests still pass, and `npm run dev` starts core and web |
| EN-02 | EN-02 — Invariant kernel | 1 | 2 | 8 | `venue_slots` with an exclusion constraint on `blocked_period` for HELD or CONFIRMED · Requires Reconfirmation is a flag column · Approval and block creation both lock the venue row · Equipment units have a per-unit exclusion constraint, and bulk stock uses a type lock plus peak check · A race harness fires 50 parallel attempts and exactly one wins, for both a venue slot and a unit |
| EN-03 | EN-03 — Event store and projections | 2 | 2 | 8 | An append-only `event_stream` with `unique(aggregate_id, version)` and a hash chain · Projections update in the same transaction · A–E data is migrated · F1 and F2 history read from the stream · A tamper check detects an edited entry |
| EN-04 | EN-04 — Kafka messaging done safely | 1 | 2 | 5 | Hosted Kafka chosen (an ADR records why) · Topics per aggregate, keyed by aggregate id · CloudEvents envelope validated by `contracts` · The relay uses `FOR UPDATE SKIP LOCKED` · The notification consumer has an inbox table, retry topics and a DLQ · Tests: a duplicate message creates one notification, and broker downtime loses nothing. *Extra line: "Provider setup is already tracked in SPM-113 (5 pts). Size only the rest when you poker this."* |
| EN-05 | EN-05 — CDC and schema registry | 2 | 2 | 3 | Spike first: confirm Supabase allows a logical replication slot · Debezium outbox router replaces the relay · CI checks backward compatibility against the schema registry |
| EN-06 | EN-06 — CI pipeline v1 | 1 | 2 | 5 | GitHub Actions on every PR runs lint, typecheck, unit tests with 100% domain coverage, Stryker on the domain (≥ 80%), integration tests on an ephemeral Postgres (never the shared DB), squawk, CodeQL and gitleaks · Branch protection requires it · The ubuntu runner's preinstalled Postgres avoids Docker. *Extra line: "GitHub Actions, branch protection and coverage are already tracked in SPM-114, 115 and 116 (7 pts). Size only the rest when you poker this."* |
| EN-07 | EN-07 — Permission policies and row-level security | 1 | 2 | 5 | Cerbos policies in the repo, evaluated by the gateway, services and SPA navigation · A3 enforced with RLS, using a per-request role and `SET LOCAL` claims inside each transaction · A generated matrix test covers role × endpoint × related and unrelated resources |
| EN-08 | EN-08 — OpenTelemetry and Grafana | 1 | 2 | 5 | Services instrumented (HTTP, pg, kafkajs), with trace context carried in Kafka headers · Correlation id is the trace id · A Grafana trace shows one approval end to end |
| EN-09 | EN-09 — C4 as code, ADRs, API specs | 1 | 2 | 3 | Structurizr DSL committed (L1–L3, a deployment view, dynamic views for F4 and R2) and rendered in CI · ADR-0004 to 0015 written · OpenAPI per service, AsyncAPI for events. *Extra line: "ADR-0004 to 0015 are written in this rollout (Batch 4). Structurizr and the API specs remain."* |
| EN-10 | EN-10 — Containers, Terraform, Kubernetes, GitOps | 2 | 3 | 8 | Gate D passed (reported 2026-10-01; ADR-0012 supersedes ADR-0003) · Images built in CI only · Terraform for the cluster, network and Redis · Argo CD syncs staging from a config repo · README deploy steps |
| EN-11 | EN-11 — Temporal workflows | 1 | 3 | 5 | Temporal workers · A CompleteEvent timer (F1) · A CancelEvent workflow with a semantic lock (freeze, commit, finalise, with unfreeze on failure) · Time-skipping tests and replay tests in CI |
| EN-12 | EN-12 — API gateway, rate limits, CDN | 2 | 3 | 5 | Kong with the JWT plugin against the Supabase JWKS · Per-user and per-IP rate limits backed by Redis · Trace headers · Separate staff and public routes · CDN in front of the SPA and the browse API |
| EN-13 | EN-13 — Registration service and seat inventory | 1 | 3 | 5 | Its own service and database · A `seats` table claimed with `FOR UPDATE SKIP LOCKED`, with public and VIP pools · Seats created from `booking.confirmed` · Attendee PWA shell |
| EN-14 | EN-14 — Preview environments and browser tests | 1 | 3 | 5 | A per-PR preview (or ephemeral CI stack) · Playwright E2E tagged with story test ids · axe accessibility checks · Visual snapshots at 360, 768 and 1280 px |
| EN-15 | EN-15 — Feature flags | 1 | 3 | 2 | OpenFeature with flagd · Flag `change-approval` gates S2 approval in production |
| EN-16 | EN-16 — Canary releases | 2 | 4 | 3 | Argo Rollouts canary at 10, 50 and 100%, with Prometheus analysis of error rate and p95 · Automatic rollback demonstrated |
| EN-17 | EN-17 — SLOs, alerts, dashboards, runbooks | 1 | 4 | 3 | SLOs written down: registration p95 ≤ 800 ms at 500 req/s, zero over-admission, staff p95, notification freshness within 10 s, 99.9% availability · Burn-rate alerts and a runbook per alert |
| EN-18 | EN-18 — Load tests and autoscaling | 1 | 4 | 3 | k6 spike test (500 req/s for 100 seats gives exactly 100 registered), soak and stress tests · Autoscaling tuned · Results committed as evidence |
| EN-19 | EN-19 — Virtual waiting room | 2 | 4 | 2 | Admission tokens for events flagged high-demand, at the tested rate |
| EN-20 | EN-20 — Chaos experiments | 1 | 4 | 3 | Six experiments (architecture page §7), each with a hypothesis, result and fix log · Toxiproxy in CI |
| EN-21 | EN-21 — Software supply chain security | 2 | 4 | 3 | SBOM, cosign signatures, Trivy and a ZAP baseline scan in the pipeline |
| EN-22 | EN-22 — Traceability generator and DORA dashboard | 1 | 4 | 3 | Generates the story → AC → test → last-result matrix from test tags on every CI run · Tracks the four DORA metrics |
| EN-23 | EN-23 — Threat model, PDPA review, ASVS checklist | 1 | 4 | 2 | A STRIDE table per container, a PDPA note on attendee data, and an ASVS Level 2 checklist mapped to controls |

Tier 1: 16 issues, proposed 67 points. Tier 2: 7 issues, proposed 32 points. These numbers go in descriptions only.

### 2.3 Links (48)

**Blocks (41):**

| From | Blocks |
|---|---|
| EN-01 | F5 SPM-109, F4 SPM-111, S2 SPM-58, S3 SPM-59, G2 SPM-31 |
| EN-02 | L3 SPM-110, M1 SPM-42, N1 SPM-44, I2 SPM-35, P1 SPM-48, P2 SPM-49, Q1 SPM-50 |
| EN-03 | F1 SPM-27, F2 SPM-28, G1 SPM-30, S2 SPM-58 |
| EN-04 | T2 SPM-61, EN-20 |
| EN-06 | EN-21 |
| EN-08 | EN-17 |
| EN-10 | EN-16, EN-21 |
| EN-11 | F1 SPM-27, F4 SPM-111, R6 SPM-112, S3 SPM-59, EN-20 |
| EN-12 | R1 SPM-52, R2 SPM-53, EN-19 |
| EN-13 | R1 SPM-52, R2 SPM-53, R3 SPM-54, R4 SPM-55, R5 SPM-56, R6 SPM-112, R7 SPM-108, EN-18, EN-20 |
| EN-15 | S1 SPM-57, S2 SPM-58 |

The enabler-to-enabler links come from the plan's "(needs …)" notes, written from the blocking side.

**Relates (7):**

| Link | Why "relates to" |
|---|---|
| EN-05 ↔ EN-04 | The plan says "improves EN-04" |
| EN-07 ↔ A2 SPM-12 | A2 is Done, so it can't be blocked. EN-07 hardens it. |
| EN-07 ↔ A3 SPM-13 | Same reason |
| SPM-113 ↔ EN-04 | Overlap (§2.7) |
| SPM-114 ↔ EN-06 | Overlap (§2.7) |
| SPM-115 ↔ EN-06 | Overlap (§2.7) |
| SPM-116 ↔ EN-06 | Overlap (§2.7) |

**Not linked, because the target isn't an issue:**
- EN-06 and EN-14 ("All stories"): stated in their descriptions.
- EN-09 and EN-23 (Deliverable 2) and EN-22 (Deliverable 3): stated in their descriptions.

**One link that points backwards in time, applied as planned:** EN-11 (Sprint 3) blocks F1 (Sprint 2). F1's "Completed after the end time" criterion needs the Sprint 3 timer, so F1 will likely carry over or have that criterion split off.

### 2.4 Scrum-evidence tasks PX-01 to PX-14

All are **Task**, with parent *Scrum process evidence* and label `process`. Each description reads: `Suggested owner: <owner>`, then `Done when: <text>`, then `Template: <playbook §8 template, pasted in, where one applies>`, then `Source: plan §6; playbook §<n>`.

| ID | Summary | Suggested owner | Done when | Template pasted in |
|---|---|---|---|---|
| PX-01 | PX-01 — Make Jira the single source of story points | PO | Sprint 1 restated as 35 in `plan.md`, the CSV and `CHANGELOG.md`, with a note on the earlier figures. *Batch 4 of this rollout does this, so PX-01 can be closed after the PO checks it.* | n/a |
| PX-02 | PX-02 — Re-estimate Sprint 2–4 stories and enablers with planning poker | Whole team | A recorded session. Lowest and highest vote plus the reason noted per item. | Estimates table from the planning record |
| PX-03 | PX-03 — Estimation reference | PO + SM | A reference story (suggest C1 = 2) and a one-line meaning for 1, 2, 3, 5 and 8, kept in Confluence or the repo | n/a |
| PX-04 | PX-04 — Standup log | SM | A sheet or Confluence table. Two live 15-minute calls a week plus written entries on other days (done, next, blockers, goal on track). Not back-filled for Sprint 1. | Standup entry |
| PX-05 | PX-05 — Sprint 2 planning record | SM + PO | Written from the agreed plan (roles, goal, dates, capacity, stories, points, owners, risks, carry-over), honestly dated as written up later | Sprint planning record |
| PX-06 | PX-06 — Burndown and velocity | SM | Jira Reports enabled. A sprint burndown screenshot and a two-sentence reading on the last day of each sprint. An across-sprint burndown sheet starting from Sprint 1 = 35. | n/a |
| PX-07 | PX-07 — Customer clarification log | PO | `documentation/clarifications.md` with C-01 onwards (question, answer, decision, stories changed), including the C-04, C-10 to C-13 already cited | Customer clarification entry |
| PX-08 | PX-08 — Review record with demo log and proxy feedback | PO | A template used from the Sprint 2 review onward. The PO acts as the customer's proxy and their feedback is recorded. | Sprint review record |
| PX-09 | PX-09 — Retro follow-up | SM | Every retro opens by reviewing the last one's actions (done? helped? evidence?) | Retrospective record |
| PX-10 | PX-10 — AI-usage log | All | A short entry per story: what the AI produced, what a human reviewed or changed, and who | AI-usage log entry |
| PX-11 | PX-11 — Roles per sprint | Team | A roles table in every planning record. The Sprint 2 PO is named (rotation agreed at the Sprint 1 retro). | n/a |
| PX-12 | PX-12 — Sprint 4 recordings plan | SM | Four separate sessions booked (planning, one standup, review, retro) and uploaded as unlisted videos | The playbook §5 "what should be visible" table |
| PX-13 | PX-13 — Week 7 consultation questions | SM | The six questions from the playbook, §7, asked and the answers written down | The six questions, pasted in |
| PX-14 | PX-14 — Changed-requirements note | PO | A "what changed and why" section in the next planning record: T1 removed, F1/F3 split, L3/R6/R7 added | n/a |

### 2.5 Customer questions CQ-01 to CQ-03

All are **Task**, with parent *Scrum process evidence* and label `customer-question`, unassigned until the PO is named (Z4). Each description reads: `Question for the G1 customer: <question>`, then `Why: <why>`, then `Design impact: <architecture page §11 story defect, its proposal and "the design handles either answer">`, then `Record the answer in documentation/clarifications.md (PX-07)`.

| ID | Summary | Question (from plan §7, word for word) |
|---|---|---|
| CQ-01 | CQ-01 — R7 VIP adds versus registration places | R7 allows a VIP add "even when no registration places remain" but refuses anything above venue capacity, while R2 defines places as capacity minus VIP adds. Should VIPs come from a reserved pool set by the organiser? |
| CQ-02 | CQ-02 — P1 peak concurrent use or summed overlaps | P1: for a long window, should available equipment be total minus peak concurrent use, or minus every overlapping reservation added up? |
| CQ-03 | CQ-03 — T2 notification visible within about 10 seconds | T2: is it acceptable for the notification to be committed with the action as an intent and become visible within about 10 seconds? |

### 2.6 SPM-113 to 116: linked, not merged

| Existing | Overlaps | Action |
|---|---|---|
| SPM-113 Set Up Kafka Provider (5 pts, Sprint 2) | EN-04 ("Hosted Kafka chosen") | **Link** (Relates). Set parent → *Platform and quality enablers*. Add labels `enabler`, `tier-1`. |
| SPM-114 Configure Automated Testing (GitHub Actions) (3) | EN-06 | Same |
| SPM-115 Configure Github Branch Protections (1) | EN-06 ("Branch protection requires it") | Same |
| SPM-116 Set Up Coverage Reporting (3) | EN-06 (coverage) | Same |

Seann created these on 23 Sep. They carry points the team set and they're already in Sprint 2. They're **narrower** than EN-04 and EN-06, so merging would mean either discarding the team's issues or pushing a bigger scope into someone else's estimate. Linking keeps their summaries, points, sprint and history untouched. EN-04 and EN-06 cover the remaining scope and point back to them.

---

## 4. Batch 3: sprint placement

### 3.1 Story moves, each with a comment giving its reason

The comment format is: *"Moved in Sprint 2 by team decision (Gate B, reported 1 Oct 2026): <reason>."*

| Story | Key | From | To | Reason in the comment |
|---|---|---|---|---|
| F3 | SPM-29 | Sprint 2 | **Sprint 4** | Cancellation is one command with F4. Shipping it alone means rewriting it. |
| P1 | SPM-48 | backlog (planned for S3) | **Sprint 2** | Shares its time-based availability model with P2 |
| F5 | SPM-109 | backlog (planned for S4) | **Sprint 3** | Readiness becomes an in-core query once M1 and Q1 exist |
| R1 | SPM-52 | backlog (planned for S3) | **Sprint 4** | Built on the registration service's seat inventory. The PWA shell becomes a Sprint 3 enabler (EN-13). |
| S1 | SPM-57 | backlog (planned for S3) | **Sprint 3** | Ships behind feature flag `change-approval` (EN-15). Approval stays off in production until S3 can flag arrangements. |
| S2 | SPM-58 | backlog (planned for S3) | **Sprint 3** | Same as S1 |

### 3.2 Remaining planned stories go into their sprints

Sprints 3 and 4 didn't exist before Batch 1, so these stories have never been placed. They aren't moves, so they get no comment.
- **Sprint 3:** I2, K2, L1, L2, L3, M1, M2, N1, N2, Q1, Q2 (SPM-35, 39, 40, 41, 110, 42, 43, 44, 45, 50, 51)
- **Sprint 4:** F4, G2, R2, R3, R4, R5, R6, R7, S3 (SPM-111, 31, 53, 54, 55, 56, 112, 108, 59)

### 3.3 Enablers, PX and CQ

| Into | Issues |
|---|---|
| Sprint 2 | EN-01 to EN-09, PX-01 to PX-14, CQ-01 to CQ-03 (CQ in Sprint 2 because the questions need asking now) |
| Sprint 3 | EN-10 to EN-15 |
| Sprint 4 | EN-16 to EN-23 |

### 3.4 Assignees

None (Z4).

### 3.5 What each sprint holds after Batch 3

| Sprint | Stories | Other issues | Story points in Jira |
|---|---|---|---|
| 2 | 14: F1, F2, G1, H1, H2, I1, J1, J2, K1, O1, O2, **P1**, P2, T2 | 4 tasks, 9 EN, 14 PX, 3 CQ (**44 issues**) | 34, plus P1 not yet pointed. Tasks hold 12 more. |
| 3 | 14: I2, K2, L1, L2, L3, M1, M2, N1, N2, Q1, Q2, S1, S2, **F5** | 6 EN (**20 issues**) | 5 (F5). The rest are to be pokered. |
| 4 | 11: **F3**, F4, G2, **R1**, R2, R3, R4, R5, R6, R7, S3 | 8 EN (**19 issues**) | 3 (F3). The rest are to be pokered. |

On the CSV's earlier planning figures the totals would stay at 46, 55 and 47, as the plan intended. Jira will show only poker'd points.

**Load warning:** Sprint 2 ends 6 Oct with 9 enablers (47 proposed points) and 14 PX tasks added on top of 46 points of stories and tasks, against a velocity of 35. Most of them will carry into Sprint 3. That's fine as long as the Sprint 2 review and retro say it plainly. The playbook's planning advice applies: "If you plan above velocity, write down why."

---

## 5. Batch 4: repo documents

These edits stay uncommitted until you ask for a commit. CHANGELOG gets one entry for the whole batch.

### 5.1 `implementation.md`: the four design bugs

| # | Where | Change |
|---|---|---|
| 1 | §4.5 table, §4.6 "Equipment availability", §4.7 P2 bullet | Replace the time-agnostic `equipment.availability_counters` update with two mechanisms. Serialized units become rows in `equipment.unit_reservations`, with an exclusion constraint on `(unit_id, period)` WHERE RESERVED. Bulk stock takes `SELECT … FOR UPDATE` on the equipment-type row, then checks peak concurrent use across the window before inserting. The P2 reduction check uses the same type lock instead of SERIALIZABLE. The P1 question (peak or summed) is noted as waiting on CQ-02, and the design handles either answer. |
| 2 | §4.6 venue | Add: M1 approval and I2 block creation both take `SELECT … FOR UPDATE` on the venue row, so a block can't slip past an in-flight approval. `period` becomes `blocked_period` (`[start − setup, end + teardown)`, buffers zero in Release 1). |
| 3 | §4.6 venue | Add: Requires Reconfirmation is a boolean column (`requires_reconfirmation`), never a status, so a flagged booking keeps blocking its slot. A hold that L1 converts keeps its slot HELD until M1 or M2 decides. |
| 4 | §4.7 F1 bullet | Replace "re-verify inside the writing transaction". Under ADR-0004, F5 reads the booking and reservations in the same core transaction: one Postgres transaction, no HTTP. "Never hold a transaction open across HTTP" now has no exception. |
| + | Top of the file | A short note: "ADR-0004 to 0015 were accepted on 2026-10-01. Where §2, §3 (topic naming, polling relay), §4.6 (registration counters) or §6 conflict with them, the ADR wins until those sections are rewritten (EN-01, EN-04, EN-07 and EN-13 owners)." |

### 5.2 ADRs, all **Accepted 2026-10-01**

Each one has Context, Decision, Alternatives considered, Consequences and an Owner, written from the architecture page's §3 (the decision, the "Because", the "Rejected" and the "Cost" sections). The format follows the existing `0001` to `0003`.

| ADR | Decision | From | Relation | Owner (Z6) |
|---|---|---|---|---|
| 0004 | A modular core instead of six microservices | D1 | **Amends ADR-0001** | assignee of EN-01 |
| 0005 | Split out the public edge as a registration service | D2 | | assignee of EN-13 |
| 0006 | Postgres enforces every invariant | D3 | | assignee of EN-02 |
| 0007 | Event-source the Event aggregate | D4 | | assignee of EN-03 |
| 0008 | Kafka with a CDC outbox, CloudEvents and a schema registry | D5 | | assignee of EN-04 |
| 0009 | Temporal runs cross-service steps and timers | D6 | **Supersedes ADR-0002** | assignee of EN-11 |
| 0010 | Policy-as-code for actions, row-level security for data | D7 | | assignee of EN-07 |
| 0011 | Edge: gateway, CDN, rate limits, waiting room | D8 | | assignee of EN-12 |
| 0012 | Containers on managed Kubernetes, GitOps, Terraform | D9 | **Supersedes ADR-0003** (Gate D) | assignee of EN-10 |
| 0013 | OpenTelemetry and SLOs | D10 | | assignee of EN-08 |
| 0014 | Two front ends, one contract | D11 | | assignee of EN-14 |
| 0015 | Contract-first HTTP APIs | D12 | | assignee of EN-09 |

Status lines change on the existing ADRs as follows. Their bodies are untouched.
- ADR-0001 → "Accepted, amended by ADR-0004 (2026-10-01)"
- ADR-0002 → "Superseded by ADR-0009 (2026-10-01)"
- ADR-0003 → "Superseded by ADR-0012 (2026-10-01)"

`documentation/adr/README.md` gets the new index rows.

### 5.3 `CLAUDE.md`

The no-Docker paragraph is replaced with these points:
- ADR-0012 supersedes ADR-0003.
- Container images are built in CI only (EN-10).
- Local development still runs with `npm run dev` against the team's hosted Supabase project and the hosted Kafka cluster (`KAFKA_*`).
- CI integration tests use an ephemeral Postgres and never the shared database (EN-06).

The layout paragraph and the Superpowers paragraph are unchanged.

### 5.4 `plan.md`

| Section | Change |
|---|---|
| §2 | The architectural position becomes a modular core plus two edge services (ADR-0004, 0005) |
| §3 | The containers table follows the architecture page §2 |
| §4 | Ownership: modules and schemas inside `planning-core`, plus the registration and notification databases |
| §5 | How services talk: CDC outbox, CloudEvents, topics per aggregate (ADR-0008) |
| §6 | The invariants table follows ADR-0006 |
| §7 | The distributed-transaction answer becomes Temporal plus the semantic lock (ADR-0009) |
| §8 | Topology: `npm run dev` locally, staging per ADR-0012 |
| §9 | The new allocation from §4.5 above, with enablers per sprint |

Also in §9:
- **Sprint 1 restated as 35** (Jira).
- **Sprint 2 shown as Jira's numbers:** 37 at the 27 Sep session, and 34 plus an unpointed P1 after the moves.
- A short note explaining the earlier figures: 34 (transcript), 44 planned, 47 delivered and 52 (CHANGELOG) came from document estimates, not the poker votes.
- Each moved story says "moved in Sprint 2 by team decision on 2026-10-01".
- The CSV filename reference is fixed.

### 5.5 `documentation/sprint allocation.csv`

- *New Sprint* is updated for F3 (4), P1 (2), F5 (3) and R1 (4). *Change* and *Reason* carry the plan's reason and "moved in Sprint 2 by team decision on 2026-10-01".
- *New Points* takes Jira's value where Jira has one and is otherwise blank, meaning "to be poker'd" (playbook gap 1).
- *Old Points* is untouched, since it's history.
- Enablers are not added. The CSV stays a story allocation.

### 5.6 `CHANGELOG.md`

- Four entries with `**Author:** Joash`: Batches 1, 2 and 3 under `# Jira changes`, and Batch 4 as a docs entry.
- The Batch 4 entry includes the Sprint 1 correction note, appended as new text. Old entries aren't edited.

### 5.7 Gate log (plan file §8)

| Gate | Date | Agreed by | Notes |
|---|---|---|---|
| A | 2026-10-01 | The team, as reported by Joash | Joash reported on 1 Oct 2026 that the team approved the whole plan. Add the channel, meeting date and names from the Telegram thread or meeting notes. |
| B | 2026-10-01 | The team, as reported by Joash | Covers the story moves and adding enablers to Sprint 2 mid-sprint. No Sprint 2 PO is named yet (PX-11), so record who signed off as PO. |
| C | | | Not passed. No points written for enablers or Sprint 3 and 4 stories until the team pokers them (PX-02). |
| D | 2026-10-01 | The team, as reported by Joash | Recorded in ADR-0012, which supersedes ADR-0003. `CLAUDE.md` updated. |

---

## 6. Open items, not applied

| Item | Status |
|---|---|
| **Test issues SPM-82 to 107** | Not restored. What's known: they existed (CHANGELOG 2026-09-15, and A3's history shows a link to SPM-90 that's now gone). Today they return "not found", a site-wide search finds none, and SPM no longer has a `Test` issue type. Removing an issue type is one way issues of that type disappear, but nothing here confirms it. **Ask Chai**, who renamed them on 15 Sep. If the team confirms they were deleted, restore them as **Subtasks** under each Sprint 1 story, because Jira won't add issues to a closed sprint directly. Use `<code>-T<n> — <title>` from `tests/<story>/`, and add a CHANGELOG note. **Scale:** `tests/` now holds 123 test-case files for A1 to E2, not the 26 that existed, so decide between all 123 and only the original 26. |
| Sprint 2 PO | Not named (playbook gap 10). Needed for Gate B's record and for the CQ assignee. |
| EN-11 blocks F1 across sprints | Raise at the Sprint 2 review. |
| `implementation.md` sections that conflict with the ADRs | Flagged by the note in §5.1, not rewritten. |
| Recess week | If SMU has a recess week in October, decide whether Sprints 3 and 4 pause for it. The dates above end by 3 Nov, before Friday of Week 12 either way. |

---

## 7. Verification after all batches

| JQL | Expected |
|---|---|
| `project = SPM AND sprint = 68` | 44 |
| `project = SPM AND sprint = "SPM Sprint 3"` | 20 |
| `project = SPM AND sprint = "SPM Sprint 4"` | 19 |
| `project = SPM AND issuetype = Story AND sprint is EMPTY` | 1 (T1, Done) |
| `project = SPM AND labels = enabler` | 28 (1 epic + 23 EN + SPM-113 to 116) |
| `project = SPM AND labels = tier-1` | 20 (16 EN + SPM-113 to 116) |
| `project = SPM AND labels = tier-2` | 7 |
| `project = SPM AND labels = process` | 15 (1 epic + 14 PX) |
| `project = SPM AND labels = customer-question` | 3 |
| `project = SPM AND issuetype = Epic AND status = Done` | 5 |
| `project = SPM AND labels = enabler AND "Story point estimate" is not EMPTY` | 4 (only SPM-113 to 116) |
| Outward "blocks" links on EN issues | 41, counted per issue with `getJiraIssue` |

The report lists counts per sprint and per label, plus every call that failed and its error.
