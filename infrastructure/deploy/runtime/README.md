# Runtime Compose Stack

This stack runs:

- `api` (AI-PR-Sentinel API container),
- `certbot-init` one-shot service to request the first Let's Encrypt certificate,
- `nginx` reverse proxy on `80/443` with TLS and security headers,
- `certbot-renew` background renewal loop,
- `certbot` utility container for ad-hoc operations.

## Location

`infrastructure/deploy/runtime/`

This keeps runtime deployment manifests separate from:

- Terraform provisioning (`infrastructure/terraform/`),
- Docker image build definition (`infrastructure/apps/api/docker/`).

## Files

- `docker-compose.yml`: runtime stack
- `.env.template`: CI/CD template rendered into deploy-time `.env`
- `.env.example`: compose-level variables
- `nginx/templates/site-http.conf.template`: HTTP mode
- `nginx/templates/site-tls.conf.template`: TLS mode with security headers
- `nginx/entrypoint/40-render-site-config.sh`: renders active Nginx config
- `nginx/entrypoint/50-reload-on-cert-change.sh`: reloads Nginx when certificate files change

## First Run (Automatic HTTPS)

Ensure `SERVER_NAME` resolves to this server public IP first.

```bash
cd infrastructure/deploy/runtime
cp .env.example .env

docker compose up -d
docker compose ps
curl -I https://"$SERVER_NAME"
```

What happens automatically:

- `certbot-init` requests the initial certificate using HTTP-01 standalone mode.
- `nginx` starts only after `certbot-init` succeeds (when `NGINX_TLS_ENABLED=true`).
- `certbot-renew` runs renew checks periodically.
- `nginx` auto-reloads when cert files are updated.

If DNS is not propagated yet, check:

```bash
docker compose logs certbot-init
```

For local/no-DNS tests, set `NGINX_TLS_ENABLED=false` in `.env`.

## Ingress Routes

- `GET /` -> `200` from Nginx (edge status), both HTTP and HTTPS.
- `GET /healthz` -> `200` from Nginx.
- `POST /webhooks/github` -> proxied to API webhook endpoint.
- `/api/*` -> proxied to API (`/api/health` reaches API `/health`).
- Any other route -> `404` from Nginx.

## Optional Manual Certbot Commands

You can still run ad-hoc certbot commands through the utility profile:

```bash
docker compose run --rm --profile ops certbot certificates
```

## CI/CD Runtime Deploy

Workflow:

- `.github/workflows/deploy-runtime.yml`

What it does:

- syncs `infrastructure/deploy/runtime/` to the server (excluding `.env` and certbot state),
- renders `.env` from `infrastructure/deploy/runtime/.env.template` using GitHub `vars` + `secrets`,
- runs `docker compose pull`,
- runs `docker compose up -d --force-recreate --remove-orphans`.

Trigger modes:

- automatic via `repository_dispatch` from `.github/workflows/publish-image.yml` after a new image is published,
- manual via `workflow_dispatch` with `image_tag` input.

Required GitHub configuration (Environment `development` recommended):

