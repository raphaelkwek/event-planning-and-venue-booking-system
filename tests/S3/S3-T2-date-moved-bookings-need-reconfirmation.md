# S3-T2 — A moved date sets each booking to Requires Reconfirmation and keeps its period

## Specification

| Item | Content |
|---|---|
| Test Case ID | S3-T2 |
| Test Scenario | After a date change B1 and B2 are `REQUIRES_RECONFIRMATION`, still CONFIRMED, with the same period; the venue is not released |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `venue/0019` and `equipment/0009`), using the isolated setup in `tests/S3/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-S3 from `tests/S3/README.md` is loaded. Specific set-up: CR proposes `proposedStartAt` `D 15:00` (event E moves from `D 14:00`–`D 18:00` to `D 15:00`–`D 18:00`), nothing else. |
| Test Steps | 1. As C, send `POST /api/v1/change-requests/<CR>/decision` with `{"decision":"APPROVE"}`.<br>2. As C, send `GET /api/v1/events/<E>/arrangement-flags`.<br>3. Read B1 and B2 through the venue module's booking read (or the repository) for their status and period.<br>4. Run `npm test -w @connectsphere/planning-core -- tests/change/api/s3Cards.test.ts -t 'S3-T2 '` (or the whole suite) and read the named `S3-T2 ` result. |
| Test Data | `{"decision":"APPROVE"}`; CR proposes `proposedStartAt` `D 15:00` (event E moves from `D 14:00`–`D 18:00` to `D 15:00`–`D 18:00`), nothing else. |
| Expected Result | Step 1 answers HTTP 200 with `impact.flags` naming B1 and B2, each with flag `REQUIRES_RECONFIRMATION`. Step 2 answers HTTP 200 with exactly two booking flags (B1, B2), each `REQUIRES_RECONFIRMATION` with the reason `The booking is for <old period>, but the event is now <new period>.`. Both periods are written in Singapore time, where the venues are, as the implementation's `formatPeriod` does: for example `D 14:00`–`D 18:00` UTC on 2 December 2026 reads `Wednesday 2 December 2026 22:00 to Thursday 3 December 2026 02:00`, and `D 15:00`–`D 18:00` reads `Wednesday 2 December 2026 23:00 to Thursday 3 December 2026 02:00`. R1's flag is also listed (S3-T3). In step 3, B1 and B2 are still CONFIRMED, their period is still `D 14:00`–`D 18:00` (not moved), and the booking still exists as CONFIRMED, so the period stays occupied at V1 and V2 (nothing released). |
| Created By | Raphael |
| Date of Creation | 2026-10-28 |

> **Expected results are checked by the PR reviewer** against S3's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | The approval answered 200 and the booking entries of `impact.flags` were exactly B1 and B2, each `REQUIRES_RECONFIRMATION` with its reference, venue name and the reason `The booking is for <old period>, but the event is now <new period>.` (periods as `formatPeriod` writes them). `GET .../arrangement-flags` answered 200 with exactly those two booking flags, and R1's flag too (`FLAGGED_FOR_REVIEW`, `The reservation is for <old period>, but the event is now <new period>.`). B1 and B2 were still `CONFIRMED` for `D 14:00`–`D 18:00`, with S3's period flag set. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: a406635 · Evidence: `backend/services/planning-core/tests/change/api/s3Cards.test.ts` › S3 cards: reconsidering the arrangements an approved change affects › S3-T2 a moved date sets both bookings to Requires Reconfirmation and keeps their period, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41773031885 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
