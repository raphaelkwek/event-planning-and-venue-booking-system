# S3-T13 — The coordinator approves a change and sees the impact and the flags on screen

## Specification

| Item | Content |
|---|---|
| Test Case ID | S3-T13 |
| Test Scenario | End-to-end in the browser: approve a significant change, see the impact list, see the outstanding flags as each of the three roles, and be refused confirmation |
| Pre-conditions | 1. Standard environment running, `.env` has the `KAFKA_*` settings, and test data reset (`tests/README.md`); migrations applied, including `venue/0019` and `equipment/0009` (`npm run migrate -- venue`, `npm run migrate -- equipment`).<br>2. FX-S3 as the browser-level statement in `tests/S3/README.md`: an Approved request of `organiser@connectsphere.test` brought to Planning with two confirmed bookings (Theatre 100 and Hall 200) and an equipment reservation by `techsupport@connectsphere.test`, all for the event's period, and a pending change request raised as in S1-T13 that moves the start time and raises attendance to 150. |
| Test Steps | 1. Sign in as the assigned coordinator, open the change request's review page, click "Approve change", then "Confirm approval".<br>2. Read the impact list that appears.<br>3. Open the event page and read the "Outstanding flags" panel.<br>4. Try to confirm the event (F5).<br>5. Sign out and sign in as `organiser@connectsphere.test`, and open the event page. Then sign in as `coordinator2@connectsphere.test`, an Event Coordinator the event is not assigned to, and open the event's review address.<br>6. Sign in as `organiser2@connectsphere.test` and open the event's address.<br>7. Sign in as `venuestaff@connectsphere.test`, then as `techsupport@connectsphere.test`, and open "Notifications" in each. |
| Test Data | As in the steps. |
| Expected Result | Step 1 applies the change. Step 2 lists both bookings, the reservation and "0 active registrations", saying which were flagged: both bookings "Requires Reconfirmation", the theatre booking also "Unsuitable" (`Expected attendance is now 150, but <venue> holds 100 in the Theatre layout.`), the reservation "Flagged for review". Step 3 shows the "Outstanding flags" panel with the same flags and reasons. Step 4 is refused and names every flag. Step 5 shows the panel to the organiser; `coordinator2@connectsphere.test` is refused with "No event with that reference is assigned to you." and sees no event and no flags (the flags read answers 404). Step 6 shows no event (not found) and no flags. Step 7 shows a notice for Venue Staff for each booking and for Technical Support for the reservation. |
| Created By | Raphael |
| Date of Creation | 2026-10-28 |

> **Expected results are checked by the PR reviewer** against S3's acceptance criteria.

> **Revised 2026-11-04.** Step 5 expected the Outstanding flags panel to show to an Event Coordinator
> the event is not assigned to, as S3's AC8 ("the owning organiser, the assigned coordinator, and
> Event Coordinators") can be read. Joash decided on 4 Nov 2026 to read AC8 as **the assigned Event
> Coordinator**, consistent with A4 and CR-05 and the Week 9 answer W9-35 ("Coordinators only manage
> events assigned to them by the Lead"): decision D-03 in `documentation/clarifications.md`. Step 5
> now expects the other coordinator to be refused, as S3-T8 does at API level. CQ-11 (SPM-197) is
> still open with the customer; if the answer lets coordinators view other events read-only, step 5
> changes back. Step 5 also no longer opens Notifications, since the expected result never said what
> the organiser should find there (S3 notifies Venue Staff, Technical Support and attendees, step 7).

## Execution record

| Item | Content |
|---|---|
| Actual Result | Steps 1 to 6 held. Coordinator One approved the change (`Change approved on <date>`); `Affected arrangements` listed both bookings, the reservation and `Registrations: 0`: both bookings `Requires reconfirmation` with `The booking is for Tuesday 2 March 2027, 14:00–18:00, but the event is now Tuesday 2 March 2027, 15:00–18:00.`, the Theatre booking also `Unsuitable` with `Expected attendance is now 150, but <venue> holds 100 in the Theatre layout.`, the reservation `Flagged for review` with its reason. The event page's Outstanding flags panel listed the same four flags and reasons. Confirm arrangements was refused with `ARRANGEMENTS_NOT_READY`, naming `<theatre booking> at <venue>: requires reconfirmation.`, `… flagged unsuitable.`, `<hall booking> at <venue>: requires reconfirmation.` and `<chairs> × 4: flagged for review.`; the event stayed Planning. The organiser's request page showed the same panel. Coordinator Two, not assigned to the event, was refused with `No event with that reference is assigned to you.` and shown no event and no flags (the flags read answered 404). Organiser Two saw no event and no flags (404). Step 7 failed: the approval's `change-request.arrangements-flagged` message, handed to the notification service by the test harness in place of Kafka, was not stored but retried, with the error `duplicate key value violates unique constraint "notifications_source_message_id_recipient_user_id_key"`, so Venue Staff One and Tech Support One received no notice. Run on CI's throwaway stack, with unique names in place of the card's literal names; the screen words the registration count `Registrations: 0` where the card says `0 active registrations`. |
| Status | Fail |
| Remarks | Automated (browser, Playwright) · Commit: c0f7183 · Evidence: tests/e2e/q-equipment-and-changes.spec.ts › S3-T13 the coordinator approves a change and sees what it flagged; confirming is refused; the owner sees the flags, nobody else does, and the staff are told (marked as an expected failure so CI stays green), CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41798410254 · Defect: The notification service cannot store an S3 flag message that tells one person more than once. S3's rule writes one notice per flag (`recipients.ts`, arrangementsFlagged; the theatre booking carries two flags, and one Venue Staff member looks after both venues), but `notification.notifications` is unique on (source_message_id, recipient_user_id) (notification migration 0001), so the insert fails (the run shows `duplicate key value violates unique constraint "notifications_source_message_id_recipient_user_id_key"`), the message is retried and then dead-lettered, and no one is told. Steps 1 to 6 (including AC8, read as the assigned coordinator, D-03) pass. Not fixed in this pull request (test evidence only); a fix is to write one notice per recipient naming each flagged arrangement. |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
