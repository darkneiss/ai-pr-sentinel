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

## 2. Normal Deployment Flow (No Manual Steps)

1. Merge code to `main`.
2. If API release is published, `publish-image.yml` builds and pushes image to GHCR.
3. `publish-image.yml` dispatches `deploy-runtime.yml` (`repository_dispatch`).
4. `deploy-runtime.yml`:
   - resolves image reference,
   - renders `infrastructure/deploy/runtime/.env.template`,
   - syncs runtime files to server via SSH/`rsync`,
   - runs `docker compose pull` and `docker compose up -d --force-recreate --remove-orphans`.

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

```bash
cd /srv/deploy/ai-pr-sentinel/runtime
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
2. Deploy the previous stable `image_tag`.

Infrastructure rollback:

1. Revert Terraform code in Git.
2. Run `Terraform Apply` from reverted state.
3. If rollback implies instance replacement, set `allow_instance_replacement=true`.

## 8. Common Failure Cases

- `Missing secrets.DEPLOY_SSH_PRIVATE_KEY`:
  - Add the secret in GitHub (`Repository` or `Environment` where workflow runs).
- `rsync: command not found` on remote host:
  - Ensure bootstrap installed `rsync`, or install it manually on host.
- Terraform plan/apply blocked by replacement guard:
  - Use manual `Terraform Apply` with `allow_instance_replacement=true` only if intended.
- Webhook delivery works on root URL but fails on `/webhooks/github`:
  - Verify GitHub webhook `Payload URL` exactly matches runtime route and signature secret.
