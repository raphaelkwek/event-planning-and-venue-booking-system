# EN-07-T12 — A route added without a policy resource and action, or naming an action no policy grants, fails the matrix

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-07-T12 |
| Test Scenario | A route added without a policy resource and action, or naming an action no policy grants, fails the matrix |
| Pre-conditions | 1. Dependencies installed (`npm ci`), run from the repository root. No database and no policy decision point are needed. |
| Test Steps | 1. Run `npm run test:unit -w @connectsphere/planning-core`.<br>2. Read the results of `routePermissions.unit.test.ts`.<br>3. Add a route with no `authorize(...)` gate (or one naming an unknown action) to any router and run step 1 again. |
| Test Data | The served routes, the public-route list, and the actions named in `policies/resources/*.yaml`. |
| Expected Result | With the routes as committed, every non-public route has exactly one policy gate naming a resource and action that `policies/` grants to at least one role, and the test passes. With the added route, the test fails and names the route. |
| Acceptance criterion | AC3: A generated matrix test covering role × endpoint × related and unrelated resources. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Every served route that isn't public or session-only has exactly one gate naming an action a policy grants; an added route with no gate, and a gate naming an unknown action, were each reported by name. |
| Status | Pass |
| Remarks | Automated (unit) · Commit: 7f1c8fa · Evidence: backend/services/planning-core/tests/api/routePermissions.unit.test.ts › EN-07-T12 every route that is not public or session-only has exactly one policy gate; EN-07-T12 every gate names an action that a policy in policies/resources grants; EN-07-T12 a route added without a gate is reported, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41640443625 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
