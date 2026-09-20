# Sprint 1 — Sprint Review & Sprint Retrospective

**Date:** 20 September 2026, 13:10–13:43 SGT
**Attendees (Scrum Team):** Yichen Chai (Scrum Master), Raphael Kwek Siew Ray (Product Owner), Seann Khoo Jian En, Chirani Sahanya Wickramanayake — Developers
**Absent:** Joash Lau Rong Wei
**Stakeholders present:** None. This sprint has no external stakeholder — the team is its own Product Owner and audience, so the "gather stakeholder feedback" step of Sprint Review (Week 3 slides, p.50) does not apply and is recorded below as not applicable rather than skipped silently.
**Source:** Team call transcript, 20 Sep 2026 (Sprint Review + Retrospective run back-to-back in one session).

---

## 1. Sprint Review

*Per the Scrum framework (Week 3 slides, p.50–51): inspect the increment and sprint outcomes, discuss progress toward the product goal, gather stakeholder feedback, adapt the product backlog.*

### 1.1 Sprint Goal recap

Sprint 1 was an **infrastructure-heavy sprint, not a pure feature sprint** — deliberately, since no vertical feature slice could be built without first settling the tech stack (Supabase-hosted Postgres + Auth, the service boundaries, the local dev loop). The goal was to get the core lifecycle — login/authorisation, event request creation, draft handling, review and approval, coordinator assignment — working end-to-end against a real hosted database, with a basic UI to interact through.

### 1.2 What was inspected (the increment)

- **Infrastructure:** hosted Supabase Postgres and Auth stood up and in use by every service; identity and event schemas migrated; the app runs against the real hosted database rather than a local stand-in.
- **Delivered stories:** A1, A2, A3, B1, B2, C1, C2, C3, D1, D2, D3, D4, D5, E1, E2 — the full identity/access, event request, draft, review-and-approval, and coordinator-assignment slice. This includes the full review workflow (D2–D5) and the coordinator reassignment handshake (E2), both originally scoped for Sprint 2, finished ahead of schedule.
- **No F-series items (F1, F2, etc.) were built this sprint.** An earlier draft of this document claimed F1 was delivered; that does not match what the team actually built and appears to be inaccurate carryover from another document/agent rather than a verified fact — treat it as wrong until independently confirmed.
- **Not delivered / carried over:** T2 (notification read/manage) was planned for Sprint 1 but not started; it moves into Sprint 2, alongside the F-series work. Kafka and the outbox relay also did not happen this sprint — outbox rows are written, but nothing yet publishes them.
- **Testing status:** automated CI/test-suite execution is intentionally not in scope yet — the teaching team confirmed scripted testing hasn't been covered in the course at this point, so Sprint 1's Definition of Done runs on manual functional test cases (per `documentation/planning/definition-of-done.md`), with automated tests as a bonus where already written. AI-assisted test cases were written and independently reviewed by a human (Seann / Joash) before being counted as verified — not just self-validated.
  - Cross-cutting test cases that depend on services not yet built (queued across the yet-unbuilt Venue/Equipment/Registration services) were corrected from an inaccurate "Blocked" status to the accurate "Not Executed" status — they were never blocked, they were simply out of scope for a sprint that never committed to building those services.
  - One case, **E1-T3** (coordinator assignment when no eligible coordinator is configured), cannot be exercised automatically and needs a manual run — assigned to Seann, currently counted as completed pending that manual pass.

### 1.3 Progress toward the product goal

The team completed the full A1–E2 vertical slice: login and role-scoped sessions, role-based access restriction, event-scoped visibility, event request creation and validation, drafts, the full review/clarification/approve/reject workflow, and coordinator assignment plus reassignment. In the meeting, an initial ballpark percentage-complete figure was raised and then corrected live — but story points across the team's planning documents currently disagree with each other (see §2.3), so no percentage-complete figure is stated here until that's reconciled. A qualitative progress chart, not a points-based one, is a known follow-up (§2.5).

### 1.4 Stakeholder feedback

Not applicable this sprint — there is no external stakeholder audience; the team reviews its own increment.

### 1.5 Product backlog adaptation

- All Sprint 1 items have already been moved to Done in Jira.
- The sprint allocation record (`documentation/traceability/` CSVs) was updated to reflect that E1 and E2 were pulled forward and completed in Sprint 1 rather than Sprint 2, so the backlog now matches what actually happened rather than what was originally planned.
- Full backlog re-prioritisation for Sprint 2 was explicitly **not** done in this session — the team agreed it needs research before the next Sprint Planning, rather than being decided live on a call with no prep.

---

## 2. Sprint Retrospective

*Per the Scrum framework (Week 3 slides, p.53–54): inspect people, interactions, processes, tools, and the Definition of Done; identify what went well and what problems occurred; select concrete improvements; put them into practice.*

### 2.1 What went well

