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

## Note, 3 Nov 2026: the deployed environments (ADR-0016)

Development keeps the Temporal Cloud namespace this ADR chose. The deployed staging and production
environments on the k3s VM each run the Temporal CLI's dev server in their namespace (`temporal
server start-dev`, its SQLite file on a PersistentVolumeClaim), because Temporal Cloud has no free
plan. The worker reaches it through the same `TEMPORAL_*` variables (`temporal:7233`, namespace
`default`, no API key, so a plain connection inside the namespace). Workflows, versioning and replay
tests are unchanged; there is one Temporal process per environment and no UI is exposed.

## Note, 4 Nov 2026: timers survive a redeploy

"Processes survive pod restarts" held on k3s, where Temporal's SQLite file is on a
PersistentVolumeClaim, but not on the Azure VM: there it was in the container's `/tmp`, and every
merge to main replaced the container. On 4 Nov a Confirmed event stayed Confirmed 30 minutes past its
end. Now, on the VM, Temporal's file is on a named volume per environment
(`connectsphere-<env>-temporal`), which outlives the container. Wherever the worker runs, it also
re-creates every CompleteEvent and HoldExpiry timer from the database when it starts, with the
consumers' workflow ids. The VM's container also runs F1's completion sweep and L6's hold-expiry
sweep every five minutes, so a lost timer delays a completion or an expiry by at most that long. The
decision is unchanged; see `documentation/deploy/README.md`, "What survives a redeploy".

Author: Joash

## Implementation note (3 Nov 2026)

The CancelEvent workflow was never built, and nothing in the code runs F3 or F4 through Temporal. The decision above is unchanged; this records what was built instead.

- **Cancellation is one core transaction.** F3's route (`POST /api/v1/events/{id}/cancellation`, PR #71) and F4's release (PR #72) cancel the event and release its venue bookings, holds, pending requests and equipment reservations in one `planning-core` transaction (ADR-0004), writing `event.cancelled` to the outbox in the same transaction. A failure rolls all of it back (F4 AC5).
- **The other services act on `event.cancelled`.** The notification service tells the owner, the coordinator, the Venue Staff and the reservers. The registration service's consumer (R1–R4, PR #80, and R5–R7, PR #88; not merged on this date) cancels the event's registrations and waitlist entries and tells the attendees. There is no semantic lock: registrations are not marked `CANCEL_PENDING` first, so F4 AC4 is met only once that consumer runs, after the core commits.
- **No compensation is needed** for the core's part, since nothing is released outside its transaction. What a reviewer should watch for is unchanged: no release outside that transaction.

Author: Joash
