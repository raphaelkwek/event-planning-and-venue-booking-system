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
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
