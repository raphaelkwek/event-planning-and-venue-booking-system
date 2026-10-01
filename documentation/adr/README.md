# Architecture Decision Records

An ADR captures a significant architecture decision, the context that forced it, and what we
accepted in exchange — so that in Week 13 (or in any retro) we can answer "why did we do it this
way" with the reasoning we actually had at the time, not a reconstruction.

**When to write one:** any decision that would be expensive to reverse, that an instructor is
likely to question, or that a teammate would otherwise have to reverse-engineer from the code.
Not every choice needs one — `documentation/planning/plan.md` and `documentation/planning/implementation.md` remain the
day-to-day reference; an ADR is for the small number of decisions worth defending on their own.

**Template:**

```markdown
# ADR-000N: <title, phrased as the decision taken>

**Status:** Proposed | Accepted | Superseded by ADR-000M
**Date:** YYYY-MM-DD
**Owner:** <name> (presents it in the Week 13 Q&A)

## Context
What forced a decision here — the constraint, the requirement, the problem. No solution yet.

## Decision
What we chose, stated plainly.

## Alternatives considered
Each one, with why it lost.

## Consequences
What we get, what it costs us, and what a reviewer should watch for. Be honest about the
weak points — an ADR that only defends the choice isn't useful in a Q&A.
```

**Numbering:** sequential, never reused, even if an ADR is later superseded — supersede it in
place (update its Status) rather than deleting it.

## Index

| ADR | Title | Status |
|---|---|---|
| [0001](0001-microservices-schema-per-service-cp-consistency.md) | Microservices with schema-per-service boundaries, CP over AP | Accepted, amended by 0004 |
| [0002](0002-orchestrated-saga-for-cross-service-cancellation.md) | Orchestrated saga with compensation for F4 cancellation | Superseded by 0009 |
| [0003](0003-no-docker-hosted-kafka.md) | No Docker; one hosted Kafka cluster shared by the team | Superseded by 0012 (no-Docker rule); hosted Kafka continues under 0008 |
| [0004](0004-modular-core-instead-of-six-microservices.md) | A modular core instead of six microservices | Accepted |
| [0005](0005-registration-service-for-the-public-edge.md) | Split out the public edge as a registration service | Accepted |
| [0006](0006-postgres-enforces-every-invariant.md) | Postgres enforces every invariant | Accepted |
| [0007](0007-event-source-the-event-aggregate.md) | Event-source the Event aggregate | Accepted |
| [0008](0008-kafka-cdc-outbox-cloudevents-schema-registry.md) | Kafka with a CDC outbox, CloudEvents and a schema registry | Accepted |
| [0009](0009-temporal-for-cross-service-steps-and-timers.md) | Temporal runs cross-service steps and timers | Accepted |
| [0010](0010-policy-as-code-and-row-level-security.md) | Policy-as-code for actions, row-level security for data | Accepted |
| [0011](0011-edge-gateway-cdn-rate-limits-waiting-room.md) | Edge: gateway, CDN, rate limits, waiting room | Accepted |
| [0012](0012-containers-kubernetes-gitops-terraform.md) | Containers on managed Kubernetes, GitOps, Terraform | Accepted |
| [0013](0013-opentelemetry-and-slos.md) | OpenTelemetry and SLOs | Accepted |
| [0014](0014-two-front-ends-one-contract.md) | Two front ends, one contract | Accepted |
| [0015](0015-contract-first-http-apis.md) | Contract-first HTTP APIs | Accepted |

ADR-0004 to ADR-0015 were accepted on 2026-10-01 from the target architecture review (`documentation/proposals/2026-10-01-target-architecture-and-jira-plan.md`). Each names the enabler that implements it; that enabler's assignee owns the ADR and presents it in the Week 13 Q&A.
