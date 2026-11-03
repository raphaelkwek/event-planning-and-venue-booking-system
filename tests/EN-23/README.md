# EN-23 — Threat model, PDPA review, ASVS checklist

EN-23 is an enabler: its deliverables are documents in `documentation/security/`. The cards check that
the documents are complete and honest. They do not check that the system is secure.

| Acceptance criterion | Cards |
|---|---|
| A STRIDE table per container | EN-23-T1, T2, T5 |
| A PDPA note on attendee data | EN-23-T3, T2 |
| An ASVS Level 2 checklist mapped to controls | EN-23-T4, T2 |

Cards T1 to T5 run as one `node:test` file, `documentation/scripts/check-docs.test.ts`, which CI runs with
the other script tests. Whether each cited control really works is a reviewer's judgement; the check only
proves that the cited line exists.
