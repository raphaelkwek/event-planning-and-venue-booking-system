# G1-T11 — Two people editing at once: the second save is refused instead of silently overwriting the first

## Specification

| Item | Content |
|---|---|
| Test Case ID | G1-T11 |
| Test Scenario | Two people editing at once: the second save is refused instead of silently overwriting the first |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-APPROVED completed.<br>3. Window A signed in as `organiser@connectsphere.test`, and window B (a private window) as the assigned coordinator, both on the request's "Edit details" screen. |
| Test Steps | 1. In window A, change Description to `Edited by the organiser` and click "Save details".<br>2. In window B, without reloading, change Description to `Edited by the coordinator` and click "Save details".<br>3. In window B, click "Reload". |
| Test Data | Accounts: `organiser@connectsphere.test` and the assigned coordinator |
| Expected Result | Window A saves. Window B shows that the event was changed since it was opened, that nothing was saved, and that the latest version must be loaded first; the response was `412` with code `EVENT_VERSION_MISMATCH`. After reloading, window B shows `Edited by the organiser`. The history holds one description change, the organiser's. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-11 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Window A saved. Window B's save got 412 EVENT_VERSION_MISMATCH and showed "This event changed after you opened it": "This event was changed after you opened it, so nothing was saved. Load the latest version, then make your edit again." After Reload, window B showed "Edited by the organiser". The history held one description change, by the organiser. |
| Status | Pass |
| Remarks | Commit: c1aa0cb · Evidence: tests/G1/evidence/G1-T11.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-10 |
