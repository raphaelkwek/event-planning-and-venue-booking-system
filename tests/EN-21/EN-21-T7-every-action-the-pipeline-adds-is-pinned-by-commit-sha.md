# EN-21-T7 — Every third-party action the supply-chain pipeline adds is pinned by commit SHA

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-21-T7 |
| Test Scenario | Every third-party action the supply-chain pipeline adds is pinned by commit SHA |
| Pre-conditions | 1. A pull request or push to main. |
| Test Steps | 1. Open the job `Actions are pinned by commit SHA` of the Supply chain run.<br>2. Read the step: `node .github/scripts/check-action-pins.mjs` reads `.github/workflows/supply-chain.yml` and `.github/actions/**/action.yml`, and fails on any `uses:` that is not a 40-hex commit or a local path. |
| Test Data | The workflow and the composite action at the commit under test. |
| Expected Result | The job passes and prints each pinned action with its SHA. A `uses:` pinned to a tag or branch would fail it. |
| Acceptance criterion | Pin the third-party GitHub Actions you add by commit SHA. |
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
