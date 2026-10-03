# ADR-0008: Kafka with a CDC outbox, CloudEvents and a schema registry

**Status:** Accepted
**Date:** 2026-10-01
**Owner:** Seann, who took EN-04 (SPM-122) on 2 Oct 2026. The owner presents this in the Week 13 Q&A.
**Approval:** team decision, reported 1 Oct 2026. See the gate log in `documentation/proposals/2026-10-01-target-architecture-and-jira-plan.md` §8.

## Context

ADR-0001 made asynchronous messaging through Kafka the default, and ADR-0003 chose one hosted Kafka cluster shared by the team. That hosted-cluster choice stands. In Sprint 1, outbox rows were written correctly, but nothing published them, so every notification acceptance criterion stopped at the outbox.

`implementation.md` §3 named one topic per event type, for example `event.submitted` and `event.cancelled`. Kafka orders messages only within a partition, so two messages about the same event on different topics can arrive in either order.

The briefing's maintainability requirement (8g) also means a producer mustn't be able to silently break a consumer by changing a message's shape.

## Decision

**Outbox plus Kafka, published safely:**

- **Outbox rows commit with the state change** they describe, unchanged from today.
- **Publishing:** Debezium change data capture reads the write-ahead log and publishes outbox rows, so there's no polling relay and no dual write. Supabase may not allow the logical replication slot this needs, so EN-05 starts with a spike. Until that spike passes, a relay using `FOR UPDATE SKIP LOCKED` publishes the rows (EN-04).
- **Topics:** one per aggregate type, keyed by aggregate id. That restores per-event ordering.
- **Envelope:** every message is a **CloudEvents 1.0** envelope carrying `traceparent`, validated by `contracts`.
- **Schema registry:** payload schemas live in a registry, and CI checks backward compatibility. An AsyncAPI catalogue documents the messages (ADR-0015).
- **Consumers:** each uses a transactional **inbox**, where a unique message id makes side effects happen once. Failed messages go to **retry topics**, then to a **dead-letter topic** that can be replayed.

## Alternatives considered

- **A polling relay as the permanent publisher.** It works, but it adds latency, database load and custom code. It's kept only as the fallback until the CDC spike passes.
- **Topics per event type (the current §3.1).** Ordering breaks across types for the same event. Rejected.
- **A custom envelope (the current §3.3).** CloudEvents is the CNCF standard, and existing tools already read it. Rejected.

## Consequences

**What we get:**
- A notification exists only if its trigger committed.
- Duplicate deliveries are harmless.
- One bad message can't block the ones behind it.
- Message formats can't drift silently.

**What it costs:**
- Kafka Connect and a logical replication slot, if the spike allows it.
- An inbox table per consumer.
- Retry and DLQ topics to monitor.
- T2's notification becomes visible shortly after the action rather than inside it. CQ-03 asks the customer to accept roughly 10 seconds.

**What a reviewer should watch for:**
- A producer that publishes outside the outbox.
- A consumer without an inbox check.
- A schema change that isn't backward compatible.

**Implemented by:** EN-04 (SPM-122), together with SPM-113 (Kafka provider), and EN-05 (SPM-123). **Supersedes:** the topic naming and envelope in `implementation.md` §3.1 and §3.3.

## Decision note, 2026-10-02: the hosted provider (SPM-113)

**Decided by:** Seann (EN-04), with the team. This replaces the "Hosted Kafka provider not yet chosen" item in `implementation.md`'s appendix.

**Decision:** Aiven's free plan for development now. Then one cutover to a Confluent Cloud Basic cluster on its free trial, from **13 Oct 2026**, which lasts through the Week 13 Q&A on **Wed 11 Nov**.

**Why two providers.** The constraints were enough topics, a cluster that lasts the semester, and SASL that kafkajs supports. No single free option met all three:

