# T2-T6 — The coordinator assigned by E1 reads a notification identifying the event

## Specification

| Item | Content |
|---|---|
| Test Case ID | T2-T6 |
| Test Scenario | The coordinator assigned by E1 reads a notification identifying the event |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`). |
| Test Steps | 1. Sign in as `organiser@connectsphere.test`.<br>2. "New request" → enter the standard request → "Submit request".<br>3. Sign out, sign in as the coordinator named in "Assigned coordinator".<br>4. Open the notifications list. |
| Test Data | The standard request. |
| Expected Result | The assigned coordinator sees a notification identifying the event by name/reference. The *other* seeded coordinator, signed in separately, does not. |
| Created By | Shawmya |
| Date of Creation | 2026-09-18 |

> **Split out of E1-T2 on 2026-09-20.** E1 owns the trigger (E1-T2 checks the emitted
> `event.coordinator-assigned` message and which coordinator it names); T2 owns the notification
> record, the read model and the screen this case reads. The negative half of the expected result —
> that the unassigned coordinator sees nothing — is new: it is the part that can only be checked
> once notifications are addressed to a reader. Not Executed until T2 ships in Sprint 2.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: · Awaiting T2 (Sprint 2). |
| Executed By | |
| Date of Execution | |
