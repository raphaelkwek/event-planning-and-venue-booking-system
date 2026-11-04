# Terraform: cluster, network and Redis (EN-10)

Infrastructure for ConnectSphere on AWS, region `ap-southeast-1` (Singapore).

> **The scale-up path, not what runs today (ADR-0016, 3 Nov 2026).** Staging and production run on a
> free Oracle Always Free k3s VM and Vercel (`documentation/deploy/README.md`). This Terraform (EKS, a
> three-zone VPC, ElastiCache; about USD 150 a month idle) is kept, validated in CI, for when one VM is
> no longer enough. It has never been planned or applied.

| Path | What it builds |
|---|---|
| `modules/network` | A VPC across three zones: three public and three private subnets, an internet gateway, NAT (one in staging, one per zone in production) and the subnet tags EKS and load balancers discover. |
| `modules/eks` | An EKS control plane, a managed node group on private subnets, the IAM roles both need and an OIDC provider for IAM roles for service accounts. |
| `modules/redis` | An ElastiCache Redis replication group for EN-12's rate limits. Encrypted at rest and in transit, AUTH token required, reachable only from the cluster node security group. |
| `environments/staging`, `environments/production` | One root module each, with its own state. They differ in size, CIDR and NAT/Redis redundancy only. |

## Decision note: AWS, EKS and ElastiCache

**Context.** ADR-0012 puts the services on managed Kubernetes and already chose EKS in
ap-southeast-1 across three availability zones, which keeps data in Singapore for PDPA. EN-10 has to
express that as code. EN-12 needs a shared Redis so rate limits hold across many API pods.

**Decision.** AWS, because ADR-0012 says so and nothing since has changed that: EKS for the cluster,
ElastiCache for Redis, S3 and DynamoDB for Terraform state. Resources are written directly (no
community modules), so a reviewer can read every one.

**Alternatives.**
- GKE or AKS: equally capable, but they have no Singapore advantage over AWS and the team would
  have to re-decide ADR-0012.
- ECS or Fargate: simpler, but Argo CD and Argo Rollouts (EN-10, EN-16) need Kubernetes.
- Redis inside the cluster: one less bill, but a stateful workload the team would then run itself.

**Consequences.**
- It costs money to leave running: an EKS control plane, NAT gateways, three nodes and Redis. ADR-0012
  says the team must set a budget first. Destroy staging when it is not in use.
- The Redis AUTH token is passed as `TF_VAR_redis_auth_token`; it is still stored in Terraform state,
  so the state bucket must be private and encrypted.
- The public API endpoint defaults to `0.0.0.0/0`. Set `endpoint_public_access_cidrs` to the team's
  addresses before applying.

## What has and has not been run

CI runs `terraform fmt -check -recursive`, `terraform init -backend=false`, `terraform validate` in both
environments and `tflint --recursive`. **`terraform plan` and `terraform apply` have not been run**:
the team has no AWS account or credentials, so nothing in this directory has created a resource.

## Use it (needs an AWS account)

```bash
cd deploy/terraform/environments/staging
cp backend.hcl.example backend.hcl            # fill in your state bucket and lock table
cp terraform.tfvars.example terraform.tfvars  # optional
export TF_VAR_redis_auth_token="$(openssl rand -base64 24 | tr -d '/+=')"
terraform init -backend-config=backend.hcl
terraform plan
terraform apply
aws eks update-kubeconfig --name connectsphere-staging --region ap-southeast-1
```

The state bucket (versioned, encrypted, private) and the DynamoDB lock table (key `LockID`) are created
once by hand; they are not managed here. `backend.hcl`, `*.tfvars` and state files are git-ignored.
