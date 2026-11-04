# Q2-T13 — Technical Support releases on screen and the coordinator removes a Reserved line

## Specification

| Item | Content |
|---|---|
| Test Case ID | Q2-T13 |
| Test Scenario | End-to-end in the browser: the Release form, the reason check, the Remove dialog and the coordinator's notifications |
| Pre-conditions | 1. Standard environment running, `.env` has the `KAFKA_*` settings, and test data reset (`tests/README.md`); migrations applied.<br>2. A Reserved chairs line left by Q1-T14's walkthrough (or reserve one the same way), with its assigned coordinator noted. |
| Test Steps | 1. Sign in as `techsupport@connectsphere.test` and open "Equipment requests".<br>2. Click "Release" on the Reserved chairs line.<br>3. Leave Reason empty and click "Release reservation".<br>4. Enter `Event moved` as the reason and click "Release reservation".<br>5. Reserve the same line again.<br>6. Sign out, sign in as the assigned coordinator, and open the event's equipment request.<br>7. Click "Remove" on the Reserved line and confirm.<br>8. Open "Notifications". |
| Test Data | As in the steps. |
| Expected Result | Step 3 shows a reason-required message inline and the line stays Reserved. Step 4 succeeds with the banner "Equipment released", and the row shows Confirmed with Reserve available again. In step 7 the Remove dialog warns that the equipment will be released, and afterwards the line is Removed. The coordinator has notifications naming the event and "released". |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-16 |

> **Expected results are checked by the PR reviewer** against Q2's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | Ran in the browser on CI's throwaway stack, with unique names, from a Reserved chairs line (40 of 40). Technical Support opened Equipment requests and clicked Release; with Reason empty, "Release reservation" showed "Give a reason for releasing the reservation." inline and the line stayed Reserved. With "Event moved" it showed the banner "Equipment released" ("Released <chairs> for EVT-…: Event moved.") and the row Confirmed with Reserve offered again. Reserving again showed "Reserved 40 of 40 for EVT-….". The coordinator opened the event's equipment request and clicked Remove on the Reserved line: the dialog read "<chairs> × 40 will be marked Removed and no longer listed. … Its reserved equipment will be released."; after "Remove line" the line was no longer listed and was Removed through the API. The line's five messages were delivered by the test harness in place of Kafka and stored, and the coordinator's Notifications read "The reservation of <chairs> × 40 for EVT-… “…” was released. The line is now Confirmed. Reason: Event moved" and "The reservation of <chairs> × 40 for EVT-… “…” was released. The line is now Removed. Reason: Request line removed", each naming the event and "released". |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: c0f7183 · Evidence: tests/e2e/o-equipment.spec.ts › Q2-T13 technical support release once a reason is given and reserve again, the coordinator removes the Reserved line, and each release is told, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41798410254 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
