# Terraform Infrastructure

This directory contains Infrastructure as Code for compute infrastructure used by AI-PR-Sentinel.
Today, AWS Lightsail is implemented. The Terraform contract layer is prepared for additional providers.

## Structure

- `modules/compute-instance-contract`: provider-agnostic contract module used by environments.
- `modules/lightsail-instance`: AWS Lightsail implementation module behind the contract.
- `environments/development`: runnable environment wiring the compute contract for development.

## Why Terraform

Terraform was chosen to keep infrastructure definitions portable across cloud providers.

- Terraform supports multiple providers through the same IaC workflow (`plan/apply/destroy`).
- AWS CDK is AWS-centric by design, while Terraform can target AWS, Google Cloud, Azure, and many other ecosystems through provider plugins.
- This repository already reflects that direction with a provider-agnostic module contract (`compute-instance-contract`) and provider-specific implementations behind it.

Important nuance: "multi-provider" does not mean one module works identically everywhere without changes. Each provider still needs its own implementation module behind the shared contract.

## Prerequisites

- Terraform `>= 1.6`
- HCP Terraform organization + workspace (`darkneiss` / `aisentinel`) configured in `environments/development/versions.tf`
- AWS credentials configured via one of these options:
  - environment variables: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, optional `AWS_SESSION_TOKEN`
  - shared profile: `AWS_PROFILE` + `~/.aws/credentials`
  - IAM role / AWS SSO session

## Remote State (HCP Terraform)

This environment uses Terraform `cloud {}` configuration, so state is stored remotely in HCP Terraform.

- Workspace: `darkneiss/aisentinel`
- Expected execution mode in HCP: `Local` (important for local module paths like `../../modules/...`)
- Terraform CLI commands (`plan`, `apply`, `destroy`) run locally or in GitHub Actions, while state remains in HCP Terraform.

## Defaults (Development Stack)

- Compute provider: `aws_lightsail`
- Region: `eu-west-3` (Paris)
- Availability zone: `eu-west-3a`
- OS blueprint: `debian_12`
- Instance bundle: `small_3_0` (General purpose: 2 GB RAM, 2 vCPU, 60 GB SSD, 3 TB transfer)
- IP addressing: `ipv4` (public IPv4)

## SSH Access

You have two mutually exclusive options:

1. Automatic managed key pair (recommended):
   - set `ssh_public_key_path` to a local `.pub` file path
   - keep `key_pair_name = null`
2. Existing Lightsail key pair:
   - set `key_pair_name` to an existing key pair name
   - keep `ssh_public_key_path = null`

These variables control the Lightsail login key (for the default OS user), not the dedicated deployment user.

## Deploy User (No sudo + SSH key + Rootless Docker)

When `user_data_file_path` is set, bootstrap creates an unprivileged deploy user and configures:

- home directory in `/srv/<deploy_user>`,
- locked password (SSH key auth only),
- `authorized_keys` from your deploy public key,
- SSH policy for that user (`AuthenticationMethods publickey`),
- rootless Docker for that user (fallback: docker group if rootless setup fails).

Required variables when bootstrap is enabled:

- `deploy_user_name` (default: `deploy`)
- one of:
  - `deploy_user_ssh_public_key_path`
  - `deploy_user_ssh_public_key` (recommended for CI via `TF_VAR_deploy_user_ssh_public_key`)
- `deploy_user_enable_rootless_docker` (default: `true`)

## First Deployment (Development)

```bash
cd infrastructure/terraform/environments/development
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
terraform apply
```

Example for automatic key pair creation from your local public key:

```hcl
key_pair_name       = null
ssh_public_key_path = "/home/your-user/.ssh/id_ed25519_ai_pr_sentinel_infra.pub"
compute_provider    = "aws_lightsail"

deploy_user_name                 = "deploy"
deploy_user_ssh_public_key_path  = "/home/your-user/.ssh/id_ed25519_ai_pr_sentinel_deploy.pub"
deploy_user_enable_rootless_docker = true
```

## Instance Replacement Guard (CI Safe Mode by Default)

Terraform CI now blocks accidental Lightsail instance replacement by default.

- `terraform-plan.yml` fails if a PR plan contains `aws_lightsail_instance` replacement.
- `terraform-apply.yml` fails on `main`/`master` pushes if the apply plan contains replacement.
- This avoids unexpected host key changes and first-boot reprovision side effects.

Typical immutable changes that may require replacement include:

- `blueprint_id` (OS image) changes
- `bundle_id` (instance size) changes
- `key_pair_name` (SSH key pair association) changes
- `user_data` (first-boot bootstrap script) changes
- Other attributes marked as `ForceNew` in `aws_lightsail_instance`

How to bypass the protection intentionally:

