# L6-T12 — Venue Staff change the expiry on screen and the coordinator is told

## Specification

| Item | Content |
|---|---|
| Test Case ID | L6-T12 |
| Test Scenario | End-to-end in the browser: Venue Staff change a held hold's expiry, an expired hold shows no actions, and the coordinator's notices name the hold |
| Pre-conditions | 1. Standard environment running (`npm run dev` starts the services, the web app and the Temporal worker), `.env` has the `KAFKA_*` settings, Temporal is running, test data reset (`tests/README.md`); migrations applied, including `venue/0013` (`npm run migrate -- venue`).<br>2. FX-BOOKING completed (`tests/L1/README.md`) and L3-T5 done: a Held hold HLD-A at `Lee Kong Chian Auditorium` for 2 December 2026, 14:00-18:00. Note the assigned coordinator. Its reminder lead is 60 minutes.<br>3. A second Held hold HLD-B, placed as in L3-T5 with expiry two minutes from now, to watch an expiry happen. |
| Test Steps | 1. Sign in as `venuestaff@connectsphere.test`, open "Hold requests", scroll to its "Placed holds" section (held and expired holds at the venues the account looks after) and find HLD-A. Click "Change expiry".<br>2. Enter an expiry in the past and click "Save".<br>3. Clear the field and click "Save".<br>4. Enter 1 December 2026, 20:00 and click "Save".<br>5. Wait until HLD-B's expiry has passed, plus one minute, and refresh "Hold requests" and look in its "Placed holds" section.<br>6. Sign out, sign in as the assigned coordinator, open "Notifications", then the event's "Venue requests". |
| Test Data | Account: `venuestaff@connectsphere.test` / `ConnectSphere-Test-1234!` · assigned coordinator `coordinator@connectsphere.test` or `coordinator2@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | Step 2 refuses inline with "The expiry must be later than now." and keeps the old expiry. Step 3 refuses inline with "Enter the expiry date and time.". Step 4 saves and the list shows HLD-A expiring Tuesday 1 December 2026, 20:00, still Held. In step 5 HLD-B shows "Expired on <date and time>" with no Convert or Release action. In step 6 the coordinator has a notification for HLD-B naming `Lee Kong Chian Auditorium`, 2 December 2026 14:00-18:00, the event reference and the expiry time, and the Holds table shows HLD-B Expired. No reminder notice is created for HLD-A while the new expiry is more than 60 minutes away. |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-21 |

> **Expected results are checked by the PR reviewer** against L6's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Waits for the L6 implementation and migration venue/0013 on the shared database, applied after the L6 PR merges (`npm run migrate -- venue`). Commit: · Evidence: · Defect: — |
| Executed By | |
| Date of Execution | |
