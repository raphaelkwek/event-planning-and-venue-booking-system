# EN-05 — CDC and schema registry

EN-05 (SPM-123) is an enabler, so it has no user-facing screens. Its Jira acceptance criteria are:
a spike on whether Debezium change data capture is possible on Supabase and our Kafka, a Debezium
outbox router that replaces the polling relay, and a CI check of backward compatibility against a
schema registry. The spike's answer is in `documentation/spikes/EN-05-cdc-spike.md`.

| Acceptance criterion | What was built | Cards |
|---|---|---|
| Spike first: confirm Supabase allows a logical replication slot | The spike document, with sources, and the decision note in ADR-0008 | EN-05-T1 |
| The Debezium outbox router replaces the relay | Debezium Server as an opt-in kustomize component, proven in CI against a throwaway Postgres and Redpanda. The relay is **not** replaced: it stays the publisher in every environment until the component has run against a real Supabase project. | EN-05-T8, EN-05-T9 |
| CI checks backward compatibility against the schema registry | A checker of the CloudEvents data schemas against the base branch, run on every pull request, and a job that asks a real Redpanda Schema Registry the same question | EN-05-T2 to EN-05-T7 |

| Card | Scenario |
|---|---|
| EN-05-T1 | The spike answers both questions with sources, and the decision is written into ADR-0008 |
| EN-05-T2 | A change to a message's data that an older message would not satisfy is refused, with the field and the rule |
| EN-05-T3 | A change that every older message still satisfies is accepted, including a brand-new message type |
| EN-05-T4 | The committed JSON Schema files are exactly what `contracts` generates, so they cannot go stale |
| EN-05-T5 | The command compares this branch's schemas with the ones on its base branch and exits non-zero only for a breaking change |
| EN-05-T6 | Every pull request runs the schema checks in CI, and a breaking change fails the build |
| EN-05-T7 | A real schema registry (Redpanda's) gives the same verdict as the checker, and the branch passes the registry's own compatibility check |
| EN-05-T8 | Debezium Server's outbox router puts the same message on Kafka as the polling relay does, for every message type |
| EN-05-T9 | The Debezium Server kustomize component renders into valid Kubernetes objects that the deployment can include |
