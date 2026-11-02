# EN-20-T1 — Experiment 1: a crash mid-cancellation leaves no partial release

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-20-T1 |
| Test Scenario | Experiment 1: a crash mid-cancellation leaves no partial release |
| Pre-conditions | 1. F3 and F4 (event cancellation) and ADR-0009's CancelEvent workflow are merged. They are in pull requests #71 and #72 and are not on this branch. |
| Test Steps | 1. Apply `deploy/chaos/01-core-pod-kill.yaml` in staging while an event with registrations is cancelled.<br>2. Kill the core pod after the freeze step.<br>3. Let the workflow resume on another pod. |
| Test Data | An event with registrations, cancelled through F3. |
| Expected Result | The workflow resumes on another pod and the outcome is all or nothing: either every registration is Cancelled and every seat retired, or none is. |
| Acceptance criterion | Experiment 1 (architecture §7): hypothesis, result and fix log. Chaos Mesh in staging. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result |  |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By |  |
| Date of Execution |  |
