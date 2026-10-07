# P2-T12 — Every non-Technical-Support role is refused an inventory change

## Specification

| Item | Content |
|---|---|
| Test Case ID | P2-T12 |
| Test Scenario | Inventory changes attempted by every other active role are refused and store nothing |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Complete P2-T1 and note the equipment type id from the final part of `#/equipment/<id>/edit`.<br>3. `P2 Wireless Microphone` has total quantity 20 and no unavailability entries. |
| Test Steps | For each of the four accounts in Test Data, separately:<br>1. Sign in and open "API console".<br>2. Send a `PUT` request to `/equipment/api/v1/equipment/types/<id>` with the exact JSON body from Test Data.<br>3. Record the response, sign out, and repeat for the next account.<br>4. After all four attempts, sign in as `techsupport@connectsphere.test`, open "Equipment", then open `P2 Wireless Microphone`.<br>5. In the SQL editor run: `select count(*) from equipment.inventory_history where equipment_type_id = '<id>' and actor_user_id in ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000005');` |
| Test Data | Accounts (password for each: `ConnectSphere-Test-1234!`): `organiser@connectsphere.test`, `coordinator@connectsphere.test`, `venuestaff@connectsphere.test`, `attendee@connectsphere.test`.<br>Request body: `{"name":"P2 Unauthorized Rename","description":"Unauthorized change","characteristics":{"Frequency band":"534–598 MHz"},"kind":"BULK","totalQuantity":19,"unitLabels":[]}` |
| Expected Result | Every PUT is refused with HTTP 403 and a message that only Technical Support Staff can change inventory. After all attempts, the type is still named `P2 Wireless Microphone`, its description and technical characteristics are unchanged, its total quantity is still 20, and no new inventory-history record exists for any of the four users. |
| Created By | Yichen, via Codex |
| Date of Creation | 2026-10-07 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: — · Evidence: — · Defect: — · Story: P2, Sprint 2 |
| Executed By | |
| Date of Execution | |