| | Aiven free | Confluent Cloud trial |
|---|---|---|
| Topics | 5 | the full layout below |
| Lasts | indefinitely | 30 days ($400 credit), then the organisation is suspended |
| Auth (kafkajs) | SASL/SCRAM-SHA-256 over TLS, with Aiven's own CA | SASL/PLAIN with API keys, over publicly trusted TLS |
| Schema registry | Karapace, included | Stream Governance Essentials |
| Kafka Connect (for EN-05's CDC) | no | managed connectors, paid from the credit |

So Aiven covers Sprint 2 and early Sprint 3, when only a few producers exist. Confluent covers the period when the whole layout must run and be demonstrated.

**Rejected:**
- **Two Aiven organisations for ten topics.** That gives two clusters, not one: two sets of credentials, and an aggregate split across clusters.
- **Moving a Confluent cluster to another member's trial.** Clusters can't move between organisations, and Cluster Linking needs a paid Dedicated destination.

**Timing.** The trial runs 30 days from sign-up, and the account must not be created before 13 Oct. 13 Oct plus 30 days is 12 Nov, only a day after the Q&A, so a start on 14–15 Oct gives a few days of margin. Day 25 is the reminder to check the remaining credit.

**Topics on Aiven (`contracts/src/topics.ts`).** Five topics only, so just Sprint 2's producers and consumers, each with 2 partitions:

| Topic | Producer → consumer |
|---|---|
| `connectsphere.event.v1` | event module (A–E, F, G) → notification (T2) |
| `connectsphere.equipment-request.v1` | equipment module (O2) → notification |
| `connectsphere.notification.retry.v1` | notification consumer's retries |
| `connectsphere.notification.dlq.v1` | notification consumer's dead letters |
| *(spare)* | the first Sprint 3 aggregate that publishes before the cutover |

- **This is the Decision above, applied:** one topic per aggregate, plus retry and dead-letter topics. It is not a deviation.
- **The old names are kept, not deleted.** The nine per-event-type names (§3.1) stay in `LEGACY_EVENT_TOPICS`, because outbox rows written before 2 Oct carry them. The relay sends those rows through `aggregateTopicFor()` to `connectsphere.event.v1`.
- **The message type moves into the envelope.** What each message *is* lives in its `messageType`, which becomes the CloudEvents `type`.
- **A test caps the list at five** until the cutover, so a sixth topic can't be added quietly.

**Consumer groups.**
- **Deployed:** a consumer joins `connectsphere.<service>.<consumer>`.
- **On a laptop:** the group gets `.<KAFKA_GROUP_SUFFIX>` appended, set to `dev-<initials>`. A local consumer then never takes partitions from the deployed one or from a teammate's.
- **Topics are shared.** There are no per-person topics.

**Limits on Aiven, and what we do about them:**
- **The service powers off after 24 hours without traffic.** The outbox keeps unpublished rows, so nothing is lost. Whoever needs the cluster powers it on in the console.
- **Throughput is 250 KiB/s.** That is plenty for development.
- **There's no Kafka Connect,** so EN-05's Debezium spike waits for Confluent. Until then, the `FOR UPDATE SKIP LOCKED` relay is the publisher, as the Decision already allows.

**A risk to watch:** kafkajs hasn't had a release since early 2023. It still speaks both providers' SASL. If it blocks EN-04, the replacement is `@confluentinc/kafka-javascript`, which keeps a kafkajs-compatible API.

**Secrets:**
- No credential goes in the repo, ADR, Jira or team channel.
- Values live in each person's `.env`, and are shared by password manager or private message.
- Aiven's `ca.pem` sits outside the repo (`~/.connectsphere/kafka/`), and `.gitignore` refuses `*.pem`, `*.key` and similar as a backstop.
- `npm run kafka:check` reads only `KAFKA_*` from `.env` and never prints a credential.

**Cutover (a dated subtask under SPM-113):**
1. Create the Confluent Basic cluster on AWS `ap-southeast-1`.
2. Turn on Schema Registry, and give each member their own API key.
3. Create the full ADR-0008 layout, and lift the five-topic test.
4. In one agreed slot, everyone swaps the `KAFKA_*` block in `.env` and leaves `KAFKA_SSL_CA_PATH` empty.
5. Everyone runs `npm run kafka:check`.
6. Delete the Aiven service once nobody uses it.

Unpublished outbox rows go to Confluent, and consumer inboxes make any replay harmless.
