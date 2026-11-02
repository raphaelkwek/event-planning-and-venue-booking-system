# R5-T5 — A withdrawal is reflected in both the row status and the totals when the list is next loaded

## Specification

| Item | Content |
|---|---|
| Test Case ID | R5-T5 |
| Test Scenario | A withdrawal is reflected in both the row status and the totals when the list is next loaded |
| Pre-conditions | 1. R5-T1's pre-conditions 1–4, and the list open as in R5-T1. |
| Test Steps | 1. In another browser, as Attendee One, withdraw the registration (R4-T1 steps 1–3).<br>2. Reload the organiser's list. |
| Test Data | As R5-T1 |
| Expected Result | Before: `Registered 1`, `Withdrawn 0`, `Places remaining 2`. After: the row reads `Withdrawn` with its withdrawal time, and `Registered 0`, `Withdrawn 1`, `Places remaining 3`. |
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
