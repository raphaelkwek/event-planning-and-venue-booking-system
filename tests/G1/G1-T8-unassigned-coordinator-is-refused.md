# G1-T8 — A coordinator who isn't assigned to the event can't edit it, and nothing is stored

## Specification

| Item | Content |
|---|---|
| Test Case ID | G1-T8 |
| Test Scenario | A coordinator who isn't assigned to the event can't edit it, and nothing is stored |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-APPROVED completed. Note its id, and which coordinator its "Assigned coordinator" field names.<br>3. Signed in as the *other* seeded coordinator. |
| Test Steps | 1. Look for the request in "All events".<br>2. Open the API console and send `PATCH /event/api/v1/events/<id>` with body `{"purpose": "Not mine to change"}`.<br>3. In the SQL editor, read its purpose and count its field-change history. |
| Test Data | Account: whichever of `coordinator@connectsphere.test` / `coordinator2@connectsphere.test` is not assigned |
| Expected Result | The request is not listed. The API returns `404` with code `EVENT_NOT_FOUND` and "No event with that reference is assigned to you.". The purpose is still `Share faculty research`, with no field-change history. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-11 |

> **Revised for A4 (CR-05) on 2 Nov 2026.** A coordinator who isn't assigned no longer sees the event, and the API answers 404 as for an unknown event.

## Execution record

| Item | Content |
|---|---|
| Actual Result | The event was not in the unassigned coordinator's All events; the console PATCH returned 404 EVENT_NOT_FOUND with `No event with that reference is assigned to you.`; SQL showed the purpose unchanged and no field-change history. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: ceb525b · Evidence: tests/e2e/e-access-and-console.spec.ts › G1-T8 a coordinator who isn't assigned to the event can't edit it, and nothing is stored, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41688315679 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
