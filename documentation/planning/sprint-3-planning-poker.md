# Sprint 3 — Planning poker sheet

**Sprint 3:** Wed 7 Oct 15:30 to Tue 20 Oct 23:30 SGT (Weeks 8–9)
**Status:** Prep sheet for the poker session (PX-02). Nothing here is written to Jira.

**Rule (Gate C):** only the team's agreed votes go into Jira (`customfield_10016`). The **Suggested** column is a starting point for discussion, not an estimate. Once the session is done, copy the **Agreed** column to Jira, then update `plan.md` §9 and `sprint allocation.csv` from Jira.

---

## 1. Reference stories (the team's own Jira votes)

Size Sprint 3 stories relative to these stories the team has already sized, not against document estimates.

| Points | Reference stories (Jira) | What that size looked like |
|---|---|---|
| **1** | D4 Approve, D5 Reject, A3 See only my events | One state change on one record, a recorded actor and timestamp, one notification |
| **2** | D2 Request clarification, B2 Validate, I1 Calendar, H1 Venue records | A small CRUD or read screen, or one rule with a refusal path |
| **3** | D1 Review queue, E2 Reassign, J1 Filter venues, O2 Update equipment | A queue or search plus several rules, or a two-party handshake |
| **5** | A2 Role restriction, F1 Status lifecycle, K1 Suitability | Cross-cutting rules, many acceptance criteria, or a state machine |
| **8** | *(none voted yet)* | Concurrency or atomicity plus a race test, or a story that should probably be split |

---

## 2. Stories

Vote in order of the sprint's backlog order: **H3 → L3 → L6 → L1 → K2 → L2 → M1 → M2 → N1 → N2 → I2 → L5 → Q1 → Q2 → F5 → S1 → S2** (L3 before L1, M1 before I2, I2 before L5, M1 and Q1 before F5).

| # | ID | Story | What makes it big or small | Depends on | Suggested | Chai | Seann | Joash | Raphael | Sahanya | Shawmya | **Agreed** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **H3** ⚠ new (CR-01) | Set a venue's setup and turnaround time | Two integer fields plus validation are small. The work is the re-check: find every hold, request and booking that now overlaps, flag it Requires Reconfirmation, and notify. Audit of old and new values. | H1, EN-02 | 3 | | | | | | | |
| 2 | **L3** ⚠ revised | Place a tentative hold on a venue | Overlap refusal against holds **and** bookings on occupied periods, first-come-first-served, one hold per venue per event, convert to request, release, and show on calendar and search. 12 acceptance criteria. | H3, EN-02 | 5 | | | | | | | |
| 3 | **L6** ⚠ new (CR-04) | Tentative holds expire | Needs a timer that fires with nobody logged in (EN-11 `HoldExpiry`), a reminder before expiry, and an Expired state. **Blocked by CQ-06** (who sets expiry, default, reminder lead time). | L3, EN-11 | 3 | | | | | | | |
| 4 | **L1** ⚠ revised | Submit a venue booking request | Defaults from the event, a "differs from event" flag, duplicate-pending refusal, queue and calendar entry, notification, and a link when it replaces a disrupted booking. | L3 | 3 | | | | | | | |
| 5 | **K2** | Justify booking a venue flagged as unsuitable | One mandatory field when K1 says Not suitable, stored with a snapshot of the failing conditions and shown to Venue Staff. | K1, L1 | 1 | | | | | | | |
| 6 | **L2** | Withdraw a pending booking request | Same shape as D4/D5: one guarded state change, retained record, drops off queue and calendar. | L1 | 1 | | | | | | | |
| 7 | **M1** ⚠ revised | Approve a venue booking request | Queue with K2 justification, refusal on overlap with bookings or blocks, idempotent approval, notifications, and releasing the replaced booking (CR-02). The race itself is in N1. | L1, N1 | 3 | | | | | | | |
| 8 | **M2** | Reject a venue booking request | Mirror of D5 plus optional suggested alternatives. | L1 | 1 | | | | | | | |
| 9 | **N1** ⚠ revised | Prevent double-booking of a venue | Atomic approval under concurrency, on buffered periods, with the race test. EN-02 (Sprint 2) built the exclusion constraint and race harness; vote **8** if EN-02 has not landed. | EN-02, H3 | 5 | | | | | | | |
| 10 | **N2** | Flag potential conflicts before a decision | A conflict flag on pending requests, visible to both Venue Staff and the coordinator, recalculated on five different events. | L1, M1 | 3 | | | | | | | |
| 11 | **I2** ⚠ revised | Record a period of venue unavailability | Block creation that is *allowed* over bookings; preview of disrupted bookings; flags on bookings, requests and holds; reason types; removal clears flags; notifications. 11 acceptance criteria. | M1, H3 | 5 | | | | | | | |
| 12 | **L5** ⚠ new (CR-02) | Request a replacement venue for a disrupted booking | Pre-filled J1 search, a request linked to the disrupted booking, release on approval, and no change on reject or withdraw. Mostly reuses J1, L1 and M1. | I2, L1, M1 | 3 | | | | | | | |
| 13 | **Q1** | Reserve equipment for an event | Atomic reservation against a time-based quantity, shortfall message, explicit partial reservation. P1 (Sprint 2) built the availability model; vote **8** if P1 has not landed. | P1, O1 | 5 | | | | | | | |
| 14 | **Q2** | Release an equipment reservation | Three release triggers, quantity returned, idempotent, notification. | Q1 | 2 | | | | | | | |
| 15 | **F5** ⚠ revised | Confirm an event only when venue and equipment are ready | Already **5** in Jira, but CR-03 (several venues) and CR-06 (goes to Safety Review, not Confirmed) changed it after the vote. **Re-vote.** CQ-05 is still open. | M1, Q1, L4 (Sprint 4) | 5 → re-vote | | | | | | | |
| 16 | **S1** | Request a change after submission | Field list plus reason, snapshot of current values, one pending at a time, notification. Behind flag `change-approval`. | EN-15 | 2 | | | | | | | |
| 17 | **S2** | Review and decide a change request | Approve writes each changed field with before/after into history; reject needs a reason; one decision only. | S1, EN-15 | 3 | | | | | | | |
| | | **Stories total** | | | **53** | | | | | | | |

