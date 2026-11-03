# EN-17-T6 — Notification freshness is observed when a notification is stored

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-17-T6 |
| Test Scenario | Notification freshness is observed when a notification is stored |
| Pre-conditions | Dependencies installed (`npm ci`). No database, Kafka or Prometheus server is needed unless the steps say so. |
| Test Steps | 1. Handle an approval message whose time was 3 s ago.<br>2. Read the freshness histogram. |
| Test Data | A CloudEvent with time = now - 3000 ms. |
| Expected Result | notification_visibility_lag_seconds records one observation of about 3 s; a duplicate message records nothing. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Handling an event.approved message whose time was 3 s before the handler's clock stored the notification and added exactly one observation to notification_visibility_lag_seconds, of 3 s (the sum rose by 3). Handling the same message again as a duplicate returned the outcome duplicate and the histogram's count did not change. |
| Status | Pass |
| Remarks | Automated (unit) · Commit: a74ca8b · Evidence: backend/services/notification/tests/metrics.unit.test.ts › EN-17-T6 a stored notification records its lag once, and a duplicate records nothing (3 of 3 tests in the file passed), CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41601054398, job Lint, typecheck, build, unit tests · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
