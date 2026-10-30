# E5 — Oversee coordinator assignments (CR-05)

Four cases, written from the story on 27 Oct 2026, before the code. The Lead sees every active
event and its coordinator, each coordinator's load, and each event's assignment history. The
customer's Week 9 answers: Leads see all unassigned and assigned requests and the active
assignments system-wide (W9-37), and several Leads may each see them all (W9-30, W9-57). The design
is `documentation/superpowers/specs/2026-10-27-e3-e5-lead-assignment-design.md`.

| Acceptance criterion | Cases |
|---|---|
| The Lead sees every active event (not Completed, Cancelled or Rejected) with its status and its assigned coordinator, or "Unassigned" | E5-T1 |
| The list can be filtered by coordinator, and shows each coordinator's number of active assigned events | E5-T2 |
| The Lead can open any event's assignment history: each assignment's coordinator, who made it, and its start and end | E5-T3 |
| No other role can see this overview (A2) | E5-T4 |

An active event is one that has been submitted and is not Completed, Cancelled or Rejected. A draft
hasn't been submitted, so it isn't listed. FX-SUBMITTED, FX-ASSIGNED and FX-UNDER-REVIEW are in
`tests/README.md` and `tests/E3/README.md`.
