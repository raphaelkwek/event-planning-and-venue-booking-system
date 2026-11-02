# EN-14-T3 — Tokens from the fake carry Supabase's claims and pass the services' own verification

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-14-T3 |
| Test Scenario | Tokens from the fake carry Supabase's claims and pass the services' own verification |
| Pre-conditions | Dependencies installed. No database is needed. |
| Test Steps | 1. Run `npx tsx --test tests/e2e/support/fake-supabase-auth.test.ts`.<br>2. Read the token, refusal, logout, CORS and grant cases. |
| Test Data | `coordinator@connectsphere.test` / `ConnectSphere-Test-1234!`; a wrong password; an unknown email; a forged token. |
| Expected Result | A password grant returns `access_token`, `token_type: bearer` and the user. The token verifies against the served JWKS with `jose`'s `jwtVerify`, as `shared/auth/verifyJwt.ts` does, and its claims are `sub` (the Supabase user id), `aud` and `role` `authenticated`, `email`, `iss` and `session_id`, signed ES256. A wrong password and an unknown email get the same 400. A wrong anon key gets 401. After logout `/auth/v1/user` refuses the token. Preflights are answered for the web app's origin only, and only the password grant exists. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The token verified with jose's jwtVerify against the served JWKS with sub, aud, role, email, iss and session_id as Supabase sets them, ES256; wrong password and unknown email got the same 400; a wrong anon key got 401; /auth/v1/user refused the token after logout and refused a forged one; preflights answered only for the web origin; only the password grant exists. The journeys then signed in against it end to end. |
| Status | Pass |
| Remarks | Automated in CI (unit job and e2e job). Commit: 6080462 · Evidence: tests/e2e/support/fake-supabase-auth.test.ts (unit job, npm run test:scripts) › the fake GoTrue endpoints (7 cases), CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
