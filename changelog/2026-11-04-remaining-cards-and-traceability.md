# The remaining cards executed, the traceability rows repointed, and coverage stated per workspace

**Timestamp:** 2026-11-04T15:40+08:00 (SGT)
**Author:** Joash
**Scope:** browser journeys in `tests/e2e/` (two new specs, and the journeys of nine others extended), a stand-in for Kafka for the browser tests (`tests/e2e/support/deliver.ts`), API card tests in planning-core and the registration service, one web test and one import in `frontend/src/shared/changeRequests.ts`, the traceability files, scripts and the CI steps that upload test results, `documentation/testing/coverage.md`, the supply-chain guide, `documentation/clarifications.md` (D-03), and the execution records of 71 cards. No migration, and no change to what any service does.

**Reason:** the 4 Nov compliance audit (rows W12-3 and RUB-6) found 68 cards Not Executed, three Blocked cards whose blockers had merged, S3-T13 failing on a reading of S3's AC8, 191 traceability rows naming tests the matrix could not find, and the reasons for coverage below 100% kept only in the Vitest configs.

## What changed

1. **Kafka's stand-in for the browser tests.** CI's browser stack runs without Kafka, so no card whose last step reads Notifications, or needs the registration service to react to a message, could be proven in the browser. `deliverOutbox(eventId, …)` reads the unpublished outbox rows about one event, prepares each with the relay's own `prepareRow`, and hands it to the consumers' own handlers (notification; on request the registration service's seat builder and listing handler), repeating so the messages a consumer writes in turn are delivered too. Only the transport is skipped, and nothing is delivered unless a journey asks. `documentation/evidence/EN-14/README.md` explains it.
2. **Cards automated, or their tests made to assert the whole card:** F5-T1 to T4 and T6 to T20 (API level); B1-T5, D2-T7, D3-T8, D4-T5, D4-T6, D5-T7, E1-T2, F1-T6, F1-T12 (the card's own query against the stack's database, after the deciding step on screen); G2-T1; H3-T11 to T14, L6-T12, O2-T17, Q1-T14, Q2-T13; K1-T13, L4-T11, Q2-T12 (API level); R2-T12, R4-T9, R6-T6, R6-T8, R6-T10, R6-T11, R7-T1, S1-T13, S2-T12, F3-T9, F4-T7, F4-T8 (notifications and the registration service's reactions, through the stand-in); EN-07-T4 (against the real policy decision point); DEPLOY-T18, DEPLOY-T19 (script tests, now reported).
3. **Cards executed by read-only checks of the live deployment and its pipeline:** DEPLOY-T2, DEPLOY-T17, EN-10-T2, EN-21-T4, EN-21-T8 (the Release run, and cosign, crane and jq against GHCR from a laptop), EN-22-T9 (a dispatched DORA run), EN-05-T1 (a document review). DEPLOY-T12, T13, T14, T15, EN-10-T8 and EN-16-T4 stay Not Executed, each with what was checked and why the rest was not (a human sign-in, a write to an environment, or infrastructure that does not exist).
4. **Specifications revised, each with a dated note:** E1-T2 (CR-05), D4-T6 (EN-11 and R1/R5 add messages), F1-T12 (W9-31: the coordinator marks the event Confirmed), F5-T4 (A4), S3-T13 (D-03), K1-T13 (written out now that L1 and L4 exist), and the deployment cards for ADR-0016, its Azure amendment and the move of the repository to `joass1`. EN-07-T4's account name and R4-T9's stale remark are corrected.
5. **The three stale Blocked cards:** F4-T7 now passes; EN-07-T13 and EN-20-T1 are Not Executed with the real reason (the gateway as built evaluates no policy; F3 and F4 built no CancelEvent workflow to crash).
6. **S3's AC8 is read as the assigned Event Coordinator** (decision D-03, next to CQ-11, which stays open with the customer). S3-T13's step 5 now expects the refusal S3-T8 already expects.
7. **Traceability:** `check-traceability.ts` reads the per-story files again (it read the old sprint files and so checked nothing); every row names a test whose result CI uploads, or the card that records the check; the matrix honours the SUPERSEDED marker. CI now reports the telemetry, observability and load packages' results, every script test as JUnit, and the browser tests' JSON; the traceability job waits for the browser tests.
8. **Coverage:** `documentation/testing/coverage.md` gives each workspace's figures from CI run 41777894379, what is not covered and why; CI uploads planning-core's integration coverage summary (`coverage-integration`).

## Defects

- **S3-T13 (Fail), found by its step 7:** the notification service cannot store an S3 flag message that tells one person more than once. S3's rule writes one notice per flag, but `notification.notifications` is unique on (source_message_id, recipient_user_id), so the insert fails, the message is retried and then dead-lettered, and nobody is told. Steps 1 to 6 pass. The journey is marked as an expected failure with the defect; not fixed here.

## Not done

- DEPLOY-T12 needs only its step 4 (sign in as each environment's Lead); DEPLOY-T14 needs a second `lead:create` run and staging's sign-in; DEPLOY-T15 is a runbook walk-through with a rollback. Each needs Joash.
- EN-07-T13 needs the gateway to ask the policy decision point (ADR-0010), which EN-12 did not build; EN-20-T1 needs a new injection for the consumer that now does the cancellation.
