# ADR-010: Terraform Foundation for AWS Lightsail Deployment

## Status

Accepted

## Context

The project was running with local/dev infrastructure scripts and Docker assets, but there was no reproducible Infrastructure as Code path for a real cloud deployment.

To expose webhook endpoints in a stable way, we need:

1. A persistent server in AWS.
2. Deterministic provisioning (versioned and reviewable).
3. A structure that can evolve from `dev` to additional environments without copy-paste drift.

Additionally, we want to avoid locking infrastructure definitions to a single cloud vendor tooling model.
AWS CDK is focused on AWS services, while this project requires a path that can evolve to other providers in the future.

## Decision

Adopt Terraform as the first production-oriented infrastructure layer under `infrastructure/terraform` with:

1. A reusable module:
   * `infrastructure/terraform/modules/lightsail-instance`
   * resources:
     - `aws_lightsail_instance`
     - `aws_lightsail_instance_public_ports`
     - optional `aws_lightsail_static_ip` + `aws_lightsail_static_ip_attachment`
2. A first runnable environment stack:
   * `infrastructure/terraform/environments/development`
   * composes the module with environment variables and baseline tags.
3. Optional bootstrap path:
   * environment-level `user_data` script support for first-boot host setup.
4. Infrastructure documentation:
   * `infrastructure/terraform/README.md` as the operational entry point.
5. A provider contract direction:
   * environment stacks should consume provider-agnostic module interfaces,
   * provider-specific implementations remain behind those interfaces.

## Consequences

### Positive

1. Infrastructure provisioning is now declarative, versioned, and peer-reviewable.
2. Lightsail server creation is reusable via module composition.
3. `development` stack provides a concrete path for `plan/apply/destroy` and future environment expansion (`staging`, `prod`).
4. The IaC approach stays open for additional cloud providers (for example Google Cloud or Azure) by implementing the same contract with different provider modules.

### Negative / Trade-offs

1. Terraform state management is now required as an operational concern.
2. Lightsail is simpler than full VPC/ECS architectures but less flexible for advanced networking/scaling.
3. Additional IaC quality checks (fmt/validate/plan in CI) must be added to keep drift low.
4. True multi-provider support still requires maintaining provider-specific implementation modules behind the common contract.

## Follow-up

1. Add remote backend (S3 + DynamoDB lock) for shared team workflows.
2. Add CI job for Terraform fmt/validate/plan on infra changes.
3. Add additional environment stacks (`staging` and `prod`) with explicit variable sets.
