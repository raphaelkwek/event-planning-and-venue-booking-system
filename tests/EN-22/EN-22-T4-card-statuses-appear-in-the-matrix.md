# EN-22-T4 — Functional-card statuses from tests/STORY/*.md appear against the story

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-22-T4 |
| Test Scenario | Functional-card statuses from tests/STORY/*.md appear against the story |
| Pre-conditions | 1. As T1. |
| Test Steps | 1. Give the generator a tests directory with a card whose Status row says Pass (automated, API level) and one Not Executed. |
| Test Data | Synthetic cards. |
| Expected Result | The matrix lists each card with its status for that story. |
| Acceptance criterion | Cards' execution status is an input. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Cards are read from tests/STORY/*.md; a test shows the cards its name tags with their statuses; manual-card rows take the card's status; non-standard statuses are flagged while 'Pass (...)' still counts as Pass. |
| Status | Pass |
| Remarks | Commit: 62a261e · Evidence: documentation/scripts/traceability-matrix.test.ts › EN-22-T4 tests, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41512676026 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