- Variables:
  - `DEPLOY_HOST`
  - `DEPLOY_PORT` (optional, default `22`)
  - `DEPLOY_USER` (optional, default `deploy`)
  - `DEPLOY_RUNTIME_PATH` (optional, default `/srv/deploy/ai-pr-sentinel/runtime`)
  - `RUNTIME_SERVER_NAME` (required)
  - `RUNTIME_LETSENCRYPT_EMAIL` (required when `RUNTIME_NGINX_TLS_ENABLED=true`)
  - Optional runtime overrides:
    - `RUNTIME_API_PORT` (default `3000`)
    - `RUNTIME_NGINX_TLS_ENABLED` (default `true`)
    - `RUNTIME_CERTBOT_STAGING` (default `false`)
    - `RUNTIME_CERTBOT_RENEW_INTERVAL_SECONDS` (default `43200`)
    - `RUNTIME_NGINX_CLIENT_MAX_BODY_SIZE` (default `100m`)
    - `RUNTIME_NGINX_KEEPALIVE_TIMEOUT` (default `5s`)
    - `RUNTIME_NGINX_CLIENT_BODY_TIMEOUT` (default `10s`)
    - `RUNTIME_NGINX_CLIENT_HEADER_TIMEOUT` (default `10s`)
    - `RUNTIME_NGINX_SEND_TIMEOUT` (default `10s`)
    - `RUNTIME_NGINX_PROXY_READ_TIMEOUT` (default `300s`)
    - `RUNTIME_NGINX_PROXY_SEND_TIMEOUT` (default `300s`)
    - `RUNTIME_NGINX_CERT_RELOAD_INTERVAL_SECONDS` (default `300`)
    - `RUNTIME_NGINX_ROBOTS_TAG` (default `noindex, nofollow, noarchive`)
    - `RUNTIME_NODE_ENV` (default `production`)
    - `RUNTIME_SCM_PROVIDER` (default `github`)
    - `RUNTIME_SCM_BOT_LOGIN` (default `ai-pr-sentinel[bot]`)
    - `RUNTIME_SCM_WEBHOOK_VERIFY_SIGNATURE` (optional override: `true|false`)
    - `RUNTIME_LOG_LEVEL` (default `info`)
    - `RUNTIME_LLM_LOG_RAW_RESPONSE` (default `false`)
    - `RUNTIME_AI_TRIAGE_ENABLED` (default `true`)
    - `RUNTIME_AI_TEMPERATURE` (default `0.1`)
    - `RUNTIME_AI_LABEL_KIND_BUG`
    - `RUNTIME_AI_LABEL_KIND_FEATURE`
    - `RUNTIME_AI_LABEL_KIND_QUESTION`
    - `RUNTIME_AI_LABEL_DOCUMENTATION`
    - `RUNTIME_AI_LABEL_HELP_WANTED`
    - `RUNTIME_AI_LABEL_GOOD_FIRST_ISSUE`
    - `RUNTIME_AI_LABEL_DOCUMENTATION_CONFIDENCE_THRESHOLD`
    - `RUNTIME_AI_LABEL_HELP_WANTED_CONFIDENCE_THRESHOLD`
    - `RUNTIME_AI_LABEL_GOOD_FIRST_ISSUE_CONFIDENCE_THRESHOLD`
    - `RUNTIME_AI_CLASSIFICATION_CONFIDENCE_THRESHOLD`
    - `RUNTIME_AI_SENTIMENT_CONFIDENCE_THRESHOLD`
    - `RUNTIME_AI_DUPLICATE_SIMILARITY_THRESHOLD`
    - `RUNTIME_LLM_TIMEOUT`
    - `RUNTIME_LLM_PROVIDER` (default `groq`)
    - `RUNTIME_LLM_MODEL` (default `openai/gpt-oss-20b`)
    - `RUNTIME_LLM_BASE_URL` (default `https://api.groq.com/openai/v1/chat/completions`)
    - `RUNTIME_LANGSMITH_TRACING` (default `false`)
    - `RUNTIME_LANGSMITH_PROJECT` (default `ai-pr-sentinel`)
    - `RUNTIME_LANGSMITH_ENDPOINT` (default `https://api.smith.langchain.com`)
    - `RUNTIME_LANGSMITH_WORKSPACE_ID` (optional)
- Secrets:
  - `RUNTIME_SCM_TOKEN`
  - `RUNTIME_SCM_WEBHOOK_SECRET`
  - `RUNTIME_LLM_API_KEY`
  - `RUNTIME_LANGSMITH_API_KEY` (required when `RUNTIME_LANGSMITH_TRACING=true`)
  - `DEPLOY_SSH_PRIVATE_KEY` (private key for SSH deploy user)
  - `GHCR_DEPLOY_USERNAME` (required if GHCR image is private)
  - `GHCR_DEPLOY_TOKEN` (required if GHCR image is private, `read:packages`)

Remote prerequisites:

- Docker and Docker Compose plugin are installed on the host.

## Relevant `.env` Variables

- `SERVER_NAME`
- `LETSENCRYPT_EMAIL`
- `NGINX_TLS_ENABLED`
- `CERTBOT_STAGING`
- `CERTBOT_RENEW_INTERVAL_SECONDS`
- `NGINX_CLIENT_MAX_BODY_SIZE`
- `NGINX_KEEPALIVE_TIMEOUT`
- `NGINX_CLIENT_BODY_TIMEOUT`
- `NGINX_CLIENT_HEADER_TIMEOUT`
- `NGINX_SEND_TIMEOUT`
- `NGINX_PROXY_READ_TIMEOUT`
- `NGINX_PROXY_SEND_TIMEOUT`
- `NGINX_CERT_RELOAD_INTERVAL_SECONDS`
- `NGINX_ROBOTS_TAG` (default: `noindex, nofollow, noarchive`)
