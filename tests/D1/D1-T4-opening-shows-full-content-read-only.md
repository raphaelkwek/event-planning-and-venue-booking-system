# D1-T4 — Opening a request shows its full submitted content, read-only, including requirements

## Specification

| Item | Content |
|---|---|
| Test Case ID | D1-T4 |
| Test Scenario | Opening a request shows its full submitted content, read-only, including requirements |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-SUBMITTED, also entering the venue and equipment requirements in Test Data before "Submit request". |
| Test Steps | 1. Go to http://localhost:5173 and sign in as `coordinator@connectsphere.test`.<br>2. Click "Review queue", then "Open" on "Annual Research Symposium". |
| Test Data | Account: `coordinator@connectsphere.test` / `ConnectSphere-Test-1234!`<br>Room layout: `Theatre` · Facilities: `Projector, Microphone` · Equipment is required: ticked · Equipment line: `Wireless microphone`, quantity `4` |
| Expected Result | The screen shows the purpose, description, proposed start and end, expected attendance 150, accessibility needs "Step-free access to the stage", venue requirements "Room layout: Theatre" and "Facilities: Projector, Microphone", and equipment requirements "4 × Wireless microphone". None of them can be edited on this screen. |
| Created By | Sahanya |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The review screen showed Purpose: Share faculty research; Description: A one-day symposium for the school of computing.; Proposed start: 12/2/2026, 2:00:00 PM; Proposed end: 12/2/2026, 6:00:00 PM; Expected attendance: 150; Accessibility needs: Step-free access to the stage; Venue requirements: Room layout: TheatreFacilities: Projector, Microphone; Equipment requirements: 4 × Wireless microphone. The only input on the screen is the clarification box — no request field can be edited. |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/D1/evidence/D1-T4.png · Defect: — |
| Executed By | Chai Yichen |
| Date of Execution | 2026-09-20 |
