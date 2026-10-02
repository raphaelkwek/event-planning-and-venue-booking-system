# ADR-0008: Kafka with a CDC outbox, CloudEvents and a schema registry

**Status:** Accepted
**Date:** 2026-10-01
**Owner:** whoever takes EN-04 (SPM-122), not yet assigned. The owner presents this in the Week 13 Q&A.
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
