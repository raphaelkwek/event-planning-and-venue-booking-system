# EN-11 — Temporal execution checks

EN-11 is an enabler, so it has no user-facing screens. These three technical cards were added on
20 October, after the implementation, and supplement F1's functional cards. Each runs as a
unit-test command, with no database and no Temporal Cloud account.

| Area | Card | Latest result |
|---|---|---|
| Worker connection settings | EN-11-T1 | Pass, 11 tests |
| CompleteEvent durable timer (time-skipping server) | EN-11-T2 | Pass, 8 tests |
| Replay of recorded histories in CI | EN-11-T3 | Pass, 7 tests |

**Not covered, on purpose.** The `CancelEvent` workflow (a semantic lock: freeze, commit,
finalise, unfreeze on failure) needs EN-13 and the Sprint 4 stories F3 and F4, and `HoldExpiry`
comes with L6. SPM-129's Jira description lists CancelEvent, so the ticket should be split or moved
at review. The worker has also not been run against a real Temporal Cloud namespace here: use
`npm run temporal:check` with your own `.env`.
