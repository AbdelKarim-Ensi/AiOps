# Phase 4 — Local Kubernetes cluster (kind) and Terraform

**Status:** ✅ Done
**Period:** 3–5 September 2026 (commits `bb2fbc0`, `ce4c944`; PRs #1 and #2)

## 1. Goal

Have a local Kubernetes cluster, first created by hand to understand how it works, then described as code with Terraform.

**Definition of Done (PRD):**
> `terraform apply` creates a ready kind cluster, a test Pod responds, `destroy` cleanly removes everything.

## 2. Deliverables

- **Test kind cluster** with an nginx Deployment and Service to validate networking and deployment.
- **Terraform module** `infra/terraform/modules/kind-cluster` (provider `tehcyx/kind`, `main.tf`, `variables.tf`, `outputs.tf`).
- Final cluster: `aiops-cluster-tf`.

Versions used: kind 0.24.0, Terraform 1.9.5.

## 3. Terraform cycle practised

```bash
cd infra/terraform/modules/kind-cluster
terraform init      # downloads the provider
terraform plan      # computes the changes
terraform apply     # creates the cluster
terraform destroy   # deletes the cluster
```

The `.tfstate` file records the real state; it is ignored by git (`*.tfstate` in `.gitignore`).

## 4. Lesson learned

Never keep two kind clusters at the same time. The old hand-made cluster (`aiops-cluster`) coexisting with `aiops-cluster-tf` caused chronic DNS errors (see phase 5). Always run `kind get clusters` before diagnosing a network problem.
