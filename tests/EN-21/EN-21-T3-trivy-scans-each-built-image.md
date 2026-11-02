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
| Actual Result | All five images were scanned; reports and SARIF (categories trivy-image-<name>) uploaded; the gate passed for all five. The first run failed on all five (CRITICAL with a fix); the Dockerfile fixes in this pull request cleared it (counts in trivy.md). planning-core's CRITICAL zlib has no fix and its CRITICAL zip crate is ignored with a reason until 2026-12-15. |
| Status | Pass |
| Remarks | Commit: 11d972ed593bf4abc6f26115f75ffd246e071c14 · Automated (CI) · Evidence: .github/workflows/supply-chain.yml › jobs 'Image (<name>) SBOM, Trivy, signing' (steps 'Trivy report', 'Trivy gate'); documentation/evidence/EN-21/trivy.md, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41521790370 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
