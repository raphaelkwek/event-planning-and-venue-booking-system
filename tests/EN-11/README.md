# EN-11 — Temporal execution checks

EN-11 is an enabler, so it has no user-facing screens. These three technical cards were added on
20 October, after the implementation, and supplement F1's functional cards. Each runs as a
unit-test command, with no database and no Temporal Cloud account.

| Area | Card | Latest result |
|---|---|---|
| Worker connection settings | EN-11-T1 | Pass, 11 tests |
| CompleteEvent durable timer (time-skipping server) | EN-11-T2 | Pass, 8 tests |
| Replay of recorded histories in CI | EN-11-T3 | Pass, 7 tests |
| A restarted worker re-creates lost completion and hold-expiry timers | EN-11-T4 | Pass, 11 tests |
| The container sweeps overdue events and holds every five minutes | EN-11-T5 | Pass, Space image amd64 and arm64 |
| Temporal's workflows survive the replacement of the container | EN-11-T6 | Pass, Space image amd64 and arm64 |

**Added 4 November (timers survive redeploys).** On 4 Nov a redeploy of staging replaced its
container, and Temporal's state (kept in the container's `/tmp`) went with it: an event confirmed
before the redeploy stayed Confirmed 30 minutes past its end. EN-11-T4 to T6 check the three parts of
the fix: the worker re-creates every timer when it starts, the container runs the completion and
hold-expiry sweeps every five minutes, and Temporal's file is on a named volume that outlives the
container. T4 is a unit-test command; T5 and T6 run in `deploy.yml`'s "Space image" jobs.

**Not covered, on purpose.** The `CancelEvent` workflow (a semantic lock: freeze, commit,
finalise, unfreeze on failure) needs EN-13 and the Sprint 4 stories F3 and F4, and `HoldExpiry`
comes with L6. SPM-129's Jira description lists CancelEvent, so the ticket should be split or moved
at review. The worker has also not been run against a real Temporal Cloud namespace here: use
`npm run temporal:check` with your own `.env`.
