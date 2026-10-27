# E4-T5 — The outgoing coordinator, the new coordinator and the owning organiser are notified, and the organiser sees the new point of contact

## Specification

| Item | Content |
|---|---|
| Test Case ID | E4-T5 |
| Test Scenario | The outgoing coordinator, the new coordinator and the owning organiser are notified, and the organiser sees the new point of contact |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. E4-T1 completed. |
| Test Steps | 1. Sign in as `coordinator@connectsphere.test` and open Notifications.<br>2. Sign in as `coordinator2@connectsphere.test` and open Notifications.<br>3. Sign in as `organiser@connectsphere.test`, open Notifications, then the request. |
| Test Data | The reassignment from E4-T1 |
| Expected Result | Coordinator One is told they are no longer the event's coordinator; Coordinator Two that it is now assigned to them; the organiser that Coordinator Two is now their point of contact, and the request shows Coordinator Two as the assigned coordinator. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-27 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | coordinator: "Event request EVT-015179 “Annual Research Symposium” has been reassigned to Coordinator Two. You are no longer its coordinator.10/27/2026, 8:42:05 PMUnreadOpenMark as read"; coordinator2: "Event request EVT-015179 “Annual Research Symposium” has been reassigned to you.10/27/2026, 8:42:05 PMUnreadOpenMark as read"; organiser: "Your event request EVT-015179 “Annual Research Symposium” has been reassigned to Coordinator Two, who is now your point of contact.10/27/2026, 8:42:05 PMUnreadOpenMark as read". The organiser's request names Coordinator Two as the assigned coordinator. |
| Status | Pass |
| Remarks | Commit: 23a2d37 · Evidence: tests/E4/evidence/E4-T5.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-27 |
