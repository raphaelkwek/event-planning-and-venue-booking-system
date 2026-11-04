# Experiment 1: a crash mid-cancellation leaves no partial release

**Status:** Not run (designed). F3 and F4 have merged (4 Nov re-check), but without the `CancelEvent` workflow this experiment kills; see "Re-checked on 4 Nov 2026" below.
**Card:** EN-20-T1 · **Run:** none, not run · **Commit:** `faf5ebc` · **Date:** 2026-11-03

## Hypothesis

If the pod running the `CancelEvent` workflow is killed after the freeze step, the workflow resumes on another pod and the
outcome is all or nothing: every registration of the event is Cancelled and every seat retired, or none is (ADR-0009's
semantic lock: registration marks the registrations `CANCEL_PENDING`, the core commits the cancellation and every release in one
transaction, registration finalises).

## Injection

Kill one `planning-core-worker` pod once the workflow is past the freeze step: [`deploy/chaos/01-core-pod-kill.yaml`](../../../deploy/chaos/01-core-pod-kill.yaml)
(Chaos Mesh `PodChaos`, `pod-kill`, mode `one`). Apply it by hand when Temporal's UI shows the freeze step done.

## Pass condition

After the workflow finishes: the event's registrations are all `CANCELLED` and its seats all `RETIRED`, or the registrations are all
back to `REGISTERED` and no seat was freed. Never a mixture, and no registration left `CANCEL_PENDING`.

## Actual result

**Not run.** The `CancelEvent` workflow and the `CANCEL_PENDING` state belong to F3 and F4, which are in pull requests #71 and #72 and are not
on this branch, so there is nothing to kill. What exists is the manifest, which kubeconform validates against the Chaos Mesh CRDs
(job `Manifests`, EN-20-T8); it was not applied, because the team has no staging cluster running Chaos Mesh.

What the registration side already guarantees, from earlier work and not from this experiment: a cancelled event's seats are retired in one
transaction with its registrations being Cancelled (`retireSeatsOfEvent`, R3), and a message delivered twice changes nothing (experiment 5).

## Re-checked on 4 Nov 2026

F3 and F4 merged without a `CancelEvent` workflow or a `CANCEL_PENDING` state. planning-core cancels the event and releases its
venue and equipment arrangements in one transaction (`modules/change/repo/cancelEvent.ts`), and the registration service cancels the
event's registrations and waitlist entries when it consumes `event.cancelled`, in one transaction with its inbox
(`consumer/handleListing.ts`). So there is no workflow step to crash after, and the hypothesis above has nothing to act on. The
all-or-nothing question moves to the consumer: kill the registration service while it handles `event.cancelled` and check the
event's registrations are all Cancelled, or all still Registered, once it restarts and the message is redelivered. That needs a
new injection (the deployed environments are one container each on an Azure VM, with no Chaos Mesh), so it is not run here.

## Fix log

None. Nothing ran, so nothing was found.

## To run it

1. Merge F3 and F4 and deploy to staging with Chaos Mesh installed.
2. Register a few attendees for an event, start its cancellation, apply the manifest after the freeze step, wait for the workflow.
3. Read the two states above and record them here with the run's Temporal workflow id.
