# A4-T14 — Signed in, each coordinator sees only their own events, an old link shows not found, and the Lead's navigation shows only the Lead's functions

## Specification

| Item | Content |
|---|---|
| Test Case ID | A4-T14 |
| Test Scenario | Signed in, each coordinator sees only their own events, an old link shows not found, and the Lead's navigation shows only the Lead's functions |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. As `organiser@connectsphere.test`: FX-SUBMITTED three times, with event names `A4 One`, `A4 Two` and `A4 Three`.<br>3. FX-ASSIGNED for `A4 One` to Coordinator One and for `A4 Two` to Coordinator Two; `A4 Three` stays unassigned. Note `A4 Two`'s id. |
| Test Steps | 1. Sign in as `coordinator@connectsphere.test`. Open "All events", then "Review queue".<br>2. In the address bar, go to `#/review/<A4 Two id>`.<br>3. Sign out. Sign in as `lead@connectsphere.test`. Read the navigation, then open the unassigned queue and the assignment overview.<br>4. Reassign `A4 One` to Coordinator Two. Sign out, sign in as `coordinator@connectsphere.test`, and reload "All events" and "Review queue". |
| Test Data | Accounts from `tests/README.md`, password `ConnectSphere-Test-1234!`. |
| Expected Result | Step 1: both screens show `A4 One` only. Step 2: the page shows "No event with that reference is assigned to you." and no detail of `A4 Two`. Step 3: the navigation offers the Lead's functions only (the unassigned queue, the assignment overview, and the screens every signed-in user has); it offers no "Review queue", no venue request and no equipment screen. The unassigned queue shows `A4 Three`; the overview shows `A4 One` with Coordinator One and `A4 Two` with Coordinator Two. Step 4: neither screen shows any of the three events. |
| Created By | Shawmya |
| Date of Creation | 2026-11-02 |

> **Expected results are checked by the story owner** against A4's acceptance criteria before the code
> is written (implementation.md §11.12).

## Execution record

| Item | Content |
|---|---|
| Actual Result | Coordinator One's All events and Review queue listed A4 One and neither A4 Two nor A4 Three; the old link to A4 Two showed `No event with that reference is assigned to you.` and none of its detail. The Lead's navigation offered Unassigned, Assignments, Notifications and API console only (no Review queue, venue or equipment screen); the unassigned queue showed A4 Three; the overview showed A4 One with Coordinator One and A4 Two with Coordinator Two. After reassigning A4 One to Coordinator Two (`Reassigned to Coordinator Two. They are now the event's coordinator.`), Coordinator One's reloaded All events and Review queue showed none of the three events. Run on CI's throwaway stack, with unique names in place of the card's literal names. `Only` is judged on the run's three events, since the shared database holds other events. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: ceb525b · Evidence: tests/e2e/u-safety-and-assignment.spec.ts › A4-T14 signed in, each coordinator sees only their own events, an old link shows not found, and the Lead sees the assignments, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41688315679 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
