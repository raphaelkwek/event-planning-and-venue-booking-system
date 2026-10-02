# ADR-0015: Contract-first HTTP APIs

**Status:** Accepted
**Date:** 2026-10-01
**Owner:** whoever takes EN-09 (SPM-127), not yet assigned. The owner presents this in the Week 13 Q&A.
**Approval:** team decision, reported 1 Oct 2026. See the gate log in `documentation/proposals/2026-10-01-target-architecture-and-jira-plan.md` §8.

## Context

`implementation.md` §5 defines HTTP conventions, but the API exists only in code. Venue Staff retrying on weak Wi-Fi can submit twice. Two coordinators editing the same event can overwrite each other.

The rubric's system design row asks us to communicate significant decisions and trade-offs, and the repo holds no machine-readable API description.

## Decision

- **OpenAPI 3.1 is written before the code**, one spec per deployable. AsyncAPI documents the Kafka messages (ADR-0008).
- **Every POST takes an `Idempotency-Key`**, so a retry can't submit twice.
- **Edits require `If-Match`**, carrying the expected version of the event stream (ADR-0007), so no update is lost.
- **Errors use RFC 9457 `problem+json`**, keeping the `fields[]` extension that B2 needs to name every failing field.
- **Lists use cursor pagination.**
- **Consumer-driven contract tests (Pact)** catch breaking changes before merge, and the typed clients are generated from the specs (ADR-0014).
- **The C4 model is code too:** Structurizr DSL, rendered in CI (EN-09).

## Alternatives considered

- **Code-first, specs generated afterwards.** The specs describe whatever happened rather than what was agreed, and breaking changes surface late. Rejected.
- **A custom error shape (the current §5).** RFC 9457 is the standard, and the `fields[]` extension carries over unchanged. Rejected in favour of the standard.

## Consequences

**What we get:**
- Retries are safe.
- Lost updates are refused with `412`.
- Documentation and clients come from one source.
- Submission folder 2 (C4) is generated from source.

**What it costs:**
- Specs to write before code.
- Contract tests to keep green.

**What a reviewer should watch for:**
- An endpoint missing from the spec.
- A POST without idempotency.
- An edit without `If-Match`.

**Implemented by:** EN-09 (SPM-127). **Extends:** `implementation.md` §5.
