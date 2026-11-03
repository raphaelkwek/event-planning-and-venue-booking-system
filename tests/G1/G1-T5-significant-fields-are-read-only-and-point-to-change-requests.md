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
| Actual Result | Only the four descriptive fields were editable; the significant fields were shown as text under the locked-section note directing to a change request. Run on CI's throwaway stack, with unique names in place of the card's literal names. The card's 2 December 2026 event was moved to 2 December 2030 (shown 2/12/2030, 2:00:00 pm to 6:00:00 pm), so the journey never falls in the past. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: b91681d · Evidence: tests/e2e/f-status-and-confirmation.spec.ts › G1-T5 the significant fields are read-only and point to a change request, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41516713095 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
