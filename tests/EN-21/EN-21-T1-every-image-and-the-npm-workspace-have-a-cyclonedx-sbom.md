# EN-21-T1 — Every image and the npm workspace has a CycloneDX SBOM, uploaded as an artifact

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-21-T1 |
| Test Scenario | Every image and the npm workspace has a CycloneDX SBOM, uploaded as an artifact |
| Pre-conditions | 1. A pull request or push to main, so the Supply chain workflow runs.<br>2. The five images (planning-core, registration, notification, web, migrate) build on the runner. |
| Test Steps | 1. Open the Supply chain run and the job `SBOM (npm workspace)`; read the step that runs `npm sbom --sbom-format cyclonedx` and the validity check after it.<br>2. Open each of the five `Image (...)` jobs and read the `SBOM (CycloneDX, syft)` step and its validity check.<br>3. On the run page, list the artifacts. |
| Test Data | The repository's package-lock.json; the five images built from their Dockerfiles. |
| Expected Result | Six CycloneDX JSON documents are produced and uploaded: `sbom-npm-workspace` and `sbom-image-<name>` for each of the five images. Each has `bomFormat` CycloneDX, a `specVersion` and a non-empty `components` list; the image SBOMs also list the operating-system packages of the base image. A document that is missing, empty or not CycloneDX fails its job. |
| Acceptance criterion | SBOM: a CycloneDX SBOM is generated per image and for the npm workspace, and uploaded as artifacts. |
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
