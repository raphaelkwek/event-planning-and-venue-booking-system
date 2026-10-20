# F5-T21 — In the browser, the assigned coordinator confirms the arrangements, sees a refusal while something is outstanding, and then sees Safety Review

## Specification

| Item | Content |
|---|---|
| Test Case ID | F5-T21 |
| Test Scenario | In the browser, the assigned coordinator confirms the arrangements, sees a refusal while something is outstanding, and then sees Safety Review |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-BOOKING (`tests/L1/README.md`); note the event's id, reference and assigned coordinator. The event records "Equipment required: Yes".<br>3. The assigned coordinator has requested `Lee Kong Chian Auditorium`, Theatre, 2 December 2026 14:00–18:00, and `venuestaff@connectsphere.test` has approved it (M1-T3).<br>4. The assigned coordinator has recorded one equipment line (O1-T1), and `techsupport@connectsphere.test` has set it Confirmed (O2) but **not** reserved it. |
| Test Steps | 1. Sign in as the assigned coordinator. Open the event from "All events".<br>2. Click "Confirm arrangements", then "Confirm arrangements" in the dialog.<br>3. Sign out; sign in as `techsupport@connectsphere.test`; reserve the line in full (Q1-T1's steps).<br>4. Sign out; sign in as the assigned coordinator; open the event; click "Confirm arrangements" and confirm in the dialog.<br>5. Open the event's status history. |
| Test Data | Accounts: the assigned coordinator (`coordinator@connectsphere.test` or `coordinator2@connectsphere.test`, password `ConnectSphere-Test-1234!`), `techsupport@connectsphere.test` / `ConnectSphere-Test-1234!`. |
| Expected Result | After step 2, the dialog stays open and shows, inline, "This event can't be confirmed yet." with the equipment line named as Confirmed, and the status lozenge still reads Approved. After step 4 the dialog closes and the lozenge reads "Safety Review", not "Confirmed". "Confirm arrangements" is no longer offered. Step 5 shows Approved → Safety Review, the coordinator's role and the time. A different coordinator opening the event sees no "Confirm arrangements". |
| Created By | Shawmya, via Claude |
| Date of Creation | 2026-10-20 |

> **Expected results are checked by the story owner** against F5's acceptance criteria before the code
> is written (implementation.md §11.12).

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
