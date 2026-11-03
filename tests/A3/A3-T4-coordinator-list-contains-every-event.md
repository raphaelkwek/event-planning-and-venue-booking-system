# A3-T4 — A coordinator's event list contains the events assigned to them, whoever owns them, and no other

## Specification

| Item | Content |
|---|---|
| Test Case ID | A3-T4 |
| Test Scenario | A coordinator's event list contains the events assigned to them, whoever owns them, and no other |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. As `organiser@connectsphere.test`: FX-APPROVED (assigned to `coordinator@connectsphere.test` by FX-ASSIGNED).<br>3. As `organiser2@connectsphere.test`: FX-SUBMITTED with Event name `Organiser two's symposium`, left unassigned.<br>4. As `organiser2@connectsphere.test`: FX-SUBMITTED with Event name `Assigned elsewhere`, then FX-ASSIGNED to Coordinator Two.<br>5. As `organiser@connectsphere.test`: FX-DRAFT with Event name `Unfinished idea`.<br>6. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Click "All events". |
| Test Data | Account: `coordinator@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | "Annual Research Symposium" is listed with status "Approved". "Organiser two's symposium" (unassigned), "Assigned elsewhere" (Coordinator Two's) and "Unfinished idea" (another user's draft) are not listed. |
| Created By | Chai Yichen |
| Date of Creation | 2026-09-17 |

> **Revised for A4 (CR-05) on 2 Nov 2026.** A3's "coordinators see all events" is superseded: a coordinator's list holds only the events assigned to them.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Expected result revised for A4 (CR-05) on 2026-11-02; the earlier run checked the superseded behaviour. Re-run against the A4 build. |
| Executed By | |
| Date of Execution | |
