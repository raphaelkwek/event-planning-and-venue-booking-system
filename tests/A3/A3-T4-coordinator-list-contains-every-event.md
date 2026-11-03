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
| Actual Result | "All events" listed the coordinator's own approved event and none of the unassigned, other-coordinator or draft events. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6f5ed43 · Evidence: tests/e2e/a-sign-in-and-access.spec.ts › A3-T4 a coordinator's event list contains the events assigned to them, whoever owns them, and no other, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41604122084 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
