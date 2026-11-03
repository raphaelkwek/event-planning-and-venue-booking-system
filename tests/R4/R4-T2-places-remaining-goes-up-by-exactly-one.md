# R4-T2 — Places remaining increases by exactly one on a successful withdrawal

## Specification

| Item | Content |
|---|---|
| Test Case ID | R4-T2 |
| Test Scenario | Places remaining increases by exactly one on a successful withdrawal |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it).<br>2. FX-R-EVENT run with its defaults (3 seats), then FX-R-TAKEN with `<N>` = 1.<br>3. Signed in as `attendee@connectsphere.test` / `ConnectSphere-Test-1234!`. Register (R2-T1 steps 1–2). |
| Test Steps | 1. Open the event from "Events" and note places remaining.<br>2. Withdraw (R4-T1 steps 1–3).<br>3. Open the event again. |
| Test Data | 3 seats: 1 taken by another attendee, 1 by Attendee One |
| Expected Result | Step 1 shows `1 place remaining`; step 3 shows `2 places remaining`. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result |  |
| Status | Not Executed |
| Remarks | Proven by backend/services/registration/tests/api/r4Cards.test.ts › R4-T2 puts places remaining up by exactly one (API level), passed in CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41602701323 (commit 4f9ab08). UI walk-through in Chrome pending at the sprint review. |
| Executed By |  |
| Date of Execution |  |
