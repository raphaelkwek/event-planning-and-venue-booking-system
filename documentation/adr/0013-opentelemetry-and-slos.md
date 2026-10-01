# ADR-0013: OpenTelemetry and SLOs

**Status:** Accepted
**Date:** 2026-10-01
**Owner:** whoever takes EN-08 (SPM-126), not yet assigned. The owner presents this in the Week 13 Q&A.
**Approval:** team decision, reported 1 Oct 2026. See the gate log in `documentation/proposals/2026-10-01-target-architecture-and-jira-plan.md` §8.

## Context

The briefing wants every action traceable (8f), and the Week 13 Q&A asks us to trace a requirement through the system. Today we have JSON logs and correlation ids (`implementation.md` §9), which means debugging across services is a search through several log files.

The briefing's "complete within a reasonable time" also has no number attached to it.

## Decision

- **OpenTelemetry** instruments HTTP, Postgres, Kafka and Temporal. W3C trace context is carried through message headers, and the existing correlation id becomes the trace id.
- **Grafana** holds traces (Tempo), metrics (Prometheus) and logs (Loki).
- **SLOs:**
  - Registration p95 ≤ 800 ms at 500 req/s.
  - Zero over-admissions.
  - Staff p95 ≤ 400 ms for reads and ≤ 800 ms for writes, at 300 users.
  - 99% of notifications visible within 10 s of the commit.
  - 99.9% monthly availability.
- **Error budgets** raise multi-window burn-rate alerts, and each alert has a runbook.

## Alternatives considered

- **Logs only, with correlation ids (the current design).** No timings and no single view of a request. Rejected.
- **A vendor-specific APM agent.** It ties us to one tool, whereas OpenTelemetry is the standard any backend reads. Rejected.

## Consequences

**What we get:**
- One trace that follows an approval from the gateway to the core, then Kafka, then the notification.
- Performance claims backed by numbers.
- Alerts before users notice.

**What it costs:**
- Instrumentation in every service.
- A Grafana stack to run.
- SLO numbers that the load tests (EN-18) must actually meet.

**What a reviewer should watch for:** a new service or consumer that doesn't propagate trace context.

**Implemented by:** EN-08 (SPM-126) and EN-17 (SPM-135). **Extends:** `implementation.md` §9.
