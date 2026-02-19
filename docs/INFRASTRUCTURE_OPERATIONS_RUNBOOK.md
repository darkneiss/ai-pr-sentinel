# Infrastructure Operations Runbook (Development)

This runbook describes the operational flow for infrastructure and runtime deployment in the `development` environment.

It covers:

- Normal automatic deployment flow
- Manual runtime deployment
- Manual infrastructure apply
- Controlled infrastructure destroy
- Post-run verification and rollback basics

## 1. Workflow Map

| Workflow | File | Trigger | Purpose |
|---|---|---|---|
| Terraform Plan | `.github/workflows/terraform-plan.yml` | PR changes in `infrastructure/terraform/**` or manual | Validate/fmt/plan and block unintended instance replacement |
| Terraform Apply | `.github/workflows/terraform-apply.yml` | Push to `main`/`master` touching `infrastructure/terraform/**` or manual | Apply infra changes in development |
| Terraform Destroy | `.github/workflows/terraform-destroy.yml` | Manual only | Destroy development infrastructure |
| Publish Image | `.github/workflows/publish-image.yml` | Release published | Build and push image to GHCR |
| Deploy Runtime | `.github/workflows/deploy-runtime.yml` | Auto via `repository_dispatch` from publish-image, or manual | Sync runtime stack and deploy compose on server |

### 1.1 GitHub Environments, Variables, and Secrets

Use this model to avoid configuration mistakes:

- Repository-level `Variables`/`Secrets`:
  - available to workflows/jobs that do not declare `environment: ...`.
  - good for shared CI configuration.
- Environment-level `Variables`/`Secrets`:
  - available only to jobs bound to that environment.
  - good for stage-specific values (`development`, `production`, destroy gates).
- If a key exists in both repository and environment scope:
  - environment-scoped value is used for jobs running in that environment.

Where to configure:

1. `Settings` -> `Secrets and variables` -> `Actions`.
2. Create values in:
   - `Repository secrets` / `Repository variables`, or
   - `Environments` -> `<environment-name>` -> `Secrets` / `Variables`.

Current environment binding in this project:

- `terraform-apply.yml` -> environment `development`
- `terraform-destroy.yml` -> environment `development-destroy`
- `deploy-runtime.yml` -> environment `development`
- `terraform-plan.yml` -> no environment binding (uses repository scope)

Practical impact:

- If `terraform-plan` fails with missing secret errors, ensure required keys exist at repository scope.
- Runtime deploy values should usually live in environment `development` because they are deployment-target specific.

### 1.2 Variable Naming Conventions Used Here

- `RUNTIME_*`:
  - GitHub Actions vars/secrets consumed by `deploy-runtime.yml`.
  - Mapped into rendered runtime `.env` (API, Nginx, AI, LangSmith settings).
  - Webhook ingress hardening defaults in runtime deploy:
    - `RUNTIME_SCM_WEBHOOK_ALLOWED_REPOSITORIES` (default: current `${{ github.repository }}`)
    - `RUNTIME_SCM_WEBHOOK_STRICT_REPOSITORY_ALLOWLIST` (default: `true`)
    - `RUNTIME_SCM_WEBHOOK_REQUIRE_DELIVERY_ID` (default: `true`)
    - `RUNTIME_SCM_WEBHOOK_DELIVERY_TTL_SECONDS` (default: `86400`)
- `DEPLOY_*`:
  - SSH/host/deploy path settings for remote sync and compose execution.
- `TF_*` and `TF_VAR_*`:
  - Terraform and provider inputs used by plan/apply/destroy workflows.
  - Some are exported during workflow execution (for example from `DEPLOY_SSH_PRIVATE_KEY`).

## 2. Normal Deployment Flow (No Manual Steps)

1. Merge code to `main`.
2. If API release is published, `publish-image.yml` builds and pushes image to GHCR.
3. `publish-image.yml` dispatches `deploy-runtime.yml` (`repository_dispatch`).
4. `deploy-runtime.yml`:
   - resolves image reference,
   - renders `infrastructure/deploy/runtime/.env.template`,
   - validates runner and remote deploy prerequisites (`ssh`, `rsync`, `envsubst`, `curl`, `jq`, `base64`, `docker`, `docker compose`, writable runtime path),
   - syncs runtime files to server via SSH/`rsync`,
   - runs `docker compose pull` and `docker compose up -d --force-recreate --remove-orphans`,
   - performs post-deploy health check against `https://<RUNTIME_SERVER_NAME>/healthz` with retries.

Use this as the default path for runtime updates.

## 3. Manual Runtime Deploy (When Needed)

Use this when you need to redeploy a specific image tag or force runtime refresh without waiting for automatic dispatch.

