# L6-T2 — Once a hold has expired another event's hold on the same period is placed

## Specification

| Item | Content |
|---|---|
| Test Case ID | L6-T2 |
| Test Scenario | An expired hold blocks nothing: a rival event's hold on the same venue and period is placed with HTTP 200 |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `venue/0013`), using the isolated setup in `tests/L6/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-L6 from `tests/L6/README.md` is loaded: venue V, VS (Venue Staff of V), event E1 (Approved, coordinator C1) and hold H1 (Held, `D 10:00`-`D 12:00` UTC, lead 60 minutes) and the FX-L6 "due" step is applied to H1, then `expireHoldIfDue` is committed for H1 (L6-T1 steps 1 and 2). A second Approved event E2 (coordinator C2) has a Requested hold H2 at V for the same period `D 10:00`-`D 12:00`. |
| Test Steps | 1. As VS, send `POST /api/v1/holds/<H2>/place` with `{"expiresAt":"<now plus 1 day>"}`.<br>2. Read H2, H1 and both slots with the "Looking a hold up" query.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/venue/api/l6Cards.test.ts -t 'L6-T2 '` (or the whole suite) and read the named `L6-T2 ` result. |
| Test Data | As in the steps. |
| Expected Result | Step 1 answers HTTP 200 with H2 status `HELD` and that expiry (L3's place route answers 200, not 201). Step 2 shows H2 `HELD` with a slot `HELD`; H1 stays `EXPIRED` with its slot `EXPIRED`. No `VENUE_SLOT_CONFLICT` is returned. |
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
