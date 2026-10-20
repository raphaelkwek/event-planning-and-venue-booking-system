# EN-11 — Temporal execution checks

These technical cards were added on 20 October during the readiness audit; they were
not written before the existing implementation. They supplement F1's functional cards.

| Area | Card | Latest result |
|---|---|---|
| Worker configuration rules (partial worker criterion) | EN-11-T1 | Pass, 11 unit tests |
| CompleteEvent durable timer | EN-11-T2 | Blocked by ephemeral-server permissions |
| Replay in CI | EN-11-T3 | Blocked: baseline histories and replay test missing |

[Local CI evidence](evidence/2026-10-20-local-ci/README.md).

The live worker and Cloud access are not verified. Jira SPM-129 also asks for a
CancelEvent semantic-lock workflow (freeze, commit, finalise, unfreeze on failure).
That workflow and its tests are absent from this branch, so this kit does not cover
all Jira acceptance criteria and EN-11 is not complete. The cancellation integration
needs implementation before runnable end-to-end cards can name its actual interface.
