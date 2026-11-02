# O1-T26 — The coordinator records, edits and removes lines on screen

## Specification

| Item | Content |
|---|---|
| Test Case ID | O1-T26 |
| Test Scenario | End-to-end in the browser: the coordinator opens the equipment request for an event, saves lines, edits one and removes one |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-APPROVED for `Annual Research Symposium` (2 December 2026, 14:00–18:00); note the assigned coordinator.<br>3. Sign in as `techsupport@connectsphere.test`, open "Equipment" and create bulk types `O1 Folding Chairs` (total 50) and `O1 Projectors` (total 5), as in P2-T1. |
| Test Steps | 1. Sign in as the assigned coordinator and open the request from "All events", then "Equipment request".<br>2. Check the new line's Required from and Required to read 2 Dec 2026 14:00 and 18:00.<br>3. Choose `O1 Folding Chairs`, quantity `40`, notes `Set out in rows of 10`, then "Add another line" and enter `O1 Projectors`, quantity `0`; click "Save request".<br>4. Change the projector quantity to `2` and click "Save request".<br>5. Click "Edit" on the chairs line, change quantity to `45`, "Save changes".<br>6. Click "Remove" on the projectors line and confirm.<br>7. Sign out, sign in as `techsupport@connectsphere.test`, open "Equipment requests". |
| Test Data | As in the steps. |
| Expected Result | Step 3 shows a refusal naming the quantity and saves neither line. Step 4 saves both, each with a Submitted lozenge. After step 5 the chairs line shows 45. After step 6 the projectors line is no longer listed. Technical Support sees the chairs line as Submitted with the event reference. |
| Created By | Joash, via Claude |
| Date of Creation | 2026-10-10 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | All seven steps through the UI: lines saved, the invalid quantity refused on its field, one edited, one removed, and Technical Support saw the remaining lines. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6080462 · Evidence: tests/e2e/o-equipment.spec.ts › O1-T26 the coordinator saves lines, edits one and removes one, and technical support see the rest, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
