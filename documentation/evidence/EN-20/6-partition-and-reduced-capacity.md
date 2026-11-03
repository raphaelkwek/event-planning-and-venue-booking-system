# Experiment 6: a partition cannot push seats over a reduced capacity

**Status:** Not run (designed). Blocked by the ReduceCapacity workflow, which is not built.
**Card:** EN-20-T6 · **Run:** none, not run · **Commit:** `faf5ebc` · **Date:** 2026-11-03

## Hypothesis

If planning-core is cut off from the registration service while an organiser reduces an event's capacity, the seats never exceed the new capacity at any moment, and once the partition heals the `ReduceCapacity` workflow completes
(ADR-0009: shrink the seats first, then commit the venue change; ADR-0005: "capacity reductions go through a workflow that shrinks seats before the venue change commits").

## Injection

A two-way network partition between the `planning-core` and `registration` pods for five minutes during a capacity reduction:
[`deploy/chaos/06-core-registration-partition.yaml`](../../../deploy/chaos/06-core-registration-partition.yaml) (Chaos Mesh `NetworkChaos`, `partition`, direction `both`).

## Pass condition

Sampling the seat count every second from before the reduction until after the heal: `seats <= new capacity` at every sample once the reduction has taken effect, no seat held by an attendee is taken away, and the workflow reaches its end state after the heal.

## Actual result

**Not run.** The `ReduceCapacity` workflow does not exist: the seat inventory can shrink only by `retireFreeSeatsOfBooking` when a booking is replaced (R2), and the workflow that would sequence a reduction with the venue change is a later story.
The manifest is written and validated (EN-20-T8), not applied.

What the registration side already guarantees, and is not an experiment result: seats are rows, so capacity is the number of rows that can be claimed, and a claim cannot exceed them (EN-18's spike: exactly 100 of 5,000 attempts for 100 seats).

## Fix log

None. Nothing ran.

## To run it

1. Build `ReduceCapacity` and deploy it to staging with Chaos Mesh installed.
2. Fill an event to within a few seats of its capacity, start a reduction, apply the manifest, sample the seat count, delete the manifest, let the workflow finish.
3. Record the samples and the workflow's end state here.
