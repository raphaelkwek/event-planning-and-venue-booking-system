# R7-T13 — Boundary: an email with no attendee account is refused, and the reason may be up to 500 characters

## Specification

| Item | Content |
|---|---|
| Test Case ID | R7-T13 |
| Test Scenario | Boundary: an email with no attendee account is refused, and the reason may be up to 500 characters |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it). The R fixtures are in `tests/R1/README.md` and `tests/R5/README.md`.<br>2. FX-R-EVENT with its defaults, then FX-R-MANAGED.<br>3. Signed in as `organiser@connectsphere.test` / `ConnectSphere-Test-1234!`. |
| Test Steps | 1. Add `nobody@connectsphere.test`.<br>2. Add `organiser2@connectsphere.test` (staff, not an attendee).<br>3. Add Attendee One with a 501-character reason.<br>4. Add Attendee One with a 500-character reason. |
| Test Data | As listed |
| Expected Result | Steps 1 and 2: 422 `ATTENDEE_NOT_FOUND`, nothing stored. Step 3: 400 `VALIDATION_FAILED` naming `reason`. Step 4: added, with the whole reason. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | `nobody@connectsphere.test` and `organiser2@connectsphere.test` were each refused with 422 `ATTENDEE_NOT_FOUND` and `No attendee account has the email …, so nobody was added.` in the dialog, with nothing stored. The form takes at most 500 characters, so the 501-character reason was sent from the API console: 400 `VALIDATION_FAILED` naming `reason`, nothing stored. A 500-character reason was added (201) and stored and shown whole. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: 5eb3bfd · Evidence: tests/e2e/r-management.spec.ts › R7-T13 boundary: an unknown attendee, a staff account, and the reason's length, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41767254259 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
