# G1-T10 — Boundary: when one field is invalid the whole save fails, and no field and no history entry is changed

## Specification

| Item | Content |
|---|---|
| Test Case ID | G1-T10 |
| Test Scenario | Boundary: when one field is invalid the whole save fails, and no field and no history entry is changed |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-APPROVED completed. Note its id.<br>3. Signed in as `organiser@connectsphere.test`, on the request's "Edit details" screen. |
| Test Steps | 1. Change Description to `A new description`, clear Purpose so it holds only spaces, and click "Save details".<br>2. Set Purpose to `X` (one character) and click "Save details".<br>3. In the SQL editor, list the event's field-change history. |
| Test Data | Account: `organiser@connectsphere.test` |
| Expected Result | Step 1 shows, under Purpose, that a purpose is required, and nothing is saved: the request still shows its old description, and there is no history yet. Step 2 saves, with "Details saved.". The history then holds exactly two entries, `description` and `purpose`, both from step 2. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-11 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | With Purpose blank, "Purpose is required." appeared under Purpose, the stored description was unchanged and there was no history. With Purpose "X", the save succeeded, and the history then held exactly two entries: description and purpose. |
| Status | Pass |
| Remarks | Commit: c1aa0cb · Evidence: tests/G1/evidence/G1-T10.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-10 |