- **Standardised Git commit conventions, and a well-maintained `plan.md` / `implementation.md`.** Because the architecture and implementation contracts were written down clearly before agent-driven development started, running multiple AI coding agents against the shared repo produced very little merge conflict.
- **README and CHANGELOG discipline.** Every piece of work is timestamped and documented consistently, which made this sprint's documentation — traceability, standup logs, and this review itself — straightforward to assemble and verify against.

### 2.2 What problems occurred

| Problem | Detail |
|---|---|
| **Fragmented, subgroup communication** | Most coordination happened as ad-hoc DMs between whoever happened to be talking (Raphael, Seann, Chai), with no shared channel. Sahanya reported not knowing what was going on until caught up individually — the team had drifted back into working in silos, which is exactly what daily/shared communication is meant to prevent. |
| **Single-person testing bottleneck** | One person (Seann) was effectively responsible for running and validating tests, making him a bottleneck at the end of the pipeline rather than testing happening continuously alongside development. |
| **No fixed, reliable meeting time** | Calls did not have full attendance because no single time slot was agreed in advance; Joash has been late to every session so far. |
| **No agreed channel for raising blocking problems** | The team had been improvising between direct messages and no formal issue tracker, making it unclear where a blocking problem should be raised versus a routine status update. |

### 2.3 Root cause: the backlog was never reconciled against the plan

Worth stating plainly rather than glossing over: **`plan.md`'s architecture-side Sprint 1 story list and the Jira backlog actually poker'd and ticketed for Sprint 1 were never the same list.** `plan.md` counted F1, F2, and T2 as part of Sprint 1; the Jira backlog that was actually built against carried D2–D5 and E2 instead, and no F-series item was built at all. Nobody sat down and reconciled the architecture-side plan against the concrete Jira backlog before the sprint started, so the two diverged from day one and work proceeded against whichever list a developer had in front of them.

**Story points are not a reliable way to describe the size of this gap right now** — the team has found conflicting, apparently AI-agent-generated point totals across different planning documents for what should be the same Sprint 1 scope, and untangling which (if any) is correct is a separate piece of work, not something to paper over with a number here. The actual failure is upstream of estimation: work items were never fully allocated to the sprint against the plan, and story points were tracked in multiple places that were never kept in sync. The fix for Sprint 2 is a single reconciliation pass between the architecture plan and the Jira backlog before Sprint Planning closes, with one authoritative place for story points — not tighter poker estimates.

### 2.4 Improvements selected (Start / Stop / Continue)

**Start**
- A **fixed weekly meeting slot — Wednesday, before class** — so attendance stops being ad hoc. Review, Retrospective, and the next Sprint Planning will be run together at each sprint boundary, since the end of one sprint and the start of the next fall on the same day anyway.
- **GitHub Issues for anything that blocks work or needs the team to agree on something**, posted with a note in the Telegram channel so it isn't missed. The Telegram channel itself stays for day-to-day status ("what's being done"), not for problem-solving discussions that need to converge on a decision.
- **Each developer runs their own tests**, rather than routing everything through one person at the end. This is reinforced by automated testing becoming available from Sprint 2 onward, once the course covers it.
- **Rotate the Product Owner role each sprint** so more than one person gets the experience. A candidate for Sprint 2 was floated but not finalised in this session.

**Stop**
- Coordinating primarily through private, subgroup DMs that leave part of the team out of the loop.
- Recording test outcomes with an inaccurate status (e.g. "Blocked" for tests that were never going to be unblocked this sprint) — call it what it actually is ("Not Executed") so the record is trustworthy.

**Continue**
- The standardised commit-message convention and shared `plan.md` / `implementation.md` contracts that kept multi-agent development conflict-free.
- Reviewing AI-generated test cases with a human before counting them as verified.
- Keeping README and CHANGELOG current as the primary record of what happened and why — this document is itself an example of that discipline.

### 2.5 Action items

| Action | Owner | Status |
|---|---|---|
| Manually execute E1-T3 (no eligible coordinator case) and update its record | Seann | Open |
| Correct cross-cutting test cases' status from "Blocked" to "Not Executed" | Raphael | Done (during this call) |
| Update sprint allocation / traceability records to reflect E1 & E2 pulled into Sprint 1 | Seann | Done (during this call) |
| Add a sprint burndown/progress chart to Jira/Confluence | Chai | Open |
| Lock in the fixed weekly Wed-before-class slot for Review + Retro + Planning | Whole team | Open — also requires resolving the sprint start/end day (currently Monday–Sunday) against a Wednesday meeting day |
| Adopt GitHub Issues for blocking problems, Telegram for day-to-day status | Whole team | Open |
| Finalise who product-owns Sprint 2 | Whole team | Open |
| Reconcile `plan.md`'s Sprint 2 story list against the actual Jira backlog before Sprint Planning closes, so the two never diverge the way Sprint 1's did | Raphael (PO) + Seann | Open |
| Establish one authoritative place for story points across planning documents — current point totals for Sprint 1 disagree with each other across documents | Raphael (PO) | Open |

---

*This closes Sprint 1's documentation. Sprint 2 begins with the next Sprint Planning session, which will also resolve the meeting-day / sprint-boundary alignment noted above.*
