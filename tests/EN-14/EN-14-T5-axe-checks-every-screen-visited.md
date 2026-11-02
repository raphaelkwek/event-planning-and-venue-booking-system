# EN-14-T5 — axe checks every screen a journey visits, and serious or critical violations fail the test

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-14-T5 |
| Test Scenario | axe checks every screen a journey visits, and serious or critical violations fail the test |
| Pre-conditions | CI's `e2e` job has run. |
| Test Steps | 1. Open the job summary's "Accessibility" table.<br>2. Open `tests/test-results/axe-findings/` in the `playwright-test-results` artifact.<br>3. Read `documentation/evidence/EN-14/axe-findings.md`. |
| Test Data | WCAG 2.1 A and AA rules (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`). |
| Expected Result | Each journey calls the axe check on every screen it opens. Any violation is recorded with its rule, impact, screen and elements. A serious or critical one fails the test, and no rule is switched off. Each real violation found is listed in `axe-findings.md`, fixed or with the reason it is not. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | axe ran on every screen of the 101 test runs and reported no violation in this run, after the fixes listed in documentation/evidence/EN-14/axe-findings.md; earlier runs of the same journeys failed on each of those violations until fixed. No rule is switched off. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6080462 · Evidence: tests/e2e/support/fixtures.ts › checkAccessibility (every journey) › a11y(...) on every screen visited, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
