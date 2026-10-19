# P2-T11 — Inventory and unavailability changes record complete audit quantities

## Specification

| Item | Content |
|---|---|
| Test Case ID | P2-T11 |
| Test Scenario | Creating and updating inventory and recording unavailability each capture the actor, time, previous quantity, and new quantity |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed in as `techsupport@connectsphere.test`.<br>3. The reset has removed equipment previously created by this seeded account, so no equipment type named `P2 Audit Speaker` exists. |
| Test Steps | 1. Click "Equipment", then "New equipment type". Create the equipment type from Test Data with total quantity 20 and note its id from `#/equipment/<id>/edit`.<br>2. Change Total quantity held to `24` and click "Save equipment type".<br>3. Under "Mark units unavailable", enter the unavailability data and click "Mark unavailable".<br>4. In the SQL editor run: `select action, previous_quantity, new_quantity, actor_user_id, actor_role, occurred_at from equipment.inventory_history where equipment_type_id = '<id>' order by occurred_at, id;` |
| Test Data | Equipment type: Name `P2 Audit Speaker`; Description `Portable powered speaker`; Technical characteristic `Power` = `500 W`; Tracking method `Bulk quantity`; Initial total `20`; Updated total `24`.<br>Unavailability: Quantity `3`; Start `2026-12-20 09:00 Asia/Singapore`; End `2026-12-20 17:00 Asia/Singapore`; Reason `Amplifier inspection`.<br>Expected actor id: `00000000-0000-0000-0000-000000000004`; role: `TECH_SUPPORT_STAFF`. |
| Expected Result | Exactly three history rows exist in order. `TYPE_CREATED` records quantity 0 → 20; `TYPE_UPDATED` records 20 → 24; `UNAVAILABILITY_RECORDED` records unavailable quantity 0 → 3. Every row has actor id `00000000-0000-0000-0000-000000000004`, role `TECH_SUPPORT_STAFF`, and a non-null timestamp no earlier than step 1 and no later than the SQL query. |
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
