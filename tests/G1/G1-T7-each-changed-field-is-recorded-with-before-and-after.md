# G1-T7 — Each saved edit records the editing user, the timestamp, and the before and after value of each changed field, and nothing for unchanged fields

## Specification

| Item | Content |
|---|---|
| Test Case ID | G1-T7 |
| Test Scenario | Each saved edit records the editing user, the timestamp, and the before and after value of each changed field, and nothing for unchanged fields |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-APPROVED completed. Note its id.<br>3. Signed in as `organiser@connectsphere.test`. |
| Test Steps | 1. Open the request, click "Edit details", change Purpose and Contact details to the values in Test Data, leave Description and Accessibility notes as they are, and click "Save details".<br>2. In the SQL editor, run `select field_name, previous_value, new_value, actor_user_id, actor_role, triggering_action, occurred_at from event.event_history where event_id = '<id>' and entry_type = 'FIELD_CHANGE' order by field_name;`. |
| Test Data | Account: `organiser@connectsphere.test` (user id `00000000-0000-0000-0000-000000000001`) · Purpose `Share faculty research with industry partners` · Contact details `Dr Mei Lin Tan, meilin.tan@smu.edu.sg` |
| Expected Result | Exactly two rows. `contactDetails`: previous value empty, new value `Dr Mei Lin Tan, meilin.tan@smu.edu.sg`. `purpose`: previous `Share faculty research`, new `Share faculty research with industry partners`. Both name actor `00000000-0000-0000-0000-000000000001`, role `EVENT_ORGANISER`, action `UPDATE_DETAILS`, and the time of the save. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-11 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Exactly two rows: contactDetails from empty to "Dr Mei Lin Tan, meilin.tan@smu.edu.sg"; purpose from "Share faculty research" to "Share faculty research with industry partners". Both by 00000000-0000-0000-0000-000000000001 (EVENT_ORGANISER), action UPDATE_DETAILS, at 2026-10-10T16:30:22.626Z, the time of the save. |
| Status | Pass |
| Remarks | Commit: c1aa0cb · Evidence: tests/G1/evidence/G1-T7.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-10 |
