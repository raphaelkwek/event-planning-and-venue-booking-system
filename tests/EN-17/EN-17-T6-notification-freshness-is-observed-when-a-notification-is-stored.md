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
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
