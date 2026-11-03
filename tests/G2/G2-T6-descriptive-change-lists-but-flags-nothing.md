# G2-T6 — A descriptive-only change lists the arrangements and previews no flag

## Specification

| Item | Content |
|---|---|
| Test Case ID | G2-T6 |
| Test Scenario | Previewing a change to the venue requirements text lists B1, B2 and R1 and names no flag |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `venue/0019` and `equipment/0009`), using the isolated setup in `tests/G2/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-G2 from `tests/G2/README.md` is loaded. Specific set-up: CR proposes only `venueRequirements` `{"notes":"Stage with a lectern"}`; start, end and attendance are unchanged. |
| Test Steps | 1. As C, send `GET /api/v1/change-requests/<CR>/impact`.<br>2. Read `impact`.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/change/api/g2Cards.test.ts -t 'G2-T6 '` (or the whole suite) and read the named `G2-T6 ` result. |
| Test Data | CR proposes only `venueRequirements` `{"notes":"Stage with a lectern"}`. |
| Expected Result | HTTP 200: `impact.bookings` lists B1 and B2, `impact.reservations` lists R1, `impact.activeRegistrations` is 0 and `impact.flags` is empty. Free-text venue and equipment requirements are listed but never flagged automatically (as S3-T12); the coordinator judges them. |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-29 |

> **Expected results are checked by the PR reviewer** against G2's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Waits for the G2 implementation. Commit: · Evidence: · Defect: — |
| Executed By | |
| Date of Execution | |
