# L6-T3 — An expired hold cannot be converted or released and F5 does not count it

## Specification

| Item | Content |
|---|---|
| Test Case ID | L6-T3 |
| Test Scenario | An Expired hold is not a booking: converting and releasing are refused with 409 and event E1's readiness does not count it |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `venue/0013`), using the isolated setup in `tests/L6/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-L6 from `tests/L6/README.md` is loaded: venue V, VS (Venue Staff of V), event E1 (Approved, coordinator C1) and hold H1 (Held, `D 10:00`-`D 12:00` UTC, lead 60 minutes) and the FX-L6 "due" step is applied to H1, then `expireHoldIfDue` is committed for H1 (L6-T1 steps 1 and 2). E1 has no other venue arrangement. |
| Test Steps | 1. As C1, send `POST /api/v1/holds/<H1>/convert` with the body L3-T13 uses (room layout `Theatre`).<br>2. As C1, send `POST /api/v1/holds/<H1>/release`.<br>3. As C1, read E1's confirmation readiness as F5 shows it (`tests/F5`).<br>4. Read H1 with the "Looking a hold up" query.<br>5. Run `npm test -w @connectsphere/planning-core -- tests/venue/api/l6Cards.test.ts -t 'L6-T3 '` (or the whole suite) and read the named `L6-T3 ` result. |
| Test Data | As in the steps. |
| Expected Result | Step 1 answers HTTP 409 `HOLD_NOT_HELD`, the message saying the hold has expired. Step 2 answers HTTP 409 `HOLD_NOT_HELD`. Step 3 shows the venue not arranged: H1 is not counted and E1 cannot become Confirmed on its account. Step 4 shows H1 still `EXPIRED`, its slot `EXPIRED`, and no booking request created. |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-21 |

> **Expected results are checked by the PR reviewer** against L6's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Waits for the L6 implementation and migration venue/0013 on the shared database, applied after the L6 PR merges (`npm run migrate -- venue`). Commit: · Evidence: · Defect: — |
| Executed By | |
| Date of Execution | |
