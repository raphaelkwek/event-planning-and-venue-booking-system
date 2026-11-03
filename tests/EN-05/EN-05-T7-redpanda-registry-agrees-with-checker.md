# EN-05-T7 — A real schema registry (Redpanda's) gives the same verdict as the checker, and the branch passes the registry's own compatibility check

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-05-T7 |
| Test Scenario | A real schema registry (Redpanda's) gives the same verdict as the checker, and the branch passes the registry's own compatibility check |
| Pre-conditions | 1. A single-node Redpanda container, started by the CI job. Its Schema Registry is the one the staging and production cluster runs. |
| Test Steps | 1. Start Redpanda in the CI job and wait for the registry to answer.<br>2. For every case in the checker's table of compatible and incompatible changes, register the previous schema under a throwaway subject set to BACKWARD, and ask the registry whether the changed schema is compatible.<br>3. Register a breaking change's previous version of a real message (event.approved) and ask about a version that loses a required field.<br>4. When the base branch has committed schema files, register them and ask the registry about each of the branch's. Until the first merge it has none, so register this commit's own schemas and compare them with themselves, to exercise the same calls on the real files.<br>5. Compare the registry's answers with the checker's. |
| Test Data | The cases in `backend/packages/contracts/src/compat/cases.ts`, and the committed schema files of the base branch and the branch. |
| Expected Result | For every case the checker gives the case's own verdict, and the registry gives the same verdict except in the cases that record Redpanda's different one (a property that becomes nullable through anyOf; a plain string that gains a format; a constrained property added to an open object), where it gives the recorded verdict. The breaking change to event.approved is refused by both. Every message schema of the branch is compatible with its base version in the registry, or, while the base has none, with itself. Any other disagreement fails the job and names the case. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | A throwaway Redpanda (v26.2.6) registry was asked about the 36 cases in cases.ts. The registry's verdict was the recorded one for every case and the checker's was the case's own: they agree on 33 cases, and on the 3 cases that record Redpanda's differing verdict (a property that becomes nullable through anyOf: registry refuses; a plain string that gains a format and a constrained property added to an open object: registry accepts) the registry gave exactly the recorded verdict. A breaking change to event.approved was refused by both. This commit's 30 message schemas were registered and each was compatible with itself. The comparison with the base branch was skipped, because main has no schema files yet (the log says so). |
| Status | Pass |
| Remarks | Automated (CI job, Redpanda container) · Commit: c4325fb · Evidence: backend/scripts/schema-registry-check.ts, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41614891360 job "Schema registry and CDC (Redpanda, Debezium Server)" steps "Ask Redpanda's registry about every case and about this branch" and "Register this commit's schemas and compare them with themselves" · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