---

## 3. Enablers planned for Sprint 3

These carry "Proposed estimate (to be poker'd)" in their Jira descriptions. Point them in the same session.

| ID | Enabler | Proposed (from description) | Team vote | **Agreed** |
|---|---|---|---|---|
| EN-10 | Containers, Terraform, Kubernetes, GitOps | 8 | | |
| EN-11 | Temporal workflows (also needed by L6) | 5 | | |
| EN-12 | API gateway, rate limits, CDN | 5 | | |
| EN-13 | Registration service and seat inventory | 5 | | |
| EN-14 | Preview environments and browser tests | 5 | | |
| EN-15 | Feature flags (needed by S1, S2) | 2 | | |
| | **Enablers total** | **30** | | |

---

## 4. Capacity check before committing

| | Points |
|---|---|
| Measured velocity (Sprint 1, Jira) | **35** |
| Suggested stories | 53 |
| Proposed enablers | 30 |
| **Suggested Sprint 3 load** | **83** |

At the suggested sizes, Sprint 3 holds more than twice the measured velocity, before counting carry-over from Sprint 2 (which `plan.md` §9.2 already expects). Agree on a cut line in the same session. Things to discuss:

- **Enablers not needed by a Sprint 3 story** (EN-10, EN-12, EN-13, EN-14) could move to Sprint 4 or be cut first. EN-11 and EN-15 are needed by L6, S1 and S2.
- **S1 and S2** sit behind a flag until S3 (Sprint 4) anyway, so they can move to Sprint 4 without affecting a demo.
- **L5** depends on I2, L1 and M1 all finishing; it is the natural last story to slip.
- **L6** can't be finished until CQ-06 is answered. Don't commit it until then.

---

## 5. Open questions that affect the votes

| Question | Affects |
|---|---|
| CQ-05: must *every* venue booking be confirmed before F5? | F5 |
| CQ-06: who sets a hold's expiry, default/maximum, reminder lead time? | L6, L3 |
| Has EN-02 (exclusion constraint, race harness) landed in Sprint 2? | N1, L3, M1 |
| Has P1 (time-based equipment availability) landed in Sprint 2? | Q1 |
| CR-03 L4 (several venues) is Sprint 4, but L1, L3 and F5 mention it. Is the "one event, many venues" data model built in Sprint 3 or 4? | L1, L3, F5 |
