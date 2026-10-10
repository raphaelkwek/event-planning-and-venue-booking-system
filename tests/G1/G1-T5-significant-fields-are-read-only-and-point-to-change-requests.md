# G1-T5 — The edit screen shows the significant fields read-only and directs the user to the change-request process

## Specification

| Item | Content |
|---|---|
| Test Case ID | G1-T5 |
| Test Scenario | The edit screen shows the significant fields read-only and directs the user to the change-request process |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-APPROVED completed.<br>3. Signed in as `organiser@connectsphere.test`. |
| Test Steps | 1. Open the request from "My requests" and click "Edit details".<br>2. Look at the event date and times, expected attendance, venue requirements and equipment requirements. |
| Test Data | Account: `organiser@connectsphere.test` · The standard request: 2 December 2026, 14:00–18:00, attendance 150 |
| Expected Result | Only Purpose, Description, Accessibility notes and Contact details can be typed into. The date and times (2 December 2026, 14:00–18:00), expected attendance (150), venue requirements and equipment requirements are shown as text, under a note that they can be changed only through a change request, because changing them affects the arrangements already made. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-11 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The screen had 4 fields to type into: Purpose, Description, Accessibility notes and Contact details. The section "Changed only through a change request" showed, as text only: "Changed only through a change requestThese can be changed only through a change request, because the arrangements already made depend on them.Date and time12/2/2026, 2:00:00 PM to 12/2/2026, 6:00:00 PMExpected attendance150Venue requirements—Equipment requirementsNone required" |
| Status | Pass |
| Remarks | Commit: c1aa0cb · Evidence: tests/G1/evidence/G1-T5.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-10 |