1. Open GitHub Actions -> `Deploy Runtime`.
2. Click `Run workflow`.
3. Use:
   - `image_tag`: tag that already exists in GHCR (example: `v0.0.5`)
   - `reason`: audit note explaining why manual deploy is required
4. Run in `main` (or `master`).

Expected result:

- Workflow ends green.
- Remote compose stack is recreated with the selected image tag.
- Post-deploy health check passes (`/healthz` returns `200`).

## 4. Manual Infrastructure Apply (When Needed)

Use this for infrastructure operations that should not wait for a push trigger, or when you need explicit replacement override.

1. Open GitHub Actions -> `Terraform Apply`.
2. Click `Run workflow`.
3. Fill:
   - `reason` (required)
   - `allow_instance_replacement` (default `false`)
4. Run from `main` (recommended for deterministic state and auditability).

### 4.1 Replacement Guard Behavior

By default, apply is protected:

- If the plan requires replacing `aws_lightsail_instance`, apply fails.
- This avoids accidental host recreation, SSH host key changes, and first-boot reprovision side effects.

### 4.2 Intentional Replacement (Bypass Procedure)

Only when replacement is explicitly desired:

1. Re-run `Terraform Apply` manually.
2. Set `allow_instance_replacement=true`.
3. Keep a clear `reason` describing the change (example: `bundle_id resize`).

Typical replacement causes:

- `blueprint_id` changes
- `bundle_id` changes
- `key_pair_name` changes
- `user_data` changes
- Other `ForceNew` attributes in `aws_lightsail_instance`

## 5. Infrastructure Destroy (Emergency or Reset)

`Terraform Destroy` is intentionally manual and guarded.

1. Open GitHub Actions -> `Terraform Destroy`.
2. Click `Run workflow`.
3. Input must be exactly:

```text
destroy-development
```

4. Run from `main` or `master` (required by workflow condition).
5. Approve any environment protection gate if configured (`development-destroy`).

Expected result:

- Compute resources for development are destroyed.
- Runtime on that host is lost because the host no longer exists.

## 6. Post-Operation Verification Checklist

After runtime deploy:

1. `Deploy Runtime` workflow green.
2. HTTPS health responds:

```bash
curl -fsS https://<RUNTIME_SERVER_NAME>/healthz
```

3. API health through edge:

```bash
curl -fsS https://<RUNTIME_SERVER_NAME>/api/health
```

4. Optional on server:

Use the effective `DEPLOY_RUNTIME_PATH` configured in GitHub environment variables (default: `/srv/deploy/ai-pr-sentinel/runtime`).

```bash
cd <DEPLOY_RUNTIME_PATH>
docker compose ps
docker compose logs --tail=100 nginx
docker compose logs --tail=100 api
```

After Terraform apply:

1. `Terraform Apply` workflow green.
2. Review apply summary (`Resources: X added, Y changed, Z destroyed`).
3. Confirm outputs include expected static IP and instance name.
4. If instance was replaced intentionally, refresh local SSH known_hosts entry.

## 7. Rollback Basics

Runtime rollback (preferred first action):

1. Run `Deploy Runtime` manually.
2. Deploy the previous stable `image_tag` (for example `v0.0.9`).
3. Confirm the workflow health check step is green.
4. Confirm externally:

```bash
curl -fsS https://<RUNTIME_SERVER_NAME>/healthz
```

Infrastructure rollback:

1. Revert Terraform code in Git.
2. Run `Terraform Apply` from reverted state.
3. If rollback implies instance replacement, set `allow_instance_replacement=true`.

## 8. Common Failure Cases

- `Missing secrets.DEPLOY_SSH_PRIVATE_KEY`:
  - Add the secret in GitHub (`Repository` or `Environment` where workflow runs).
- `rsync: command not found` during workflow:
  - If reported by runner preflight, verify runner image/toolchain.
  - If reported by remote preflight, ensure host bootstrap installs `rsync`.
- Terraform plan/apply blocked by replacement guard:
  - Use manual `Terraform Apply` with `allow_instance_replacement=true` only if intended.
- `publish-image` fails dispatching `deploy-runtime-development` (GitHub API `403`/`5xx`):
  - Confirm workflow token permissions include `contents: write`.
  - Re-run failed job (workflow includes retry with backoff for dispatch).
- Deploy workflow fails on health check:
  - Inspect remote status/logs:

```bash
cd <DEPLOY_RUNTIME_PATH>
docker compose ps
docker compose logs --tail=200 nginx
docker compose logs --tail=200 api
```

  - After fix, re-run `Deploy Runtime` manually with same `image_tag`.
- Webhook delivery works on root URL but fails on `/webhooks/github`:
  - Verify GitHub webhook `Payload URL` exactly matches runtime route and signature secret.
