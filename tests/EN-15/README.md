# EN-15 — Feature flags (OpenFeature with flagd)

EN-15 is an enabler, so it has no screen of its own. The one flag, `change-approval`, gates S2's
approve action. Each card is an automated test; the integration cards run in CI on the runner's
throwaway Postgres, and T8 needs the flagd service container, so it runs only in CI.

| Acceptance criterion | Cards |
|---|---|
| OpenFeature on the server, flagd as the provider, configured from the environment | T1, T2, T8 |
| A named default, with no flagd configured | T1, T2 |
| Flag `change-approval` gates S2 approval in production | T3, T4, T5 |
| The web app follows the flag; the server is the control | T6, T7 |

See `documentation/feature-flags.md` for how to add and flip a flag.