1. Validate the reason for replacement and expected impact.
2. Run `.github/workflows/terraform-apply.yml` manually (`workflow_dispatch`) and set `allow_instance_replacement=true`.
3. Use a clear `reason` in the workflow input for auditability.
4. Keep regular push-based applies unchanged (they stay protected by default).

## Provider Contract

The development environment consumes `modules/compute-instance-contract`, which exposes a provider-agnostic interface.

- Implemented provider: `aws_lightsail`
- Reserved provider value for future implementation: `gcp_compute_engine`

If you select a reserved provider not yet implemented, Terraform fails fast with a clear validation error.

Generate a dedicated deploy key pair (recommended):

```bash
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_ai_pr_sentinel_deploy -C "ai-pr-sentinel-deploy"
```

- Public key (`.pub`): used by Terraform in `deploy_user_ssh_public_key_path` or `deploy_user_ssh_public_key`.
- Private key: keep local or store in GitHub Secret (for CI/CD SSH deploy). Never commit private keys.

## Destroy Development Environment

```bash
cd infrastructure/terraform/environments/development
terraform destroy
```

## Bootstrap Notes

- The first-boot script installs Docker Engine and configures the deploy user for key-based SSH access.
- Rootless Docker is configured for the deploy user when `deploy_user_enable_rootless_docker = true`.
- Bootstrap sets `net.ipv4.ip_unprivileged_port_start=80` so rootless containers can bind ports `80/443`.
- If rootless setup fails, bootstrap falls back to adding the deploy user to the `docker` group.
- Reconnect your SSH session as the deploy user after first boot so the `DOCKER_HOST` profile export is loaded.

## GitHub Actions (Terraform CI/CD)

The repository includes three Terraform workflows:

- `.github/workflows/terraform-plan.yml`: runs `fmt/validate/plan` for development on PRs that touch `infrastructure/terraform/**`.
- `.github/workflows/terraform-apply.yml`: runs `init/validate/plan/apply` on `main`/`master` infra changes and also supports manual `workflow_dispatch` with `allow_instance_replacement` override.
- `.github/workflows/terraform-destroy.yml`: manual destroy workflow with explicit confirmation (`destroy-development`) and dedicated environment gate.

Required GitHub configuration:

- Repository Variable: `AWS_ROLE_TO_ASSUME` (IAM Role ARN for OIDC federation)
- Optional Repository Variable: `AWS_REGION` (defaults to `eu-west-3` in workflows)
- Optional Repository Variables:
  - `TF_DEPLOY_USER_NAME` (defaults to `aisentinel`)
  - `TF_DEPLOY_USER_ROOTLESS_DOCKER` (defaults to `true`)
- Repository Secret: `TF_TOKEN_app_terraform_io` (HCP Terraform token)
- Repository Secret: `DEPLOY_SSH_PRIVATE_KEY` (private key used to derive public keys for Terraform `ssh_public_key_path` and `deploy_user_ssh_public_key_path` in CI)

Security model:

- AWS authentication in CI uses GitHub OIDC + `aws-actions/configure-aws-credentials` (no static AWS keys in GitHub secrets).
- Terraform Cloud/HCP authentication uses `TF_TOKEN_app_terraform_io`.

## Runtime Deploy Workflow (Docker Compose)

Terraform provisions the server, but application runtime deploy is handled by a separate workflow:

- `.github/workflows/deploy-runtime.yml`

This workflow syncs `infrastructure/deploy/runtime/` to the server, renders runtime `.env` from `infrastructure/deploy/runtime/.env.template` using GitHub `vars` + `secrets`, and executes:

- `docker compose pull`
- `docker compose up -d --force-recreate --remove-orphans`

The workflow is triggered automatically after image publication from `.github/workflows/publish-image.yml` and can also be run manually with an explicit `image_tag`.

Runtime deploy configuration expected by the workflow:

- Variables:
  - `DEPLOY_HOST`
  - optional: `DEPLOY_PORT`, `DEPLOY_USER`, `DEPLOY_RUNTIME_PATH`
  - required: `RUNTIME_SERVER_NAME`
  - required when TLS enabled: `RUNTIME_LETSENCRYPT_EMAIL`
  - optional runtime overrides: `RUNTIME_*` (port, nginx, logging, AI/provider settings)
- Secrets:
  - `RUNTIME_SCM_TOKEN`
  - `RUNTIME_SCM_WEBHOOK_SECRET`
  - `RUNTIME_LLM_API_KEY`
  - `RUNTIME_LANGSMITH_API_KEY` (required when `RUNTIME_LANGSMITH_TRACING=true`)
- `DEPLOY_SSH_PRIVATE_KEY`
- optional for private GHCR: `GHCR_DEPLOY_USERNAME`, `GHCR_DEPLOY_TOKEN`
