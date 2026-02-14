#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

APP_NAME="${APP_NAME:-${1:-api}}"
IMAGE_NAME="${IMAGE_NAME:-ai-pr-sentinel-${APP_NAME}}"
IMAGE_TAG="${IMAGE_TAG:-local}"
DOCKERFILE_PATH="${REPO_ROOT}/infrastructure/apps/${APP_NAME}/docker/Dockerfile"
BUILD_CONTEXT="${REPO_ROOT}"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is not installed or not available in PATH" >&2
  exit 1
fi

if [[ ! -f "${DOCKERFILE_PATH}" ]]; then
  echo "Dockerfile not found: ${DOCKERFILE_PATH}" >&2
  exit 1
fi

echo "Building ${IMAGE_NAME}:${IMAGE_TAG} using ${DOCKERFILE_PATH}"
docker build \
  --file "${DOCKERFILE_PATH}" \
  --tag "${IMAGE_NAME}:${IMAGE_TAG}" \
  "${BUILD_CONTEXT}"
