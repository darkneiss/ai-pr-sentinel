# Runtime Compose Stack

This stack runs:

- `api` (AI-PR-Sentinel API container),
- `nginx` reverse proxy on `80/443`,
- `certbot` utility container to issue/renew Let's Encrypt certificates.

## Location

`infrastructure/deploy/runtime/`

This keeps runtime deployment manifests separate from:

- Terraform provisioning (`infrastructure/terraform/`),
- Docker image build definition (`infrastructure/apps/api/docker/`).

## Files

- `docker-compose.yml`: production runtime stack
- `.env.example`: compose-level variables
- `api.env.example`: API container variables
- `nginx/templates/site-http.conf.template`: HTTP mode
- `nginx/templates/site-tls.conf.template`: TLS mode with security headers
- `nginx/entrypoint/40-render-site-config.sh`: renders active Nginx config

## First Run (HTTP mode)

```bash
cd infrastructure/deploy/runtime
cp .env.example .env
cp api.env.example api.env

docker compose up -d
docker compose ps
curl -I http://127.0.0.1
```

## Issue Let's Encrypt Certificate

Ensure `SERVER_NAME` resolves to this server public IP first.

```bash
cd infrastructure/deploy/runtime

docker compose run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  --email "$LETSENCRYPT_EMAIL" \
  --agree-tos --no-eff-email \
  -d "$SERVER_NAME"
```

## Enable TLS

1. Set `NGINX_TLS_ENABLED=true` in `.env`
2. Reload stack:

```bash
docker compose up -d nginx
docker compose ps
curl -I https://"$SERVER_NAME"
```

## Renewal (manual command)

```bash
cd infrastructure/deploy/runtime
docker compose run --rm certbot renew --webroot -w /var/www/certbot
docker compose restart nginx
```
