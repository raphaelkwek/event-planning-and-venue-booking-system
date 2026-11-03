# Per-sprint documentation workbooks (Sprints 1–4)

**Timestamp:** 2026-11-04T00:52+08:00 (SGT)
**Author:** Yichen, via Claude
**Scope:** `documentation/sprint-workbooks/` (four `.xlsx` files). No service code, no migration, no behaviour change.
**Reason:** The sprint documentation (plan, review, retro, standup) was spread over transcripts, `plan.md`, Jira and the changelog. One workbook per sprint now holds it in four tabs (`S# Plan`, `S# Review`, `S# Retro`, `S# Standup`), with the burndown block inside Review.

## Added

- `ConnectSphere_Sprint1_Documentation.xlsx` to `ConnectSphere_Sprint4_Documentation.xlsx`. Sprints 1–3 are filled from Jira (read-only: dates, goals, points, assignees, workflow status) and from repository records. Sprint 4 is a scaffold because the sprint is still active.
- Every row carries an evidence label (DOC, JIRA, REPO, USER, RECON, PENDING-JIRA, MISSING, CONFLICT). Jira workflow status and verified delivery evidence are separate columns.
- Sprint 1 is 35 points (the Jira votes). The planning record's stated 34 is noted as an addition slip.

## Not done, on purpose

- No historical burndown, added/removed-scope timing or Sprint Report: Jira's API does not expose them. Those cells are `PENDING-JIRA` and the Review tab names the export needed.
- Sprint 2–4 planning, review, retro and standup records are not in the repository. Those sections are `MISSING` import slots.
- Standup rows reconstructed from changelog entries are labelled as such. They are not evidence of attendance or of completion dates.
- Demo evidence is kept in a separate document; the workbooks hold screenshot placeholders only.
