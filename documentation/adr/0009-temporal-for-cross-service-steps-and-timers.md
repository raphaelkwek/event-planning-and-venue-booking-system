# ADR-0009: Temporal runs cross-service steps and timers

**Status:** Accepted. Supersedes ADR-0002.
**Date:** 2026-10-01
**Owner:** whoever takes EN-11 (SPM-129), not yet assigned. The owner presents this in the Week 13 Q&A.
**Approval:** team decision, reported 1 Oct 2026. See the gate log in `documentation/proposals/2026-10-01-target-architecture-and-jira-plan.md` §8.

## Context

**F4 needs all or nothing.** ADR-0002 met F4's all-or-nothing criterion with an orchestrated saga that compensates by re-booking what it released. That compensation can fail if someone takes the slot in between, which ADR-0002 admitted. With ADR-0004 and ADR-0005, cancellation crosses exactly two deployables: the core and the registration service.

**F1 needs a reliable timer.** An event must become Completed only after its end time. `plan.md` §3 assigned that to a "Scheduled Job Runner" that has no owner and no story.

**R6 and S3 need durable fan-out.** R6 needs waitlist invitations, and S3 needs change notifications.

**Incomplete arrangements are hard to spot.** The briefing complains about exactly that.

## Decision

**These processes run as Temporal workflows:**
- **CancelEvent** (F3 and F4).
- **ReduceCapacity:** shrink seats first, then commit the venue change.
- **CompleteEvent:** a durable timer that fires at the event's end time (F1).
- **WaitlistInvitation** (R6).
- **ChangeImpactNotify:** fans out the S3 notifications.
- **HoldExpiry** (L6, Week 7 change CR-04): a durable timer per tentative hold. It sends a reminder before expiry, then expires the hold if it hasn't been converted or released. This is exactly the kind of timer this ADR exists for.

**How F4 stays all-or-nothing, using a semantic lock:**
1. The registration service marks the event's registrations `CANCEL_PENDING`. They still count, so nothing is freed.
2. The core commits the cancellation and every release **in one transaction** (ADR-0004).
3. Registration finalises. This step can't fail on business grounds and is retried until it's done.

If step 1 or step 2 fails, the workflow unmarks the registrations. That undo can't conflict, because nothing was released. This is the semantic-lock countermeasure from Richardson's *Microservices Patterns*, chapter 4.

## Alternatives considered

- **ADR-0002's saga, which compensates by re-booking.** It fails if the slot is taken first. Superseded.
- **Cron plus choreographed event handlers.** That scatters failure handling across services and gives no view of what's in flight. Rejected.

## Consequences

**What we get:**
- Processes survive pod restarts.
- Retries and timers are declared rather than hand-written.
- Temporal's UI lists every process in flight.
- Time-skipping tests prove F1's "only after the end time" in milliseconds.

**What it costs:**
- Workflow code must be deterministic.
- Changing a running workflow needs versioning, and replay tests in CI guard against mistakes.
- It's one more component to run.

**Sequencing issue:** EN-11 is planned for Sprint 3, but F1 is in Sprint 2. F1's "Completed after the end time" criterion waits for this, so raise it at the Sprint 2 review.

**What a reviewer should watch for:** non-deterministic calls (time, random, I/O) directly in workflow code, and a release that happens outside the core's cancellation transaction.

**Implemented by:** EN-11 (SPM-129). Proved by EN-20 (chaos experiments 1 and 6).
