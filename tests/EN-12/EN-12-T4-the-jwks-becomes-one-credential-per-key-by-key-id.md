# EN-12-T4 — The rendering step turns every key of a JWKS into a Kong credential keyed by its key id, and a rotated JWKS gives the new set

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-12-T4 |
| Test Scenario | The rendering step turns every key of a JWKS into a Kong credential keyed by its key id, and a rotated JWKS gives the new set |
| Pre-conditions | 1. Dependencies installed (`npm ci`). No network, no Docker. |
| Test Steps | 1. Run `node --test gateway/tests/render.test.mjs`.<br>2. Find the tests named `EN-12-T4`. |
| Test Data | A JWKS with an ES256 key, then with a second RS256 key added and the first removed (a rotation); a JWKS with a key that has no kid or an unsupported type |
| Expected Result | One `jwt_secrets` entry per key: `key` is the kid, `algorithm` ES256 or RS256, `rsa_public_key` a PEM public key that verifies a token signed by the private half. After rotation only the new key is present. A key without a kid or of an unsupported type makes the render fail, naming it, rather than writing a config that accepts nothing. |
| Acceptance criterion | Kong verifies Supabase JWTs against the JWKS (Kong OSS cannot fetch a JWKS itself, so it is synced into credentials). |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result |  |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By |  |
| Date of Execution |  |
