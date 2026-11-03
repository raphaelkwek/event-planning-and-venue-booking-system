# R4-T4 — Negative: withdrawing a registration that is already Withdrawn, or Cancelled, is refused and changes nothing

## Specification

| Item | Content |
|---|---|
| Test Case ID | R4-T4 |
| Test Scenario | Negative: withdrawing a registration that is already Withdrawn, or Cancelled, is refused and changes nothing |
| Pre-conditions | Automated (CI), against the registration schema. |
| Test Steps | 1. Withdraw a registration.<br>2. Withdraw it again.<br>3. Withdraw a registration whose event was cancelled. |
| Test Data | One withdrawn and one cancelled registration |
| Expected Result | Steps 2 and 3 are `409` `REGISTRATION_NOT_ACTIVE`, naming the registration and its status (`… is Withdrawn …`, `… is Cancelled …`). The first withdrawal time is unchanged and no second withdrawal message is written; places remaining is unchanged. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | A second withdrawal was 409 REGISTRATION_NOT_ACTIVE, "Registration REG-… is Withdrawn, so it cannot be withdrawn."; the first withdrawal time was unchanged, one withdrawn message existed, places stayed 3. A cancelled one was 409 naming "is Cancelled". |
| Status | Pass |
| Remarks | Automated (API level) · Commit: 4f9ab08 · Evidence: backend/services/registration/tests/api/r4Cards.test.ts › R4-T4 refuses to withdraw a registration that is already Withdrawn or Cancelled, changing nothing, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41602701323 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
