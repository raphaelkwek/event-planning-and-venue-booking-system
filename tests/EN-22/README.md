# EN-22 — Traceability generator and DORA metrics

EN-22 is an enabler. Its cards check the generator (`documentation/scripts/traceability-matrix.ts`),
the DORA calculation (`documentation/scripts/dora.ts`) and the workflows that run them.

| Acceptance criterion | Cards |
|---|---|
| Generates the story, AC, test, last-result matrix from test tags on every CI run | T1 to T7 |
| Tracks the four DORA metrics | T8, T9 |

T7 and T9 are proven by CI runs and the committed snapshot, not by a unit test. The weekly DORA
workflow cannot run until it is on the default branch.
