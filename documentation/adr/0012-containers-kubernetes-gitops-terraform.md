# ADR-0012: Containers on managed Kubernetes, GitOps, Terraform

**Status:** Accepted. Supersedes ADR-0003's no-Docker rule; ADR-0003's hosted-Kafka choice continues under ADR-0008.
**Date:** 2026-10-01
**Owner:** whoever takes EN-10 (SPM-128), not yet assigned. The owner presents this in the Week 13 Q&A.
**Approval:** team decision (Gate D), reported 1 Oct 2026. See the gate log in `documentation/proposals/2026-10-01-target-architecture-and-jira-plan.md` §8.

## Context

ADR-0003 dropped Docker because nobody ran the compose file, and every service ran with `npm run dev` against hosted Supabase. That was the right call for local development, and it stays the way we develop.

What it left was no deployment story at all: the system only runs on laptops. Self-healing, horizontal scaling and zero-downtime releases are what the IS213 and IS214 award finalists were judged on, and our design's stateless services plus database-enforced invariants (ADR-0006) make running several copies safe.

## Decision

- **Images are built in CI only.** Developers still run `npm run dev` locally, and nobody needs Docker Desktop on their laptop.
- **EKS in AWS ap-southeast-1 (Singapore)**, across three availability zones, which keeps data in Singapore under PDPA.
- **Autoscaling:** HPA for the APIs and KEDA for consumers and workers, with PodDisruptionBudgets on every deployable. Readiness probes check the database and Kafka.
- **Terraform** for all infrastructure. **Argo CD** syncs each environment from git, so deploying means merging a pull request.
- **Argo Rollouts** runs canary releases at 10%, 50% and 100%, with automatic Prometheus analysis and rollback (EN-16).
- **Schema changes use expand, migrate, contract**, linted by squawk, so releases need no downtime.

## Alternatives considered

- **Keep ADR-0003 unchanged (laptops only).** There would be nothing to show for deployment, recovery or scaling. Rejected.
- **Plain VMs.** They don't heal themselves. Rejected.
- **Lambda for the services.** CDC, Kafka consumers and Temporal workers are long-running, and cold Lambdas open their own database connections under load. Rejected.

## Consequences

**What we get:**
- A merge deploys the system.
- A crashed copy is replaced in seconds.
- Every environment is built from the same code.

**What it costs:**
- Operational complexity, and a cloud bill. The team should set a budget before EN-10 starts.
- More to learn.
- This is Tier 2. If capacity runs short, EN-10, EN-16 and EN-21 are cut first, and the system stays on `npm run dev` plus CI.

**What a reviewer should watch for:**
- A Dockerfile that a developer must run locally to work.
- Infrastructure changed by hand instead of through Terraform.
- A migration that isn't expand-then-contract.

**Implemented by:** EN-10 (SPM-128), EN-16 (SPM-134) and EN-21 (SPM-139). **Updates:** `CLAUDE.md`, whose no-Docker rule is replaced.
