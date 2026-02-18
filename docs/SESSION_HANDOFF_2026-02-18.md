# Session Handoff - 2026-02-18

## Branch and Scope
- Working branch: `feat/terraform-deploy-foundation`
- Scope covered: Terraform + runtime deploy pipeline (Lightsail host already tested), Nginx/Certbot automation, runtime CD workflow.

## Current Infra/Deploy Status
- Terraform (development environment) is already wired to HCP Terraform and AWS OIDC workflows.
- Runtime stack lives in `infrastructure/deploy/runtime`.
- Automatic TLS lifecycle is implemented:
  - `certbot-init` (initial issue),
  - `certbot-renew` loop,
  - Nginx reload-on-cert-change hook.
- Nginx ingress routing currently:
  - `GET /` -> 200 edge status,
  - `GET /healthz` -> 200,
  - `POST /webhooks/github` -> proxied to API,
  - `/api/*` -> proxied to API,
  - other paths -> 404.

## Runtime CI/CD Implemented
- New workflow: `.github/workflows/deploy-runtime.yml`
  - syncs runtime files to server,
  - renders remote `.env` from repo template + GitHub vars/secrets,
  - runs `docker compose pull`,
  - runs `docker compose up -d --force-recreate --remove-orphans`.
- `publish-image.yml` triggers runtime deploy via `repository_dispatch` after publishing image tags.
- Deploy workflow updates `API_IMAGE` to the release tag before compose up.

## Decision Point Resolution (2026-02-18 continuation)
- Runtime config now follows template-render strategy:
  - `infrastructure/deploy/runtime/.env.template` is the canonical deploy template in repo,
  - workflow injects runtime values from GitHub `vars`,
  - workflow injects sensitive values from dedicated GitHub `secrets`,
  - legacy single-secret `RUNTIME_ENV_FILE` flow was removed from docs/workflow.

## Remaining Work
1. Populate new GitHub Environment variables/secrets required by `deploy-runtime.yml` (`RUNTIME_SERVER_NAME`, `RUNTIME_SCM_TOKEN`, `RUNTIME_SCM_WEBHOOK_SECRET`, `RUNTIME_LLM_API_KEY`, etc.).
2. Execute one manual `workflow_dispatch` deploy to validate end-to-end rendering in GitHub-hosted execution.

## Working Tree Snapshot (Uncommitted)
- Modified:
  - `.github/workflows/publish-image.yml`
  - `.gitignore`
  - `docs/AI_CONTEXT.md`
  - `infrastructure/deploy/runtime/.env.example`
  - `infrastructure/deploy/runtime/README.md`
  - `infrastructure/deploy/runtime/docker-compose.yml`
  - `infrastructure/deploy/runtime/nginx/templates/site-http.conf.template`
  - `infrastructure/deploy/runtime/nginx/templates/site-tls.conf.template`
  - `infrastructure/terraform/README.md`
- Added:
  - `.github/workflows/deploy-runtime.yml`
  - `infrastructure/deploy/runtime/.env.template`
  - `infrastructure/deploy/runtime/nginx/entrypoint/50-reload-on-cert-change.sh`
- Deleted:
  - `infrastructure/deploy/runtime/api.env.example`

## Validation State
- `actionlint` last run: OK
- `pnpm lint`: OK
- `pnpm test`: OK (100% coverage maintained in `apps/api`)
- `pnpm --filter api architecture:check`: OK
