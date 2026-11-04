# EN-11-T4 — A restarted worker re-creates every lost completion and hold-expiry timer

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-11-T4 |
| Test Scenario | A restarted worker re-creates every lost completion and hold-expiry timer |
| Pre-conditions | 1. Dependencies installed; a machine permitted to launch the Temporal time-skipping test server (CI's unit job). Run from `backend/services/planning-core`.<br>2. The Temporal server has no workflow for the events and holds below, as after a redeploy that lost Temporal's state (4 Nov 2026, staging). |
| Test Steps | 1. Run `npx --no-install vitest run --config vitest.unit.config.ts tests/temporal/reconcileTimers.unit.test.ts tests/temporal/reconcileTimersServer.unit.test.ts`.<br>2. In the server tests, give the reconcile one Confirmed event whose end passed while the worker was down, one Confirmed event ending in 3 hours, one Held hold whose expiry passed, and one Held hold expiring in 2 hours with a 60-minute reminder lead.<br>3. Run the reconcile a second time, as the next worker restart would.<br>4. In the unit tests, make one item's scheduling fail, then make each listing fail.<br>5. Run CI's integration job, which lists the events awaiting completion from the throwaway Postgres (`tests/event/jobs/awaitingCompletion.test.ts`). |
| Test Data | Fresh random event and hold ids; fake completion, reminder and expiry activities that record the server's clock; 2-hour and 3-hour virtual deadlines; seeded events dated 2001 in the integration run. No live application data. |
| Expected Result | 1. The overdue event is completed and the overdue hold expired at once, with no reminder for a hold already past its expiry.<br>2. The event ending in 3 hours is completed only at its end; the hold is reminded at its expiry minus 60 minutes and expired at its expiry.<br>3. The workflow ids are the consumers' (`complete-event-<id>`, `hold-expiry-<id>`), and the second reconcile reaches the same runs: no second workflow, no second completion.<br>4. A failure scheduling one item does not stop the others and is logged with its id; a failure listing the events or the holds is logged, the other list is still reconciled, and the reconcile never throws.<br>5. The listing holds every Confirmed event that has an end, with that end, and no event in another status. |
| Created By | Joash |
| Date of Creation | 2026-11-04 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: — |
| Executed By | |
| Date of Execution | |
