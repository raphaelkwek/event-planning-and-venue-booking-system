# G2-T1 — The screens take the significant fields from the one contracts list

## Specification

| Item | Content |
|---|---|
| Test Case ID | G2-T1 |
| Test Scenario | The web app's significant-field list and labels, used by the change-request screens (S1, S2) and alongside G1's edit screen, are the ones exported by `@connectsphere/contracts`, and no file of the web app keeps its own copy |
| Pre-conditions | 1. The repository is checked out with dependencies installed (`npm ci`). No database or sign-in is needed. |
| Test Steps | 1. Run `npm test -w @connectsphere/web -- tests/significantFields.test.ts` and read the named `G2-T1 ` result.<br>2. Read `frontend/src/shared/changeRequests.ts` and `frontend/src/api/changeRequests.ts`. |
| Test Data | `SIGNIFICANT_EVENT_FIELDS` and `SIGNIFICANT_FIELD_LABELS` in `backend/packages/contracts/src`. |
| Expected Result | The test passes. The web app's `SIGNIFICANT_FIELD_LABELS` is the contracts object itself (not a copy), its keys are exactly `SIGNIFICANT_EVENT_FIELDS` (`proposedStartAt`, `proposedEndAt`, `expectedAttendance`, `venueRequirements`, `equipmentRequired`, `equipmentRequirements`), and no source file under `frontend/src` declares its own list of the six field names. In step 2 both files import the list and the field type from `@connectsphere/contracts`. |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-29 |

> **Expected results are checked by the PR reviewer** against G2's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Waits for the G2 change to the web app. Commit: · Evidence: · Defect: — |
| Executed By | |
| Date of Execution | |
