# Jira snapshot: SPM, starting state (October 2026)

**Captured:** 2026-10-01T19:52+08:00 (SGT)
**Author:** Joash
**How:** read-only calls through the Atlassian MCP (`https://mcp.atlassian.com/v2/mcp`) as Joash's account. Nothing was written to Jira.
**Why:** Phase 0 of `documentation/proposals/2026-10-01-target-architecture-and-jira-plan.md`. This is the record of where Jira stood before any rollout change, so later diffs are honest. Mismatches are reported in §8 and deliberately **not** fixed.

Site: `https://smu-team-vkln2krm.atlassian.net` (cloudId `0a39bd75-ca73-4c09-9a58-fc7ade485bc3`).

---

## 1. Project

| Item | Value |
|---|---|
| Key / id | `SPM` / 10001 |
| Type | Software, **team-managed** (board type `simple`) |
| Board | `SPM board`, id **2** (the only board for SPM) |
| Issues visible | **79**: 55 stories, 20 epics, 4 tasks |
| Statuses (all issue types) | To Do (10004), In Progress (10005), Done (10006) |

## 2. Issue types and fields

| Issue type | id | Notes |
|---|---|---|
| Epic | 10007 | The 20 feature epics |
| Story | 10008 | All user stories |
| Task | 10010 | SPM-113 to 116 (Sprint 2 infrastructure) |
| Bug | 10009 | None in use |
| Subtask | 10006 | None in use |

There is **no `Test` issue type** in SPM (see §8, M8).

| Field | id | Notes |
|---|---|---|
| **Story point estimate** | `customfield_10016` | The team-managed points field. It is not called "Story Points". Present on Story, Task and Epic. |
| Sprint | `customfield_10020` | |
| Parent | `parent` | How a story is put under an epic. Team-managed projects have no separate "Epic Link" field. |
| Rank | `customfield_10019` | |
| Flagged | `customfield_10021` | One option: Impediment |
| Start date | `customfield_10015` | |
| Team | `customfield_10001` | |

## 3. Link types

| Name | Outward | Inward |
|---|---|---|
| Blocks | blocks | is blocked by |
| Cloners | clones | is cloned by |
| Duplicate | duplicates | is duplicated by |
| Relates | relates to | relates to |

Links in use: only **F5 (SPM-109) relates to F1 (SPM-27), M1 (SPM-42) and Q1 (SPM-50)**. No `Blocks` links exist.

## 4. Labels

- Sprint 1 stories each carry their story code plus a feature slug, for example `a1` + `auth-authorisation`. The slugs in use are `auth-authorisation`, `event-request-creation`, `draft-event-requests`, `event-review-approval` and `coordinator-assignment`.
- No other issue has labels. `enabler`, `process`, `tier-1` and `tier-2` do not exist yet.

## 5. Sprints

| Sprint | id | State | Start (SGT) | End (SGT) | Completed (SGT) | Goal |
|---|---|---|---|---|---|---|
| SPM Sprint 1 | 35 | **closed** | 2026-09-09 15:30 | 2026-09-20 23:30 | 2026-09-21 02:56 | "Ship a working auth layer and event request lifecycle - users can log in with role-scoped access, submit or save-as-draft an event request, and coordinators can review, clarify, and approve/reject it end to end." |
| SPM Sprint 2 | 68 | **future (not started)** | 2026-09-23 15:30 (planned) | 2026-10-06 23:30 (planned) | — | *(empty)* |

**Sprint 3 and Sprint 4 do not exist in Jira.**

## 6. Epics

All 20 are **To Do** and have no points or sprint.

