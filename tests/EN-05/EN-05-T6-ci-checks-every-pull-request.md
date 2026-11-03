# EN-05-T6 — Every pull request runs the schema checks in CI, and a breaking change fails the build

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-05-T6 |
| Test Scenario | Every pull request runs the schema checks in CI, and a breaking change fails the build |
| Pre-conditions | 1. The pull request is open against main. |
| Test Steps | 1. Open the pull request's checks.<br>2. Find the job "Message schema compatibility".<br>3. Read its steps. |
| Test Data | `.github/workflows/ci.yml`. |
| Expected Result | The job runs on pull requests with the whole git history available, regenerates and checks the committed schema files, then compares the branch with the pull request's base branch. It fails if either step fails. This pull request's run of the job is green. |
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
