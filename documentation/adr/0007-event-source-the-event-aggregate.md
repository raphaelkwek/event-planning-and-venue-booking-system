# ADR-0007: Event-source the Event aggregate

**Status:** Accepted
**Date:** 2026-10-01
**Owner:** whoever takes EN-03 (SPM-121), not yet assigned. The owner presents this in the Week 13 Q&A.
**Approval:** team decision, reported 1 Oct 2026. See the gate log in `documentation/proposals/2026-10-01-target-architecture-and-jira-plan.md` §8.

## Context

Several stories need a record of what happened to an event:
- **F1:** every transition, with actor, role, time and triggering action.
- **F2:** shows that history.
- **D3:** keeps the originally submitted values.
- **G1 and S2:** record before-and-after values for each field.

The briefing's auditability requirement (8f) asks who changed what, and when.

Today the history is a second table (`event.event_history`) written next to the state. That is two writes that can drift apart: if one succeeds and the other doesn't, the audit trail lies.

## Decision

**An event's state is stored as an append-only stream:** `event_stream(aggregate_id, version, type, data, actor, occurred_at, prev_hash, hash)`, with `unique(aggregate_id, version)`.

- The current state comes from the stream.
- Read projections (the review queue, lists, the current-state row) are updated **in the same transaction**, so staff always see their own writes.
- Each entry hashes the previous one, so editing history afterwards is detectable.
- The stream's version is the expected version for optimistic concurrency, exposed as `If-Match` (ADR-0015).
- Only the Event aggregate is event-sourced. Venue and Equipment keep ordinary tables.

## Alternatives considered

- **A history table beside the state (the current design).** Two writes that can drift. Rejected.
- **Event-sourcing every module.** Venue and Equipment histories are simple enough without it, so it would be cost without benefit. Rejected.

## Consequences

**What we get:**
- The history *is* the data, so it can never disagree with the current state.
- "Show this event as it was at confirmation" becomes one query.
- Tampering is evident through the hash chain.

**What it costs:**
- Changing event schemas needs upcasters.
- Projections need a rebuild command.
- Stories A to E are stored as state today and must be migrated with a one-off import (part of EN-03).
- This is Tier 2: if capacity runs short, it is cut before Tier 1 items. In that case the history table stays and this ADR is revisited.

**What a reviewer should watch for:** any code that updates an event's state without appending to the stream, or that edits a stream row.

**Implemented by:** EN-03 (SPM-121).
