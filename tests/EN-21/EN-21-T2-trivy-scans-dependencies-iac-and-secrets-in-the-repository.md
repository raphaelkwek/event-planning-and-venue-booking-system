# EN-21-T2 — Trivy scans the repository's dependencies, Dockerfiles, deploy/ manifests and secrets; a CRITICAL finding with a fix fails the build

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-21-T2 |
| Test Scenario | Trivy scans the repository's dependencies, Dockerfiles, deploy/ manifests and secrets; a CRITICAL finding with a fix fails the build |
| Pre-conditions | 1. A pull request or push to main, so the Supply chain workflow runs.<br>2. The workflow token may write `security-events` (the repository is public and the branch is not a fork). |
| Test Steps | 1. Open the job `Trivy (filesystem: dependencies, IaC, secrets)`.<br>2. Read the report step: it lists HIGH and CRITICAL findings from the lockfile, the Dockerfiles, deploy/ (Kubernetes and Terraform) and any secret, and does not fail on HIGH.<br>3. Read the gate step: it runs Trivy with `--severity CRITICAL --ignore-unfixed --exit-code 1` and the justified ignores in `.trivyignore.yaml`.<br>4. Check the SARIF upload step and the repository's code scanning results for the `trivy-fs` category.<br>5. Read `documentation/evidence/EN-21/trivy.md` and compare its list with the job's report. |
| Test Data | The repository at the commit under test. |
| Expected Result | The report step lists the HIGH findings and passes. The gate step passes: no CRITICAL finding with a fix remains outside `.trivyignore.yaml`, and each ignore names its reason and an expiry date. The SARIF file is uploaded to code scanning, or the job says that the token could not write security events. No secret is found. The triage document lists every HIGH and CRITICAL finding the run reported and what was done about it. |
| Acceptance criterion | Trivy scans the filesystem (dependencies, IaC misconfiguration across deploy/ and the Dockerfiles, and secrets); fails on CRITICAL with a fix available; reports HIGH; uploads SARIF where the token allows; findings are triaged in documentation/evidence/EN-21/trivy.md. |
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
