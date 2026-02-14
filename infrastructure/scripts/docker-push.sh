#!/usr/bin/env bash

set -euo pipefail

APP_NAME="${APP_NAME:-${1:-api}}"
IMAGE_NAME="${IMAGE_NAME:-ai-pr-sentinel-${APP_NAME}}"
IMAGE_TAG="${IMAGE_TAG:-local}"
SOURCE_IMAGE="${SOURCE_IMAGE:-${IMAGE_NAME}:${IMAGE_TAG}}"
TARGET_IMAGE="${TARGET_IMAGE:-}"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is not installed or not available in PATH" >&2
  exit 1
fi

if [[ -z "${TARGET_IMAGE}" ]]; then
  echo "TARGET_IMAGE is required (example: ghcr.io/org/ai-pr-sentinel-api:1.0.0)" >&2
  exit 1
fi

echo "Tagging ${SOURCE_IMAGE} as ${TARGET_IMAGE}"
docker tag "${SOURCE_IMAGE}" "${TARGET_IMAGE}"

echo "Pushing ${TARGET_IMAGE}"
docker push "${TARGET_IMAGE}"