| Key | Summary | Story letters |
|---|---|---|
| SPM-62 | Feature 1 - User Authentication & Authorisation | A |
| SPM-63 | Feature 2 - Event Request Creation | B |
| SPM-64 | Feature 3 - Draft Event Requests | C |
| SPM-65 | Feature 4 - Event Review and Approval | D |
| SPM-66 | Feature 5 - Coordinator Assignment | E |
| SPM-67 | Feature 6 - Event Status Management | F1–F5 |
| SPM-68 | Feature 7 - Event Information Management | G |
| SPM-69 | Feature 8 - Venue Catalogue | H |
| SPM-70 | Feature 9 - Venue Availability Calendar | I |
| SPM-71 | Feature 10 - Venue Search and Filtering | J |
| SPM-72 | Feature 11 - Venue Suitability Checking | K |
| SPM-73 | Feature 12 - Venue Booking Request | L1–L3 |
| SPM-74 | Feature 13 - Venue Booking Approval | M |
| SPM-75 | Feature 14 - Booking Conflict Detection | N |
| SPM-76 | Feature 15 - Equipment Request Management | O |
| SPM-77 | Feature 16 - Equipment Availability Checking | P |
| SPM-78 | Feature 17 - Equipment Reservation | Q |
| SPM-79 | Feature 18 - Attendee Registration | R1–R7 |
| SPM-80 | Feature 19 - Event Change Requests | S |
| SPM-81 | Feature 20 - Notification System | T |

Every story has the parent shown above. None of the four tasks has a parent.

## 7. Stories, A1 to T2

"CSV" means `documentation/sprint allocation.csv` (columns *New Sprint* and *New Points*). ⚠ marks a difference between Jira and the CSV.

### 7.1 In Jira Sprint 1 (closed)

| Code | Key | Status | Jira pts | CSV pts | Assignee (Jira display name) |
|---|---|---|---|---|---|
| A1 | SPM-11 | Done | 3 | 3 | yichen.chai.2024 |
| A2 | SPM-12 | Done | 5 | 5 | SEANN KHOO JIAN EN |
| A3 | SPM-13 | Done | **1** | **5** ⚠ | yichen.chai.2024 |
| B1 | SPM-14 | Done | 3 | 3 | JOASH LAU RONG WEI _ |
| B2 | SPM-15 | Done | **2** | **5** ⚠ | JOASH LAU RONG WEI _ |
| C1 | SPM-16 | Done | 2 | 2 | raphaelkwek.2024 |
| C2 | SPM-17 | Done | 3 | 3 | raphaelkwek.2024 |
| C3 | SPM-18 | Done | 2 | 2 | raphaelkwek.2024 |
| D1 | SPM-19 | Done | **3** | **5** ⚠ | Sahanya Wickramanayake |
| D2 | SPM-20 | Done | 2 | 2 | Sahanya Wickramanayake |
| D3 | SPM-21 | Done | **2** | **3** ⚠ | Sahanya Wickramanayake |
| D4 | SPM-22 | Done | **1** | **2** ⚠ | SEANN KHOO JIAN EN |
| D5 | SPM-23 | Done | **1** | **2** ⚠ | SEANN KHOO JIAN EN |
| E1 | SPM-24 | Done | 2 | 2 | K SHAWMYA _ |
| E2 | SPM-25 | Done | 3 | 3 | K SHAWMYA _ |
| **Total** | | **15/15 Done** | **35** | **47** | |

Points by person in Jira: Chai 4, Seann 7, Joash 5, Raphael 7, Sahanya 7, Shawmya 5.

### 7.2 In Jira Sprint 2 (not started)

| Code | Key | Status | Jira pts | CSV pts | Assignee |
|---|---|---|---|---|---|
| F1 | SPM-27 | To Do | 5 | 5 | raphaelkwek.2024 |
| F2 | SPM-28 | To Do | 2 | 2 | — |
| F3 | SPM-29 | To Do | 3 | 3 | — |
| G1 | SPM-30 | To Do | **2** | **3** ⚠ | — |
| H1 | SPM-32 | To Do | **2** | **3** ⚠ | — |
| H2 | SPM-33 | To Do | 2 | 2 | — |
| I1 | SPM-34 | To Do | **2** | **5** ⚠ | — |
| J1 | SPM-36 | To Do | **3** | **5** ⚠ | — |
| J2 | SPM-37 | To Do | 2 | 2 | — |
| K1 | SPM-38 | To Do | 5 | 5 | — |
| O1 | SPM-46 | To Do | **2** | **3** ⚠ | — |
| O2 | SPM-47 | To Do | 3 | 3 | — |
| P2 | SPM-49 | To Do | **2** | **3** ⚠ | — |
| T2 | SPM-61 | To Do | 2 | 2 | — |
| **Stories** | | | **37** | **46** | |

