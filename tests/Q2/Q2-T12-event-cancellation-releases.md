# Q2-T12 — Cancelling an event releases all its reservations

## Specification

| Item | Content |
|---|---|
| Test Case ID | Q2-T12 |
| Test Scenario | F4's cancellation releases every Reserved line of the event, recording the cancelling user and F4's reason |
| Pre-conditions | 1. F4 (event cancellation) is built, and E1 has at least two Reserved lines. |
| Test Steps | 1. As the user cancelling E1, cancel E1 through F4.<br>2. Read E1's reservations and their lines.<br>3. Read CHAIRS availability for E1's window and C1's notifications. |
| Test Data | F4 cancels E1 |
| Expected Result | Every `RESERVED` reservation of E1 is `RELEASED` by the cancelling user with F4's reason. Availability is restored, and C1 is notified. |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-16 |

> **Expected results are checked by the PR reviewer** against Q2's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Not Executed until F4 is built. Owning story: F4. |
| Executed By | |
| Date of Execution | |
