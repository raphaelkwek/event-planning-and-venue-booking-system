# E2-T5 — Nominating someone who does not hold the Coordinator role is refused

## Specification

| Item | Content |
|---|---|
| Test Case ID | E2-T5 |
| Test Scenario | The system verifies the nominee is eligible (holds the Coordinator role); an ineligible nominee is refused with a clear reason |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SUBMITTED completed. |
| Test Steps | 1. Sign in as the coordinator shown in "Assigned coordinator".<br>2. Open the request.<br>3. "Propose reassignment" → enter `attendee@connectsphere.test`'s user id (`00000000-0000-0000-0000-000000000005`, from `tests/README.md`) → "Send proposal". |
| Test Data | Nominee user id: `00000000-0000-0000-0000-000000000005` (an Attendee account, not a Coordinator). |
| Expected Result | The dialog shows a refusal: "The nominee does not hold the Coordinator role and cannot be nominated." No proposal is created. |
| Created By | Shawmya |
| Date of Creation | 2026-09-18 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Nominating the attendee account (00000000-0000-0000-0000-000000000005) was refused in the dialog with "The nominee does not hold the Coordinator role and cannot be nominated.", and no proposal was created. |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/E2/evidence/E2-T5.png · Defect: — |
| Executed By | Sahanya |
| Date of Execution | 2026-09-20 |
