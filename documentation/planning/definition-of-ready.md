# Definition of Ready, and how to pick up work

**Author:** Joash · **Date:** 2026-10-02 · **Applies from:** Sprint 2

The Definition of Done (`implementation.md` §8.3) says when an item is finished. This page says when an item is ready to start, and how anyone on the team picks their next piece of work from Jira without waiting to be told.

## How to pick up work

1. Open the **active sprint** on the Jira board (project `SPM`).
2. Open the saved filter **SPM ready & unassigned** (see "Filters" at the end of this page). The list is in work order: the top item is the most important thing nobody has started yet.
3. Take the **top item you can do**. Skip anything labelled `blocked`, or anything whose "is blocked by" link is still open.
4. **Assign it to yourself and move it to In Progress** before you start. That stops two people picking the same item.
5. Follow its **Start here** section: what to read, where the code goes, the first step, the done-check, and a prompt you can paste into Claude Code.
6. **One item in progress per person.** Finish it (Definition of Done) or hand it back before you take another.
7. Say what you took at the next standup (PX-04 log).
8. **When you finish, unblock the next items.** Open the "blocks" links on your item. For each item whose blockers are now all Done, swap its `blocked` label for `ready`. Jira can't do this automatically, so whoever finishes does it.

**Items with subtasks.** EN-01, EN-02, EN-04, EN-06 and EN-07 are split into subtasks (EN-01.1, EN-01.2, …). Jira's backlog lists only top-level items, so each parent carries the label of its next subtask: `ready` when one can start, `blocked` when none can. When a parent is the top ready item, open it and take its first subtask labelled `ready`, not the parent itself. The parent closes when all its subtasks are Done. Whoever finishes a subtask also updates the parent's label.

Developers take development items: stories, enablers and their subtasks, and the setup tasks SPM-113 to 116. **Process items** (`PX-` and `CQ-`, label `process`) are owned by the Product Owner or Scrum Master named in each one. They sit at the bottom of the sprint so they never look like the next coding task.

Scrum puts the developers in charge of selecting work, and this is still self-selection. The ranking is the team's agreed order, and anyone can raise a change to it at standup.

## Definition of Ready

An item is ready, and gets the label `ready`, when all of these hold:

- [ ] **Acceptance criteria are clear and testable.** For a story, they're the ones in `documentation/final user stories.md`.
- [ ] **Nothing blocks it.** Every "is blocked by" link points at Done work, and any customer question it waits on (CQ-01 to 03) has been answered.
- [ ] **It has a Start here section:** what to read, which folder, the first step, and how to check it's done.
- [ ] **It's small enough.** Roughly two days or less for one person. Bigger items are split into subtasks, which are done in order.
- [ ] **It's estimated** with planning poker (PX-02). *Sprint 2 exception:* the enablers added mid-sprint on 1 Oct are estimated in PX-02. Until then they can be ready without points, because the team agreed to start them.

When an item stops being ready (a new blocker, or a changed requirement), swap `ready` for `blocked` and comment why.

## Labels and what they mean

| Label | Meaning |
|---|---|
| `ready` | Meets the Definition of Ready. Can be picked up now. |
| `blocked` | Waiting on another item or a customer answer. The comment or the links say on what. |
| `enabler` | Platform or quality work (EN-01 to EN-23, SPM-113 to 116) |
| `tier-1` / `tier-2` | Tier 1 moves a rubric row directly. Tier 2 is showcase work and is cut first. |
| `process` | Scrum-evidence tasks (PX-) and customer questions (CQ-), owned by the PO or SM |

## Where code goes now (ADR-0004)

Staff-facing code lives in **one deployable**, `planning-core`. EN-01 created this layout on 2 Oct 2026. Every module follows it:

```
backend/services/planning-core/
  src/
    index.ts                 one Express app that mounts each module's router
    shared/                  db pool, logger, config, JWT verification
    modules/
      identity/  event/  venue/  equipment/  change/
        api/                 routers and request validation
        domain/              pure rules, no I/O
        repo/                SQL only, this module's schema only
        events/              outbox writer and consumers
        index.ts             the module's public interface, the only file other modules import
  migrations/<module>/NNNN_description.sql
  tests/<module>/            unit and integration tests
```

Identity and Event are already modules here; `backend/services/identity` and `backend/services/event` no longer exist. Registration and Notification will be separate services (ADR-0005, ADR-0008). Read another module's data only through its `index.ts`. `npm run lint:boundaries` fails if a module imports another's internals or queries its schema.

## The agent prompt in each item

Each Start here section ends with a prompt to paste into Claude Code. It tells the agent to:
- read `CLAUDE.md`, `implementation.md` and the item's ADR;
- write functional test cases first (`implementation.md` §8.4, rule 12);
- stay inside its module;
- add a traceability row and a CHANGELOG entry.

You're still accountable for what it writes (`implementation.md` §11, rule 10), so read the diff before you commit. Then add a line to the AI-usage log (PX-10): what the agent produced, and what you checked or changed.

## Filters

SPM is a team-managed project, so its board has no custom JQL quick filters. Use these two things instead.

**On the board or backlog:** the built-in **Label** filter, set to `ready`, plus your own avatar for "only mine".

**For the exact list in order:** saved filters. Anyone can create them once (Filters → View all filters → Create filter, paste the JQL, Save, then share with project SPM):

| Name | JQL |
|---|---|
| SPM ready & unassigned | `project = SPM AND labels = ready AND assignee is EMPTY AND labels != process AND statusCategory != Done ORDER BY Rank ASC` |
| SPM mine | `project = SPM AND assignee = currentUser() AND statusCategory != Done ORDER BY Rank ASC` |
| SPM blocked | `project = SPM AND labels = blocked AND statusCategory != Done ORDER BY Rank ASC` |
| SPM process (PO/SM) | `project = SPM AND labels = process AND statusCategory != Done ORDER BY Rank ASC` |

Don't add `sprint in openSprints()`. In a team-managed project, subtasks don't carry the sprint in JQL, so the ready subtasks (EN-01.1, EN-04.1, EN-07.1, …) would disappear from the list. Only current-sprint items are labelled `ready`, so the sprint clause isn't needed.
