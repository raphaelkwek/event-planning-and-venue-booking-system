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
| Actual Result | terraform fmt -check, init -backend=false and validate in both environments, and tflint --recursive passed. plan and apply were not run. |
| Status | Pass |
| Remarks | Commit: 7f31fe5f8158bc75ca285a38e4ccca713e778a9f · Automated · Evidence: .github/workflows/deploy.yml › job 'Terraform (fmt, validate, tflint)', CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41511260190 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
