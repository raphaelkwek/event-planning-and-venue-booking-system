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

> **Run note, 2026-11-04.** Two deviations, both forced. HLD-B cannot be a second hold at HLD-A's venue for the
> same period (an event holds a venue once, L3 and CR-03, and a period is held once), so it is the same event's hold of
> its other FX-BOOKING venue, Seminar Room 2-1, for the same period, and step 6's notice names that venue. CI's stack runs
> no Temporal worker, so HLD-B is placed expiring 40 seconds ahead and, once that has passed, expired by
> `npm run jobs:expire-holds`, the sweep implementation.md §4 names for when the HoldExpiry workflow is not running
> (it runs the workflow's own step, so the records and the `venue-booking.hold-expired` message are the same).

## Execution record

| Item | Content |
|---|---|
| Actual Result | Ran in the browser on CI's throwaway stack, with the cards' 2 December 2026 moved to Tuesday 2 March 2027 (so HLD-A's new expiry was Monday 1 March 2027, 20:00) and unique names. HLD-A was placed as L3-T5 does, expiring 1 March 18:00 with a 60-minute reminder lead. HLD-B could not share HLD-A's venue (an event holds a venue once, L3/CR-03, and a period is held once), so it was the same event's hold of its other FX-BOOKING venue, Seminar Room 2-1, same period, expiring 40 seconds after it was placed. Venue Staff opened Hold requests, found HLD-A under "Placed holds" and clicked "Change expiry". An expiry in the past was refused inline with "The expiry must be later than now." and the old expiry stayed; empty fields were refused inline with "Enter the expiry date and time."; 1 March 2027 20:00 saved with "HLD-… now expires on Monday 1 March 2027, 20:00.", the row showing "Monday 1 March 2027, 20:00" and still offering "Change expiry" (Held, as the API confirmed). Once HLD-B's expiry had passed, the `npm run jobs:expire-holds` sweep (the fallback for the HoldExpiry workflow, which CI's stack does not run) expired it; on refresh its row read "Expired on <date and time>" with no action. The messages were delivered by the test harness in place of Kafka: one venue-booking.hold-expired notice was stored, there was no venue-booking.hold-expiring message, and HLD-A's reminded_at stayed empty. The coordinator's Notifications read "Hold HLD-… on Seminar Room 2-1 … for EVT-… “…”, Tuesday 2 March 2027, 14:00–18:00, expired on <expiry time>. The period is free for others." (naming HLD-B's own venue, the period, the event reference and the expiry time), with no reminder for HLD-A, and the event's Holds table showed HLD-B Expired ("Expired on …", no Convert or Release) and HLD-A Held until Monday 1 March 2027, 20:00. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: 5bfb25e · Evidence: tests/e2e/l-bookings.spec.ts › L6-T12 Venue Staff change a hold's expiry on screen, an expired hold shows no actions, and the coordinator's notices name the hold, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41801285931 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
