# S3-T8 — The owner, the assigned coordinator and any Event Coordinator see the flags

## Specification

| Item | Content |
|---|---|
| Test Case ID | S3-T8 |
| Test Scenario | Each of O, C and C2 reads the flags with HTTP 200; an unrelated organiser gets 404 |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `venue/0019` and `equipment/0009`), using the isolated setup in `tests/S3/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-S3 from `tests/S3/README.md` is loaded. The date change of S3-T2 has been approved, so B1, B2 and R1 carry flags. |
| Test Steps | 1. As O, send `GET /api/v1/events/<E>/arrangement-flags`.<br>2. As C, send the same request.<br>3. As C2 (an Event Coordinator not assigned to E), send the same request.<br>4. As O2 (an organiser who does not own E), send the same request.<br>5. Send the same request as C for an event id that does not exist.<br>6. Run `npm test -w @connectsphere/planning-core -- tests/change/api/s3Cards.test.ts -t 'S3-T8 '` (or the whole suite) and read the named `S3-T8 ` result. |
| Test Data | Actors O `organiser@connectsphere.test`, C `coordinator@connectsphere.test`, C2 `coordinator2@connectsphere.test`, O2 `organiser2@connectsphere.test`. |
| Expected Result | Steps 1 to 3 answer HTTP 200 with the same three flags: for each, the arrangement type (booking or reservation), its reference, the venue or equipment name, the flag and the reason. Step 4 answers HTTP 404 `EVENT_NOT_FOUND` and the body does not reveal that E or its flags exist. Step 5 answers HTTP 404 with the same body as step 4. |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-28 |

> **Expected results are checked by the PR reviewer** against S3's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Waits for the S3 implementation and migrations venue/0019 and equipment/0009. Commit: · Evidence: · Defect: — |
| Executed By | |
| Date of Execution | |
