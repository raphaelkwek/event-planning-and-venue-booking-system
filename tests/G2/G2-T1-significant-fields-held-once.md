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
| Created By | Raphael |
| Date of Creation | 2026-10-29 |

> **Expected results are checked by the PR reviewer** against G2's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | The test passed. The contracts' SIGNIFICANT_EVENT_FIELDS were exactly proposedStartAt, proposedEndAt, expectedAttendance, venueRequirements, equipmentRequired, equipmentRequirements; the web app's SIGNIFICANT_FIELD_LABELS (frontend/src/shared/changeRequests.ts) was the very object @connectsphere/contracts exports, with exactly those keys in that order; and no .ts or .tsx file under frontend/src contained all six names as quoted strings. Step 2, read by the test from the two files' import statements: frontend/src/shared/changeRequests.ts takes SIGNIFICANT_FIELD_LABELS and the field type SignificantEventField from @connectsphere/contracts, and frontend/src/api/changeRequests.ts takes SignificantEventField from @connectsphere/contracts; neither takes the list, its labels or the field type from anywhere else (the shared file no longer takes the type from the api file's SignificantField alias, changed in this run). |
| Status | Pass |
| Remarks | Automated (unit test) · Commit: 5bfb25e · Evidence: `frontend/tests/significantFields.test.ts` › significant fields (G2 AC1) › G2-T1 the screens take the significant fields and their labels from the contracts list, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41801285931 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