The same 14 stories are in Sprint 2 in Jira, the CSV and `plan.md` §9. Only the points differ.

Sprint 2 also holds four **tasks** that are not in `plan.md` or the CSV:

| Key | Summary | Status | Pts |
|---|---|---|---|
| SPM-113 | Set Up Kafka Provider | To Do | 5 |
| SPM-114 | Configure Automated Testing (Github Actions) | To Do | 3 |
| SPM-115 | Configure Github Branch Protections | To Do | 1 |
| SPM-116 | Set Up Coverage Reporting | To Do | 3 |
| **Tasks** | | | **12** |

Jira's Sprint 2 total is therefore **49** (37 story + 12 task).

### 7.3 Backlog, no sprint (the CSV puts these in Sprint 3)

All are To Do and unassigned.

| Code | Key | Jira pts | CSV pts |
|---|---|---|---|
| I2 | SPM-35 | — | 3 |
| K2 | SPM-39 | — | 2 |
| L1 | SPM-40 | — | 3 |
| L2 | SPM-41 | — | 2 |
| L3 | SPM-110 | — | 5 |
| M1 | SPM-42 | — | 5 |
| M2 | SPM-43 | — | 2 |
| N1 | SPM-44 | — | 8 |
| N2 | SPM-45 | — | 3 |
| P1 | SPM-48 | — | 3 |
| Q1 | SPM-50 | — | 8 |
| Q2 | SPM-51 | — | 3 |
| R1 | SPM-52 | — | 2 |
| S1 | SPM-57 | — | 3 |
| S2 | SPM-58 | — | 3 |
| **Total** | | **0** | **55** |

### 7.4 Backlog, no sprint (the CSV puts these in Sprint 4)

All are To Do and unassigned.

| Code | Key | Jira pts | CSV pts |
|---|---|---|---|
| F4 | SPM-111 | — | 5 |
| F5 | SPM-109 | 5 | 5 |
| G2 | SPM-31 | — | 5 |
| R2 | SPM-53 | — | 8 |
| R3 | SPM-54 | — | 2 |
| R4 | SPM-55 | — | 3 |
| R5 | SPM-56 | — | 3 |
| R6 | SPM-112 | — | 5 |
| R7 | SPM-108 | — | 3 |
| S3 | SPM-59 | — | 8 |
| **Total** | | **5** | **47** |

### 7.5 Removed story

| Code | Key | Status | Notes |
|---|---|---|---|
| T1 | SPM-60 | **Done** (resolution Done) | Closed by Chai on 2026-09-15. The CSV says "Removed". No points, no sprint. |

---

## 8. Mismatches found (reported, not fixed)

Each one is left as it is. Fixing them belongs to a later phase, and which phase is noted where it's clear.

**M1. Sprint 1 points: Jira says 35, the repo says 47.** `plan.md` §9 and the CSV say 47 delivered against 44 planned. Jira says 35. The six stories that differ are listed in §7.1. A3's history shows its estimate was never edited, so 1 is the value it was created with on 9 Sep. *(PX-01, Gate C.)*

**M2. Sprint 2 story points: Jira says 37, the repo says 46.** Six stories differ (§7.2). Jira's numbers are the **newer** ones. The histories of I1 and T2 show K Shawmya set their estimates on 2026-09-27 between 20:54 and 20:58 SGT, with I1 going 5 → 3 → 2, which looks like a poker session. Only those two histories were checked. Ask the team whether that session is the agreed Sprint 2 estimate. If it is, the CSV and `plan.md` are the stale side. *(Gate C.)*

