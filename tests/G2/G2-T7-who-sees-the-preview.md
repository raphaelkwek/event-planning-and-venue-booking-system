# G2-T7 — Who sees the preview, and a decided request has none

## Specification

| Item | Content |
|---|---|
| Test Case ID | G2-T7 |
| Test Scenario | O, C and C2 each read the preview with HTTP 200; an unrelated organiser, Venue Staff and an unknown id get 404; a decided request gets 409 naming its decision |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `venue/0018` and `equipment/0009`), using the isolated setup in `tests/G2/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-G2 from `tests/G2/README.md` is loaded. Specific set-up: CR proposes `proposedStartAt` `D 15:00` (event E would move from `D 14:00`–`D 18:00` to `D 15:00`–`D 18:00`), nothing else.<br>3. A fresh FX-G2 (a second E with its own CR) is loaded for the decided part of the card. |
| Test Steps | 1. As O, send `GET /api/v1/change-requests/<CR>/impact`.<br>2. As C, send the same request.<br>3. As C2 (an Event Coordinator not assigned to E), send the same request.<br>4. As O2 (an organiser who does not own E), send the same request.<br>5. As VS, send the same request.<br>6. As C, send the request for a change request id that does not exist.<br>7. On the fresh FX-G2, as C, approve CR with `POST /api/v1/change-requests/<CR>/decision` `{"decision":"APPROVE"}`, then send `GET /api/v1/change-requests/<CR>/impact`.<br>8. Run `npm test -w @connectsphere/planning-core -- tests/change/api/g2Cards.test.ts -t 'G2-T7 '` (or the whole suite) and read the named `G2-T7 ` result. |
| Test Data | Actors O `organiser@connectsphere.test`, C `coordinator@connectsphere.test`, C2 `coordinator2@connectsphere.test`, O2 `organiser2@connectsphere.test`, VS `venuestaff@connectsphere.test`. |
| Expected Result | Steps 1 to 3 answer HTTP 200 with the same `impact` (B1, B2, R1, `activeRegistrations` 0 and the three flags of G2-T3). Steps 4 and 5 answer HTTP 404 `CHANGE_REQUEST_NOT_FOUND` with the message `No change request with that id exists.`, and the body does not reveal E's id or reference. Step 6 answers HTTP 404 with the same code and message. In step 7 the approval answers 200 and the preview answers HTTP 409 `CHANGE_REQUEST_ALREADY_DECIDED` with the message `This change request was already Approved on <decidedAt>.` and `details` `{"status":"APPROVED","decidedAt":"<decidedAt>"}`, `<decidedAt>` being the approval's `changeRequest.decidedAt`. |
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
