# R7-T10 — Negative: adding an attendee who already holds an active registration is refused, naming it

## Specification

| Item | Content |
|---|---|
| Test Case ID | R7-T10 |
| Test Scenario | Negative: adding an attendee who already holds an active registration is refused, naming it |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it). The R fixtures are in `tests/R1/README.md` and `tests/R5/README.md`.<br>2. FX-R-EVENT with its defaults, then FX-R-MANAGED; Attendee One registers (R2-T1).<br>3. Signed in as `organiser@connectsphere.test` / `ConnectSphere-Test-1234!`. |
| Test Steps | 1. Add Attendee One as in R7-T1 steps 1–3. |
| Test Data | Attendee One's registration REG-… |
| Expected Result | 409 `REGISTRATION_DUPLICATE`, naming Attendee One's registration `REG-…`. Still one registration. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | With Attendee One already registered, confirming the addition answered 409 `REGISTRATION_DUPLICATE` with a message naming Attendee One's `REG-…` reference, which the dialog showed; still one registration for Attendee One. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: 5eb3bfd · Evidence: tests/e2e/r-management.spec.ts › R7-T10 a duplicate addition is refused, naming the existing registration, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41767254259 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
