# API Docker Image

This folder contains the Docker image definition for `apps/api`.

## Build

```bash
infrastructure/scripts/docker-build.sh
```

## Run with Docker Compose

```bash
docker compose --env-file apps/api/.env up --build -d
```

```bash
docker compose --env-file apps/api/.env logs -f api
```

```bash
docker compose --env-file apps/api/.env down
```

## Push to registry

```bash
TARGET_IMAGE=ghcr.io/<org>/ai-pr-sentinel-api:1.0.0 infrastructure/scripts/docker-push.sh
```
