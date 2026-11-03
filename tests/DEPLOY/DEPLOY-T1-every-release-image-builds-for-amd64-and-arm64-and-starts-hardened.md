# DEPLOY-T1 — Every image the release ships builds natively for linux/amd64 and linux/arm64 and starts hardened

## Specification

| Item | Content |
|---|---|
| Test Case ID | DEPLOY-T1 |
| Test Scenario | Every image the release ships builds natively for linux/amd64 and linux/arm64 and starts hardened |
| Pre-conditions | 1. A pull request changes deploy/, a Dockerfile or the Deploy workflow, so the Deploy workflow's cluster jobs run. |
| Test Steps | 1. Open the Deploy workflow run.<br>2. Check `Image (<name>)` passed for planning-core, registration, notification, migrate and cerbos on linux/amd64.<br>3. Check `Image arm64 (<name>)` passed for the same five on a native linux/arm64 runner.<br>4. In each, check the smoke step started the image read-only, non-root, with no capabilities, and the health endpoint answered (Cerbos: `/_cerbos/health` reports SERVING; migrate: applied every migration, then none). |
| Test Data | Throwaway Postgres service container on the runner. |
| Expected Result | All ten jobs pass. The arm64 build is what the Oracle Ampere VM pulls. |
| Acceptance criterion | Images are built multi-arch (linux/amd64 and linux/arm64) with buildx in CI. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | — |
| Status | Not Executed |
| Remarks | — |
| Executed By | — |
| Date of Execution | — |
