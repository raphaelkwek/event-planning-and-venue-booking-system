# EN-20-T6 — Experiment 6: a partition cannot push seats over a reduced capacity

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-20-T6 |
| Test Scenario | Experiment 6: a partition cannot push seats over a reduced capacity |
| Pre-conditions | 1. The ReduceCapacity workflow of ADR-0009 is built. It is not, on this branch. |
| Test Steps | 1. Apply `deploy/chaos/06-core-registration-partition.yaml` during a capacity reduction.<br>2. Heal the partition. |
| Test Data | An event with registrations close to its capacity, reduced by the organiser. |
| Expected Result | While partitioned the seats never exceed the new capacity, and after the heal the workflow completes. |
| Acceptance criterion | Experiment 6: cut core to registration during ReduceCapacity; seats never exceed the new capacity; the workflow completes after heal. Chaos Mesh in staging. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Not run. The ReduceCapacity workflow (ADR-0009) is not built, so there is no capacity reduction to partition. The Chaos Mesh manifest (deploy/chaos/06-core-registration-partition.yaml) is written and validated by EN-20-T8, not applied. |
| Status | Blocked |
| Remarks | Blocked by the ReduceCapacity workflow and a staging cluster with Chaos Mesh · Evidence: documentation/evidence/EN-20/6-partition-and-reduced-capacity.md · Defect: — |
| Executed By |  |
| Date of Execution |  |