**M3. Sprint 2 also holds 12 points of infrastructure tasks** (SPM-113 to 116) that appear in neither `plan.md` §9 nor the CSV. Jira's Sprint 2 total is 49.

**M4. Sprint 2 has never been started in Jira.** Its state is `future`, although its planned dates (23 Sep to 6 Oct) are mostly over and the plan treats it as running. Until it is started, Jira produces no burndown or sprint report for Sprint 2, which matters for PX-06. All Sprint 2 issues are To Do, and only F1 has an assignee. Starting a sprint is a Jira write and was not done here.

**M5. Sprints 3 and 4 do not exist in Jira.** The 25 stories the CSV places there are in the backlog with no sprint. Only F5 has points (5). The CSV and `plan.md` give Sprint 3 55 points and Sprint 4 47.

**M6. T1 is "Done", not "Removed".** SPM-60 was closed with resolution Done, so it counts as completed work in Jira reports. It has no points, so totals are unaffected.

**M7. Story summaries mostly use a hyphen, not an em dash.** The plan's §3 convention is `<code> — <title>`. 50 of the 55 stories use `<code> - <title>`, and only SPM-108 to 112 (R7, F5, L3, F4, R6) use the em dash. `CHANGELOG.md` (2026-09-15, section 0c) says SPM-61 was renamed to `T2 — …`, but SPM-61's history has **no summary change**, and it still reads `T2 - Read and manage my notifications`.

**M8. The 26 Sprint 1 test issues no longer exist in Jira.** `CHANGELOG.md` (2026-09-15) records SPM-86 to 107 (22 tests) and SPM-82 to 85 (4 shared test subtasks) being renamed and moved into Sprint 1. Today SPM-82, 86 and 107 return "not found". A JQL search for `A1-T1`, `Valid login` or `F-T1` across the site finds nothing, and there is no `Test` issue type left in SPM. They did exist: A3's history shows a "relates to SPM-90" link added on 2026-09-15, and that link is gone now. From this account it isn't possible to tell whether they were deleted, archived or hidden. If they were deleted, that conflicts with the no-hard-delete rule (`implementation.md` §4.3). **Ask the team before Phase 1.** Also missing: SPM-1 to 10 and SPM-26, which are probably early setup issues and weren't investigated.

**M9. The epics for features 1 to 5 are still To Do,** although every story under them (A to E) is Done.

**M10. Story titles differ from the CSV for E1, K1 and P1.**
- E1: Jira says "Assign an Event Coordinator to an event automatically". The CSV says "Get a named coordinator as soon as I submit".
- K1: Jira says "See whether a venue is suitable for an event, and why not". The CSV says "…suitable and why not".
- P1: Jira says "Check whether enough equipment is available for a period". The CSV drops "for a period".

**M11. `plan.md` §9 points to a file that doesn't exist.** It cites `/documentation/sprint-reallocation.csv`, but the file in the repo is `documentation/sprint allocation.csv`.

## 9. Notes for Phase 1 (the change set)

- **Points field:** write `customfield_10016` ("Story point estimate"). Under Gate C rules it stays empty on anything new.
- **Epics:** set `parent` to the epic's key. Tasks can take an epic parent in a team-managed project.
- **"blocks" links:** use link type `Blocks` (outward "blocks").
- **Duplicate risk with existing tasks.** SPM-113 (Kafka provider) overlaps **EN-04**. SPM-114, 115 and 116 (GitHub Actions, branch protection, coverage) overlap **EN-06**. The change set should link to or fold these four in, not create parallel issues. They already carry 12 points in Sprint 2.
- **Sprints 3 and 4 must be created** before any Gate B move into them. That is a sprint write, done under Gate B.
- **The plan doesn't say which issue type enablers, PX tasks and CQ tasks should use.** Task (10010) is the natural fit, but the team should choose.
- **New labels** (`enabler`, `process`, `tier-1`, `tier-2`) will be created on first use.
