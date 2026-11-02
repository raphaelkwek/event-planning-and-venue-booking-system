# EN-21-T6 — A ZAP baseline scan runs against the running web app and the planning-core API on a throwaway database; the rules file records each ignore

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-21-T6 |
| Test Scenario | A ZAP baseline scan runs against the running web app and the planning-core API on a throwaway database; the rules file records each ignore |
| Pre-conditions | 1. A pull request or push to main, so the Supply chain workflow runs.<br>2. The `planning-core`, `web` and `migrate` images build on the runner. |
| Test Steps | 1. Open the job `ZAP baseline (web app and planning-core API)`.<br>2. Read the step that migrates a throwaway Postgres, the steps that start the web and planning-core images read-only, and check both answer their health endpoint.<br>3. Read the two ZAP baseline steps (`zap-baseline.py -c .zap/rules.tsv` for each target) and the threshold the rules file sets.<br>4. List the artifacts; open `zap-report`.<br>5. Read `.zap/rules.tsv` for each ignored rule's reason, and `documentation/evidence/EN-21/zap.md`. |
| Test Data | The database is the job's own Postgres 17 service container; no shared database is reachable. The scan is unauthenticated and passive (the baseline does not attack). |
| Expected Result | Both scans complete and write HTML, JSON and Markdown reports, uploaded as the `zap-report` artifact. The job fails only on a rule that the rules file sets to FAIL, and every IGNORE row has a reason. The summary document lists the alerts by risk level with what was done. |
| Acceptance criterion | ZAP baseline against the running web app and the planning-core API, booted in CI on a throwaway database; a rules file with justified ignores; the report uploaded as an artifact and summarised in documentation/evidence/EN-21/zap.md. |
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
