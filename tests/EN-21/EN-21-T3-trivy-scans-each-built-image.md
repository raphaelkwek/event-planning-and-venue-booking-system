# EN-21-T3 — Trivy scans each built image; a CRITICAL operating-system or library finding with a fix fails the build

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-21-T3 |
| Test Scenario | Trivy scans each built image; a CRITICAL operating-system or library finding with a fix fails the build |
| Pre-conditions | 1. A pull request or push to main, so the Supply chain workflow runs.<br>2. The five images build on the runner. |
| Test Steps | 1. Open each `Image (...)` job of the Supply chain run.<br>2. Read the `Trivy report (HIGH and CRITICAL)` step: it scans the image the job just built, operating-system packages and libraries.<br>3. Read the `Trivy gate (CRITICAL with a fix)` step.<br>4. Check the SARIF upload step.<br>5. Compare `documentation/evidence/EN-21/trivy.md` with the reports. |
| Test Data | The five images built from their Dockerfiles at the commit under test. |
| Expected Result | All five jobs report their HIGH and CRITICAL findings and pass the gate: no image has a CRITICAL finding that a newer package or base image fixes. The findings are in the triage document, with what was changed in the Dockerfiles (if anything) and why the rest remains. |
| Acceptance criterion | Trivy scans each built image; fails on CRITICAL with a fix available; reports HIGH; uploads SARIF where the token allows. |
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
