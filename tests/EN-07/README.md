# EN-07 — Permission policies and row-level security

**Jira:** EN-07 (SPM-125), with EN-07.1 (SPM-163, the policies), EN-07.2 (SPM-168, row-level
security) and EN-07.3 (SPM-173, the generated matrix). **Decision:** ADR-0010.

EN-07 is an enabler, so most cards run as automated tests against a throwaway Postgres and a Cerbos
policy decision point, which CI provides. Cards T4 and T13 are about screens and the gateway.

| Acceptance criterion | Cards |
|---|---|
| AC1: Cerbos policies in the repo, evaluated by the gateway, the services and the SPA's navigation | EN-07-T1 (policies compile and pass their tests), T2 (the service asks the decision point), T3 (unreachable decision point fails closed), T4 (navigation), T5 (the permissions check), T13 (the gateway) |
| AC2: A3 and A4's scope enforced with row-level security, a per-request role and `SET LOCAL` claims inside each transaction | EN-07-T6 (organiser), T7 (coordinator, A4), T8 (the Lead, no scope, no claims), T9 (transaction-local claims), T10 (migrator and background workers) |
| AC3: a generated matrix covering role × endpoint × related and unrelated resources | EN-07-T11 (the matrix), T12 (a route without a policy fails) |

| Category | Cards |
|---|---|
| Happy path | T1, T2, T4, T6, T7, T11 |
| Negative | T3 (decision point down), T5 (no token, a forged principal, bad input), T8 (no scope, no claims), T12 (route without a policy) |
| Boundary | T5 (0, 50 and 51 checks), T7 (the moment of a reassignment), T9 (commit and rollback) |
| Cross-cutting | T9 (the transaction pooler), T10 (roles that bypass row-level security) |
