# L6-T9 — A bad or unauthorised expiry change is refused and stores nothing

## Specification

| Item | Content |
|---|---|
| Test Case ID | L6-T9 |
| Test Scenario | The expiry change is refused for a time not later than now, an unparseable or missing value, a hold that is not Held, and the wrong actor |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `venue/0013`), using the isolated setup in `tests/L6/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-L6 from `tests/L6/README.md` is loaded: venue V, VS (Venue Staff of V), event E1 (Approved, coordinator C1) and hold H1 (Held, `D 10:00`-`D 12:00` UTC, lead 60 minutes). H2 is a hold at V that is Released; H5 is a hold at another venue V2 that VS does not look after; VS2 looks after V2 only. |
| Test Steps | 1. As VS, `PATCH /api/v1/holds/<H1>/expiry` with `{"expiresAt":"<a minute ago>"}`.<br>2. Again with `expiresAt` equal to the moment of the request.<br>3. Again with `{"expiresAt":"not-a-date"}`.<br>4. Again with `{}`.<br>5. As VS, the same route on H2 (Released) with a valid later expiry.<br>6. As VS2, the same route on H1 with a valid later expiry.<br>7. As C1, the same route on H1 with a valid later expiry.<br>8. As VS, the same route on a well-formed id that does not exist.<br>9. Read H1 and the outbox.<br>10. Run `npm test -w @connectsphere/planning-core -- tests/venue/api/l6Cards.test.ts -t 'L6-T9 '` (or the whole suite) and read the named `L6-T9 ` result. |
| Test Data | A valid later expiry is `D-1 18:00` UTC. |
| Expected Result | Steps 1 to 4 answer HTTP 400 `VALIDATION_FAILED` with an error on `expiresAt` ("The expiry must be later than now." for steps 1 and 2, "Enter a date and time with its offset, for example 2026-12-02T14:00+08:00." for step 3, "Enter the expiry date and time." for step 4). Step 5 answers 409 `HOLD_NOT_HELD`. Step 6 answers 404 `HOLD_NOT_FOUND`, as L3's place route does for another venue's staff, so the hold's existence isn't revealed. Step 7 answers 403 `ROLE_NOT_AUTHORISED`. Step 8 answers 404 `HOLD_NOT_FOUND`. Step 9 shows H1's expiry and `reminded_at` unchanged and no `venue-booking.hold-expiry-changed` message for any hold. |
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
