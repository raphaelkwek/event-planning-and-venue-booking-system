# The README says where the instructors find each part, and the zip's folder 7 is a real README

**Timestamp:** 2026-11-04T20:25+08:00 (SGT)
**Author:** Joash
**Reason:** the instructors open the repository and the Week 12 zip first, and neither said where
each part of the submission is. The README also still said EN-11 was unfinished, that no service
publishes to Kafka, that `npm run dev` starts only planning-core and the web app, and gave coverage
from 9798a4f.
**Scope:** `README.md`, `documentation/week12-submission/git-access.md` (copied into the zip as
`7. README and Git Access/README.md`), `tests/README.md`, and one note in
`documentation/final user stories.md`. No code, no behaviour change.

## Changed

- `README.md` opens with "For the instructors": the staging and production sites and the test
  password, a table of where each part is (backlog, design, customer changes and decisions, test
  cards, traceability, coverage, CI/CD, operations evidence, sprint records, changelog, AI rules),
  and what each of the zip's seven folders holds.
- The stale lines are corrected: the Temporal section now says what EN-11 runs and proves (timers,
  the redeploy-safe state and the replay test, all six EN-11 cards Pass); Kafka is in use (outbox
  relays, the notification and registration consumers, `npm run kafka:check`); `npm run dev` starts
  all six processes and the Vite proxy covers venue and equipment; coverage points at
  `documentation/testing/coverage.md` instead of an old run; the no-Docker rule cites ADR-0012.
- `git-access.md`, the zip's folder 7 README, now also says what ConnectSphere is, how to try it on
  staging with one account per role, what each zip folder holds, and how to run it. The instructor
  access table still has its two `TODO` rows until the owner adds the instructors.
- The README's "Trying the stories in the browser" table went on only to D5. It now covers every
  story group to T2, with the role to sign in as and the screen to open, taken from the 4 Nov
  staging dry run (compliance fix list, B3).
- `tests/README.md`'s account table gains `safety@connectsphere.test` (Safety Officer One,
  `00000000-0000-0000-0000-000000000010`, from identity seed 0005).
- S3's AC8 in `documentation/final user stories.md` gains a dated note pointing to team decision
  D-03: until the customer answers CQ-11 (SPM-197), "Event Coordinators" is read as the assigned
  coordinator. The criterion's own words are unchanged.
