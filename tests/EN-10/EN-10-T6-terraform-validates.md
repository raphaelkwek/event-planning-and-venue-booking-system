# EN-10-T6 — The Terraform for the network, the EKS cluster and Redis is formatted, valid and lint-clean

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-10-T6 |
| Test Scenario | The Terraform for the network, the EKS cluster and Redis is formatted, valid and lint-clean |
| Pre-conditions | 1. The Deploy workflow runs the `terraform` job. |
| Test Steps | 1. Open the `Terraform (fmt, validate, tflint)` job.<br>2. Check `terraform fmt -check -recursive`, then `terraform init -backend=false` and `terraform validate` in `environments/staging` and `environments/production`, then `tflint --recursive` with `deploy/terraform/.tflint.hcl`, all passed.<br>3. Read `deploy/terraform/README.md`: it says plan and apply were not run. |
| Test Data | `deploy/terraform/` (modules network, eks, redis; environments staging and production; S3 backend left unconfigured). |
| Expected Result | The job passes. `terraform plan` and `terraform apply` were NOT run: they need an AWS account and credentials the team does not have. |
| Acceptance criterion | Terraform for the cluster, network and Redis; validated in CI with fmt, init -backend=false, validate and tflint. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result |  |
| Status | Not Executed |
| Remarks | Commit: · Evidence: .github/workflows/deploy.yml › job 'Terraform (fmt, validate, tflint)' · Defect: |
| Executed By |  |
| Date of Execution |  |
