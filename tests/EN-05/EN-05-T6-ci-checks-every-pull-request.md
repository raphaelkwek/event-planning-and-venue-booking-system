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
| Actual Result | The job "Message schema compatibility" ran on this pull request with fetch-depth 0, ran npm run schemas:check (30 committed schema files match contracts), then npm run schemas:compat against the pull request's base commit (main has no schema files yet, so it printed that there is nothing to compare). Both steps exit non-zero on failure, which fails the job; T5 shows the command's exit codes. The job was green. |
| Status | Pass |
| Remarks | Automated (CI job) · Commit: c4325fb · Evidence: .github/workflows/ci.yml › job schema-compat "Message schema compatibility", CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41614891360 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
