#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

DEFAULT_PROVIDER="github"
DEFAULT_PORT="3000"
ENV_FILE="${ENV_FILE:-${REPO_ROOT}/apps/api/.env}"
WEBHOOK_TUNNEL_URL_ENV_VAR="WEBHOOK_TUNNEL_URL"
WEBHOOK_TUNNEL_PATH_ENV_VAR="WEBHOOK_TUNNEL_PATH"
SCM_PROVIDER_ENV_VAR="SCM_PROVIDER"
API_PORT_ENV_VAR="API_PORT"
DRY_RUN_ENV_VAR="WEBHOOK_TUNNEL_DRY_RUN"

trim_wrapping_quotes() {
  local value="$1"
  if [[ "${value}" == \"*\" && "${value}" == *\" ]]; then
    printf '%s' "${value:1:-1}"
    return
  fi

  if [[ "${value}" == \'*\' && "${value}" == *\' ]]; then
    printf '%s' "${value:1:-1}"
    return
  fi

  printf '%s' "${value}"
}

read_env_value() {
  local key="$1"
  local filePath="$2"

  if [[ ! -f "${filePath}" ]]; then
    return 1
  fi

  local line
  line="$(grep -E "^${key}=" "${filePath}" | tail -n 1 || true)"
  if [[ -z "${line}" ]]; then
    return 1
  fi

  local value="${line#*=}"
  value="${value%$'\r'}"
  value="$(trim_wrapping_quotes "${value}")"
  printf '%s' "${value}"
}

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is required to run the webhook tunnel helper." >&2
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "env file not found: ${ENV_FILE}" >&2
  exit 1
fi

provider="$(read_env_value "${SCM_PROVIDER_ENV_VAR}" "${ENV_FILE}" || true)"
provider="${provider:-${DEFAULT_PROVIDER}}"

port="$(read_env_value "${API_PORT_ENV_VAR}" "${ENV_FILE}" || true)"
port="${port:-${DEFAULT_PORT}}"

tunnelUrl="$(read_env_value "${WEBHOOK_TUNNEL_URL_ENV_VAR}" "${ENV_FILE}" || true)"
if [[ -z "${tunnelUrl}" ]]; then
  echo "${WEBHOOK_TUNNEL_URL_ENV_VAR} is required in ${ENV_FILE}" >&2
  exit 1
fi

tunnelPath="$(read_env_value "${WEBHOOK_TUNNEL_PATH_ENV_VAR}" "${ENV_FILE}" || true)"
tunnelPath="${tunnelPath:-/webhooks/${provider}}"

echo "Starting webhook tunnel"
echo "provider: ${provider}"
echo "url: ${tunnelUrl}"
echo "path: ${tunnelPath}"
echo "port: ${port}"

dryRunValue="${WEBHOOK_TUNNEL_DRY_RUN:-}"
if [[ -z "${dryRunValue}" ]]; then
  dryRunValue="$(read_env_value "${DRY_RUN_ENV_VAR}" "${ENV_FILE}" || true)"
fi

if [[ "${dryRunValue}" == "true" ]]; then
  echo "dry-run enabled; skipping smee client startup."
  exit 0
fi

pnpm dlx smee-client --url "${tunnelUrl}" --path "${tunnelPath}" --port "${port}"
