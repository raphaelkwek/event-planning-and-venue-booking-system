# P1-T14 — Signed-in technical support checks numeric availability and shortage

## Specification

| Item | Content |
|---|---|
| Test Case ID | P1-T14 |
| Test Scenario | A real signed-in technical support user sees the numeric result of peak usage and repeats checks without reserving stock |
| Pre-conditions | 1. Standard local app environment from `tests/README.md` points to a throwaway database with all migrations and seeded sign-in accounts.<br>2. Browser timezone is Asia/Singapore.<br>3. Run `tests/P1/fixtures/ui-availability.sql` immediately before the case.<br>4. Sign in as `techsupport@connectsphere.test` with password `ConnectSphere-Test-1234!`. |
| Test Steps | 1. Open "Equipment availability" in the navigation.<br>2. In "Equipment type", select `P1 Demo Conference Chairs`.<br>3. Enter "Starts at (local time)" as 15 December 2026 18:00, "Ends at (local time)" as 15 December 2026 22:00, and "Requested quantity" as `6`.<br>4. Click "Check availability" and capture the result.<br>5. Change requested quantity to `5` and click "Check availability" again.<br>6. Change requested quantity back to `6` and repeat the check. Capture the final screen and the browser Network response for each request. |
| Test Data | Equipment type `ae111111-0000-0000-0000-000000000014`, total 10. Reservations: 4 at 18:00–20:00 and 5 at 20:00–22:00 Asia/Singapore on 15 December 2026. These are back-to-back, so the peak is 5. Requested quantities: 6, 5, 6. |
| Expected Result | Every check displays `Available quantity: 5`. Requests for 6 display `Shortfall quantity: 1`; request for 5 displays `Shortfall quantity: 0`. Each request uses the chosen type and 2026-12-15T10:00:00.000Z–2026-12-15T14:00:00.000Z. Repeating the check returns the same result. No reservation confirmation or inventory change occurs. |
| Created By | Yichen, via Codex |
| Date of Creation | 2026-10-08 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: — · Evidence: — · Defect: — · Story: P1, Sprint 2 · Full real sign-in/browser procedure remains pending |
| Executed By | |
| Date of Execution | |
