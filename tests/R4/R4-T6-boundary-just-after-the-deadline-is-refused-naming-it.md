# R4-T6 — Boundary: a withdrawal one millisecond after the deadline is refused naming the deadline; status and places are unchanged

## Specification

| Item | Content |
|---|---|
| Test Case ID | R4-T6 |
| Test Scenario | Boundary: a withdrawal one millisecond after the deadline is refused naming the deadline; status and places are unchanged |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it).<br>2. FX-R-EVENT run with `<DEADLINE>` = `now() + interval '2 minutes'`.<br>3. Signed in as `attendee@connectsphere.test` / `ConnectSphere-Test-1234!`. Register (R2-T1 steps 1–2).<br>(Automated with the clock fixed at 1 ms after the deadline.) |
| Test Steps | 1. Wait until the deadline has passed (2 minutes), then withdraw (R4-T1 steps 1–3).<br>2. Check the registration and places remaining. |
| Test Data | Deadline two minutes after the fixture runs |
| Expected Result | The dialog shows the server's message naming the deadline: `The withdrawal deadline for … was <day>, <time>, so the registration can no longer be withdrawn.`; the response is `422` `WITHDRAWAL_DEADLINE_PASSED`. The registration is still `Registered` and places remaining is unchanged. |
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
