# R6-T8 — An attendee leaves the waitlist: the entry is kept as Withdrawn and they are not told of later openings

## Specification

| Item | Content |
|---|---|
| Test Case ID | R6-T8 |
| Test Scenario | An attendee leaves the waitlist: the entry is kept as Withdrawn and they are not told of later openings |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it). The R fixtures are in `tests/R1/README.md` and `tests/R5/README.md`. Kafka configured, and Attendee Two's account (`tests/R5/README.md`).<br>2. FX-R-EVENT with `<SEATS>` 1; Attendee Two registers; Attendee One joins the waitlist. |
| Test Steps | 1. As Attendee One, in "My registrations", on the waitlist entry, click "Leave the waitlist", then confirm.<br>2. As Attendee Two, withdraw, so a place opens.<br>3. As Attendee One, wait a few seconds and click "Notifications". |
| Test Data | Attendee One's entry from R6-T1 |
| Expected Result | Step 1: the dialog asks first; the entry then reads `Left the waitlist` with its time, and is still listed. Step 3: no notice that a place opened. |
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
