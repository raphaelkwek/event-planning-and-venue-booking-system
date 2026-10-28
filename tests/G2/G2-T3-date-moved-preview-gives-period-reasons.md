# G2-T3 — A moved date previews Requires Reconfirmation and Flagged for review, with the period reasons

## Specification

| Item | Content |
|---|---|
| Test Case ID | G2-T3 |
| Test Scenario | Previewing a pending date change names B1 and B2 `REQUIRES_RECONFIRMATION` and R1 `FLAGGED_FOR_REVIEW`, each with the reason S3 would record |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `venue/0018` and `equipment/0009`), using the isolated setup in `tests/G2/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-G2 from `tests/G2/README.md` is loaded. Specific set-up: CR proposes `proposedStartAt` `D 15:00` (event E would move from `D 14:00`–`D 18:00` to `D 15:00`–`D 18:00`), nothing else. |
| Test Steps | 1. As C, send `GET /api/v1/change-requests/<CR>/impact`.<br>2. Read `impact.flags`.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/change/api/g2Cards.test.ts -t 'G2-T3 '` (or the whole suite) and read the named `G2-T3 ` result. |
| Test Data | CR proposes `proposedStartAt` `D 15:00`, nothing else. |
| Expected Result | HTTP 200. `impact.flags` has exactly three entries: B1 (`arrangement` `BOOKING`, its reference, name `Venue One`) and B2 (`BOOKING`, its reference, `Venue Two`), each with flag `REQUIRES_RECONFIRMATION` and the reason `The booking is for <old period>, but the event is now <new period>.`; and R1 (`arrangement` `EQUIPMENT`, its id as reference, its equipment name) with flag `FLAGGED_FOR_REVIEW` and the reason `The reservation is for <old period>, but the event is now <new period>.` Both periods are written in Singapore time, as the implementation's `formatPeriod` does: for example `D 14:00`–`D 18:00` UTC on 2 December 2026 reads `Wednesday 2 December 2026 22:00 to Thursday 3 December 2026 02:00`, and `D 15:00`–`D 18:00` reads `Wednesday 2 December 2026 23:00 to Thursday 3 December 2026 02:00`. No `UNSUITABLE` flag, since attendance did not change. |
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
