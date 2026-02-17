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
- AWS credentials configured via one of these options:
  - environment variables: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, optional `AWS_SESSION_TOKEN`
  - shared profile: `AWS_PROFILE` + `~/.aws/credentials`
  - IAM role / AWS SSO session

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
ssh_public_key_path = "/home/your-user/.ssh/id_ed25519.pub"
compute_provider    = "aws_lightsail"

deploy_user_name                 = "deploy"
deploy_user_ssh_public_key_path  = "/home/your-user/.ssh/id_ed25519.pub"
deploy_user_enable_rootless_docker = true
```

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

## Recommended Next Step (State Backend)

For team usage, configure a remote backend (S3 + DynamoDB locking) per environment before production rollout. Keep state files out of Git.
