# S3-T8 — The owner and the assigned coordinator see the flags; another coordinator and another organiser get 404

## Specification

| Item | Content |
|---|---|
| Test Case ID | S3-T8 |
| Test Scenario | The owner and the assigned coordinator see the flags; another coordinator and another organiser get 404 |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `venue/0019` and `equipment/0009`), using the isolated setup in `tests/S3/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-S3 from `tests/S3/README.md` is loaded. The date change of S3-T2 has been approved, so B1, B2 and R1 carry flags. |
| Test Steps | 1. As O, send `GET /api/v1/events/<E>/arrangement-flags`.<br>2. As C, send the same request.<br>3. As C2 (an Event Coordinator not assigned to E), send the same request.<br>4. As O2 (an organiser who does not own E), send the same request.<br>5. Send the same request as C for an event id that does not exist.<br>6. Run `npm test -w @connectsphere/planning-core -- tests/change/api/s3Cards.test.ts -t 'S3-T8 '` (or the whole suite) and read the named `S3-T8 ` result. |
| Test Data | Actors O `organiser@connectsphere.test`, C `coordinator@connectsphere.test`, C2 `coordinator2@connectsphere.test`, O2 `organiser2@connectsphere.test`. |
| Expected Result | Steps 1 and 2 answer HTTP 200 with the same three flags: for each, the arrangement type (booking or reservation), its reference, the venue or equipment name, the flag and the reason. Step 3 answers HTTP 404 `EVENT_NOT_FOUND`, "No event with that reference is assigned to you.". Step 4 answers HTTP 404 `EVENT_NOT_FOUND`. Neither body reveals that E or its flags exist. Step 5 answers HTTP 404 with the same code and message as step 3. |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-28 |

> **Expected results are checked by the PR reviewer** against S3's acceptance criteria.

> **Revised for A4 (CR-05) on 2 Nov 2026.** A4 supersedes S3 AC8's "and Event Coordinators": a coordinator not assigned to the event sees none of it, flags included.

## Execution record

| Item | Content |
|---|---|
| Actual Result | O and C got 200 with the three flags. C2 got 404 EVENT_NOT_FOUND "No event with that reference is assigned to you."; O2 got 404 EVENT_NOT_FOUND, with nothing of E in the body. C's request for an unknown id got the same code and message as C2. |
| Status | Pass |
| Remarks | Commit: 6f59d76, automated, on a throwaway Postgres (EN-06) · Evidence: the named test result · Defect: — |
| Executed By | Shawmya, via Claude |
| Date of Execution | 2026-11-02 |
