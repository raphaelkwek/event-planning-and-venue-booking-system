# Target architecture and Jira rollout plan (proposal)

**Status:** Gates A, B and D passed on 2026-10-01 (reported by Joash; see §8). Gate C (points) is still open.
**Author:** Joash, 2026-10-01.
**For:** a fresh Claude Code session that will carry this out with Joash. Read this whole file first, then `CLAUDE.md` and `documentation/planning/implementation.md` as usual.

Background pages (private to Joash; open them with the Artifact tool's `read` action if you need detail):
- Target architecture, with plain-language explanations of every enabler: https://claude.ai/artifact/RidT3EjD2swYM4zitxEp1V
- Sprint evidence playbook, with templates: https://claude.ai/artifact/TkjFBYHnLgNaMX4VAyk8bY
- Architecture video (local only): `C:\Users\Joash Lau\connectsphere-manim\ConnectSphere_Architecture.mp4`

---

## 1. Rules for the session doing this work

1. **Dry run first, every time.** Before any Jira write, produce the exact change list (a file named in §4) and get Joash's explicit "go" for that batch. Same for repo edits that change team documents.
2. **Never invent story points.** The Week 3 slides say "don't outsource the estimate". Points for stories and enablers come only from the team's planning poker, which Joash will give you. Proposed numbers in this file go in an issue's description as "Proposed estimate (to be poker'd): N", never in the Story Points field.
3. **Never delete Jira issues or repo records.** The team rule is that nothing is hard-deleted (`implementation.md` §4.3). Close, relabel or link instead. The Atlassian MCP's delete tools are off by default; leave them off.
4. **Respect the gates in §2.** If a gate hasn't been passed, stop and say so.
5. **No Docker, Kubernetes or Terraform files** until Gate D. `CLAUDE.md` and ADR-0003 currently forbid Docker, and only the team can change that.
6. **Log every Jira change in `CHANGELOG.md`** under a `# Jira changes` heading, newest first. Include a timestamp in SGT, `**Author:** Joash`, the reason and a numbered list of changes, matching Chai's 2026-09-15 entry. A batch without an entry isn't done.
7. **Avoid duplicates.** Before creating an issue, search for its code in the summary (for example `summary ~ "EN-04"`). If it exists, update it instead.
8. **Follow the team's Jira conventions** (§3).

## 2. Approval gates

| Gate | Who approves | Unlocks |
|---|---|---|
| **A** | The team, after Joash's Telegram message and the Wednesday meeting | Creating the two new epics, the enabler issues (in the **backlog**, no sprint, no points), the scrum-evidence tasks and the customer-question tasks |
| **B** | The Product Owner (Sprint 2 is already running, so this is a recorded mid-sprint change) | Moving stories between sprints, adding enablers and tasks into Sprint 2, editing `plan.md` §9 and `sprint allocation.csv` |
| **C** | Team planning poker, results given by Joash | Writing Story Points on stories and enablers |
| **D** | Whole team, recorded in a new ADR that supersedes ADR-0003, plus a `CLAUDE.md` update | Container, Kubernetes, Terraform and GitOps work (EN-10, EN-16, EN-21) |

Record each gate as it passes (date and who agreed) at the bottom of this file.

## 3. Jira facts and conventions

- **Project key:** `SPM`. Example keys: SPM-61 is story T2, SPM-82 to 85 are shared test subtasks, SPM-86 to 107 are Sprint 1 test issues.
- **Story summary:** `<code> — <title>`, using an em dash, e.g. `T2 — Read and manage my notifications`.
- **Test issue summary:** `<code>-T<n> — <title>`, e.g. `A1-T1 — Valid login (Organiser)`. Shared tests use the feature letter only: `F-T1`, `E-T1`.
- **Enabler summary (new):** `EN-<nn> — <title>`, e.g. `EN-04 — Kafka messaging done safely`.
- **Scrum-evidence task summary (new):** `PX-<nn> — <title>`.
- Sprint 1 committed **35 points** in Jira. Jira is the single source of points.
- Earlier bulk edits were driven by an instruction file (`Jira__2_.md`, not in the repo). Follow the same pattern with the change-set file in §4.

## 4. Phases

### Phase 0: Connect and discover (read-only, no gate)

1. Check the Atlassian MCP is authenticated (Joash runs `/mcp` → atlassian → Authenticate). If tools aren't available, stop and tell Joash.
2. Read and write down:
   - the SPM project type (team-managed or company-managed);
   - the issue types available, and which ones carry the story points field and what it's called (`Story point estimate` or `Story Points`);
   - how the Epic link or parent is set;
   - the board, its sprints (names, ids, state, dates) and whether Sprint 3 and 4 exist yet;
   - every story A1 to T2 with its key, sprint, status, points and assignee;
   - existing epics, labels and link types.
3. Save the result to `documentation/planning/jira-snapshot-2026-10.md`. It becomes evidence of the starting state, and diffs later will be honest.
4. Report any mismatch between Jira and `documentation/sprint allocation.csv` or `plan.md` §9, without fixing it yet.

### Phase 1: Write the change set (no gate to write it, Gate A to apply)

Create `documentation/proposals/2026-10-jira-changeset.md`, listing every Jira write grouped by gate. For each item give the action (CREATE, UPDATE or LINK), issue type, summary, description, labels, parent epic, links and the target sprint or backlog. Joash reviews it, then you apply one gate's group at a time.

### Phase 2: Apply Gate A

1. Create epic `Platform and quality enablers` (label `enabler`).
2. Create epic `Scrum process evidence` (label `process`).
3. Create EN-01 to EN-23 from §5, in the backlog with no sprint and no points. Label each `enabler` plus `tier-1` or `tier-2`. Put "Proposed estimate (to be poker'd): N" and "Proposed sprint: N" in the description, and add the "blocks" links from §5.
4. Create PX-01 to PX-14 from §6 under the process epic, in the backlog.
5. Create the customer-question tasks CQ-01 to CQ-03 from §7, assigned to the PO.
6. Write the CHANGELOG entry, then verify with JQL (`project = SPM AND labels in (enabler, process)`) and report counts.

### Phase 3: Apply Gate B (PO approval)

1. Story moves (sprint story totals stay 46, 55, 47):

   | Story | From | To | Reason |
   |---|---|---|---|
   | F3 | Sprint 2 | Sprint 4 | Cancellation is one command with F4. Shipping it alone means rewriting it. |
   | P1 | Sprint 3 | Sprint 2 | Shares its time-based availability model with P2 |
   | F5 | Sprint 4 | Sprint 3 | Readiness becomes an in-core query once M1 and Q1 exist |
   | R1 | Sprint 3 | Sprint 4 | Built on the registration service's seat inventory |
   | S1, S2 | Sprint 3 | Sprint 3, behind feature flag `change-approval` | Approval stays off in production until S3 lands |

2. Add whichever enablers the PO accepts into their sprint.
3. Comment the reason for each move on the moved issue.
4. Update `plan.md` §9 and `documentation/sprint allocation.csv` to match Jira exactly, with a "moved in Sprint 2 by PO decision on <date>" note.
5. Write the CHANGELOG entry.

### Phase 4: Apply Gate C (poker results)

Write the team's agreed points. Restate Sprint 1 as 35 wherever the repo says otherwise:
- `plan.md` currently says 44 planned and 47 delivered;
- `CHANGELOG.md` has a "52" figure;
- the CSV's old-points columns don't match the poker votes.

Add a short note explaining the correction, and don't silently rewrite history.

### Phase 5: Repo design documents (Gate A for the bug fixes, Gate B for the architecture ADRs)

1. Fix the four design bugs in `implementation.md`:
   - **§4.6 equipment:** the time-agnostic `availability_counters` can't satisfy P1, Q1 or P2. Replace it with per-unit reservations under an exclusion constraint, plus a per-type row lock and peak check for bulk stock.
   - **§4.6/§4.7 venue:** M1 approval and I2 block creation both take `SELECT … FOR UPDATE` on the venue row. Requires Reconfirmation is a boolean flag, never a status, and a hold converted to a request keeps its slot HELD until M1 or M2 decides.
   - **§4.7 F5:** the "re-verify inside the writing transaction" line contradicts "never HTTP inside a transaction". Resolve it per the chosen architecture.
2. Write ADR-0004 to ADR-0015 with status **Proposed**, one per decision D1 to D12 on the architecture page. ADR-0004 (modular core) amends ADR-0001. The cancellation ADR supersedes ADR-0002. The containers ADR supersedes ADR-0003 and needs Gate D. Each one has context, decision, alternatives, consequences and an owner.
3. Raise the story defects with the PO (see §7). Don't edit `final user stories.md` acceptance criteria until the customer answers.

### Phase 6: Build (sprint work, done by story owners)

Implementation happens inside sprints by whoever owns each story or enabler, following `implementation.md` §11 (stay in your module, write tests and functional test cases first, add a traceability row, write a CHANGELOG entry). Suggested order, risk first:

1. EN-06 (CI v1)
2. EN-01 (modular core)
3. EN-02 (invariant kernel)
4. EN-04 (messaging)
5. EN-07 (authz)
6. EN-08 (OpenTelemetry)
7. EN-09 (C4 and ADRs), in parallel
8. Sprint 3: EN-11, EN-13, EN-14, EN-15 (Tier 1), then EN-10 and EN-12 (Tier 2, EN-10 needs Gate D)
9. Sprint 4: EN-17, EN-18, EN-20, EN-22, EN-23, then Tier 2 if there's capacity

---

## 5. Enablers (create in Gate A)

Columns: proposed sprint, **proposed** estimate (to be poker'd), tier, the stories each one "blocks", and acceptance criteria. Plain-language explanations of each are on the architecture page, §13b.

| ID | Title | Spr | Est | Tier | Blocks | Acceptance criteria |
|---|---|---|---|---|---|---|
| EN-01 | Modular core with boundary checks | 2 | 5 | 1 | F5, F4, S2, S3, G2 | Identity and Event run as one deployable `planning-core`, each a module with a public index. dependency-cruiser fails CI on cross-module internal imports. A check fails CI on SQL touching another module's schema. All A–E tests still pass, and `npm run dev` starts core and web. |
| EN-02 | Invariant kernel | 2 | 8 | 1 | L3, M1, N1, I2, P1, P2, Q1 | `venue_slots` with an exclusion constraint on `blocked_period` for HELD or CONFIRMED. Requires Reconfirmation is a flag column. Approval and block creation both lock the venue row. Equipment units have a per-unit exclusion constraint, and bulk stock uses a type lock plus peak check. A race harness fires 50 parallel attempts and exactly one wins, for both a venue slot and a unit. |
| EN-03 | Event store and projections | 2 | 8 | 2 | F1, F2, G1, S2 | An append-only `event_stream` with `unique(aggregate_id, version)` and a hash chain. Projections update in the same transaction. A–E data is migrated. F1 and F2 history read from the stream. A tamper check detects an edited entry. |
| EN-04 | Kafka messaging done safely | 2 | 5 | 1 | T2 and every notification AC | Hosted Kafka chosen (an ADR records why). Topics per aggregate, keyed by aggregate id. CloudEvents envelope validated by `contracts`. The relay uses `FOR UPDATE SKIP LOCKED`. The notification consumer has an inbox table, retry topics and a DLQ. Tests: a duplicate message creates one notification, and broker downtime loses nothing. |
| EN-05 | CDC and schema registry | 2 | 3 | 2 | (improves EN-04) | Spike first: confirm Supabase allows a logical replication slot. Debezium outbox router replaces the relay. CI checks backward compatibility against the schema registry. |
| EN-06 | CI pipeline v1 | 2 | 5 | 1 | All stories (DoD) | GitHub Actions on every PR runs lint, typecheck, unit tests with 100% domain coverage, Stryker on the domain (≥ 80%), integration tests on an ephemeral Postgres (never the shared DB), squawk, CodeQL and gitleaks. Branch protection requires it. The ubuntu runner's preinstalled Postgres avoids Docker. |
| EN-07 | Permission policies and row-level security | 2 | 5 | 1 | A2, A3 | Cerbos policies in the repo, evaluated by the gateway, services and SPA navigation. A3 enforced with RLS, using a per-request role and `SET LOCAL` claims inside each transaction. A generated matrix test covers role × endpoint × related and unrelated resources. |
| EN-08 | OpenTelemetry and Grafana | 2 | 5 | 1 | (supports EN-17) | Services instrumented (HTTP, pg, kafkajs), with trace context carried in Kafka headers. Correlation id is the trace id. A Grafana trace shows one approval end to end. |
| EN-09 | C4 as code, ADRs, API specs | 2 | 3 | 1 | Deliverable 2 | Structurizr DSL committed (L1–L3, a deployment view, dynamic views for F4 and R2) and rendered in CI. ADR-0004 to 0015 written. OpenAPI per service, AsyncAPI for events. |
| EN-10 | Containers, Terraform, Kubernetes, GitOps | 3 | 8 | 2 | EN-16, EN-21 | **Gate D first.** Images built in CI only. Terraform for the cluster, network and Redis. Argo CD syncs staging from a config repo. README deploy steps. |
| EN-11 | Temporal workflows | 3 | 5 | 1 | F1, F4, R6, S3 | Temporal workers. A CompleteEvent timer (F1). A CancelEvent workflow with a semantic lock (freeze, commit, finalise, with unfreeze on failure). Time-skipping tests and replay tests in CI. |
| EN-12 | API gateway, rate limits, CDN | 3 | 5 | 2 | R1, R2, EN-19 | Kong with the JWT plugin against the Supabase JWKS. Per-user and per-IP rate limits backed by Redis. Trace headers. Separate staff and public routes. CDN in front of the SPA and the browse API. |
| EN-13 | Registration service and seat inventory | 3 | 5 | 1 | R1 to R7 | Its own service and database. A `seats` table claimed with `FOR UPDATE SKIP LOCKED`, with public and VIP pools. Seats created from `booking.confirmed`. Attendee PWA shell. |
| EN-14 | Preview environments and browser tests | 3 | 5 | 1 | All stories | A per-PR preview (or ephemeral CI stack). Playwright E2E tagged with story test ids. axe accessibility checks. Visual snapshots at 360, 768 and 1280 px. |
| EN-15 | Feature flags | 3 | 2 | 1 | S1, S2 | OpenFeature with flagd. Flag `change-approval` gates S2 approval in production. |
| EN-16 | Canary releases | 4 | 3 | 2 | (needs EN-10) | Argo Rollouts canary at 10, 50 and 100%, with Prometheus analysis of error rate and p95. Automatic rollback demonstrated. |
| EN-17 | SLOs, alerts, dashboards, runbooks | 4 | 3 | 1 | (needs EN-08) | SLOs written down: registration p95 ≤ 800 ms at 500 req/s, zero over-admission, staff p95, notification freshness within 10 s, 99.9% availability. Burn-rate alerts and a runbook per alert. |
| EN-18 | Load tests and autoscaling | 4 | 3 | 1 | (needs EN-13) | k6 spike test (500 req/s for 100 seats gives exactly 100 registered), soak and stress tests. Autoscaling tuned. Results committed as evidence. |
| EN-19 | Virtual waiting room | 4 | 2 | 2 | (needs EN-12) | Admission tokens for events flagged high-demand, at the tested rate. |
| EN-20 | Chaos experiments | 4 | 3 | 1 | (needs EN-04, EN-11, EN-13) | Six experiments (architecture page §7), each with a hypothesis, result and fix log. Toxiproxy in CI. |
| EN-21 | Software supply chain security | 4 | 3 | 2 | (needs EN-06, EN-10) | SBOM, cosign signatures, Trivy and a ZAP baseline scan in the pipeline. |
| EN-22 | Traceability generator and DORA dashboard | 4 | 3 | 1 | Deliverable 3 | Generates the story → AC → test → last-result matrix from test tags on every CI run. Tracks the four DORA metrics. |
| EN-23 | Threat model, PDPA review, ASVS checklist | 4 | 2 | 1 | Deliverable 2 | A STRIDE table per container, a PDPA note on attendee data, and an ASVS Level 2 checklist mapped to controls. |

Proposed totals: Tier 1 = 67, Tier 2 = 32 (Sprint 2: 36 + 11, Sprint 3: 17 + 13, Sprint 4: 14 + 8). Sprint 1 delivered 35 by Jira, so this is well above velocity. The team chooses what to keep at Gate B, and Tier 2 is cut first.

## 6. Scrum-evidence tasks (create in Gate A, `Scrum process evidence` epic)

| ID | Title | Suggested owner | Done when |
|---|---|---|---|
| PX-01 | Make Jira the single source of story points | PO | Sprint 1 restated as 35 in `plan.md`, the CSV and `CHANGELOG.md`, with a note on the earlier figures |
| PX-02 | Re-estimate Sprint 2–4 stories and enablers with planning poker | Whole team | A recorded session. Lowest and highest vote plus the reason noted per item. |
| PX-03 | Estimation reference | PO + SM | A reference story (suggest C1 = 2) and a one-line meaning for 1, 2, 3, 5 and 8, kept in Confluence or the repo |
| PX-04 | Standup log | SM | A sheet or Confluence table. Two live 15-minute calls a week plus written entries on other days (done, next, blockers, goal on track). Not back-filled for Sprint 1. |
| PX-05 | Sprint 2 planning record | SM + PO | Written from the agreed plan (roles, goal, dates, capacity, stories, points, owners, risks, carry-over), honestly dated as written up later |
| PX-06 | Burndown and velocity | SM | Jira Reports enabled. A sprint burndown screenshot and a two-sentence reading on the last day of each sprint. An across-sprint burndown sheet starting from Sprint 1 = 35. |
| PX-07 | Customer clarification log | PO | `documentation/clarifications.md` with C-01 onwards (question, answer, decision, stories changed), including the C-04, C-10 to C-13 already cited |
| PX-08 | Review record with demo log and proxy feedback | PO | A template used from the Sprint 2 review onward. The PO acts as the customer's proxy and their feedback is recorded. |
| PX-09 | Retro follow-up | SM | Every retro opens by reviewing the last one's actions (done? helped? evidence?) |
| PX-10 | AI-usage log | All | A short entry per story: what the AI produced, what a human reviewed or changed, and who |
| PX-11 | Roles per sprint | Team | A roles table in every planning record. The Sprint 2 PO is named (rotation agreed at the Sprint 1 retro). |
| PX-12 | Sprint 4 recordings plan | SM | Four separate sessions booked (planning, one standup, review, retro) and uploaded as unlisted videos |
| PX-13 | Week 7 consultation questions | SM | The six questions from the playbook, §7, asked and the answers written down |
| PX-14 | Changed-requirements note | PO | A "what changed and why" section in the next planning record: T1 removed, F1/F3 split, L3/R6/R7 added |

Templates for PX-04, 05, 07, 08 and 09 and the AI log are on the playbook page, §8.

## 7. Customer questions (create in Gate A, assigned to the PO)

| ID | Question for the G1 customer | Why |
|---|---|---|
| CQ-01 | R7 allows a VIP add "even when no registration places remain" but refuses anything above venue capacity, while R2 defines places as capacity minus VIP adds. Should VIPs come from a reserved pool set by the organiser? | As written, R7's first clause can never apply. The design supports both answers with public and VIP seat pools. |
| CQ-02 | P1: for a long window, should available equipment be total minus peak concurrent use, or minus every overlapping reservation added up? | The literal text counts back-to-back bookings as simultaneous |
| CQ-03 | T2: is it acceptable for the notification to be committed with the action as an intent and become visible within about 10 seconds? | An asynchronous notification can't be created inside the triggering transaction |

Design-only fixes that need no customer answer: a converted L3 hold keeps its slot HELD until M1 or M2 decides (the story's own wording says so), and the I2 vs M1 race is fixed by the venue row lock.

## 8. Gate log

| Gate | Date | Agreed by | Notes |
|---|---|---|---|
| A | 2026-10-01 | The team, as reported by Joash | Joash reported on 1 Oct 2026 that the team approved the whole plan. Add the channel, meeting date and names from the Telegram thread or meeting notes. Applied as Batch 2 (CHANGELOG, 1 Oct). |
| B | 2026-10-01 | The team, as reported by Joash | Covers the story moves and adding enablers and PX tasks to Sprint 2 mid-sprint. No Sprint 2 PO is named yet (PX-11), so record who signed off as PO. Applied as Batch 3. |
| C | | | **Not passed.** No points are written for enablers or for Sprint 3 and 4 stories until the team pokers them (PX-02). |
| D | 2026-10-01 | The team, as reported by Joash | Recorded in ADR-0012, which supersedes ADR-0003's no-Docker rule. `CLAUDE.md` updated. Applied in Batch 4. |

Status after the 1 Oct rollout: Phases 0, 1, 2, 3 and 5 are done. Phase 4 (points) waits for Gate C. Phase 6 (building) is sprint work for each item's owner.
