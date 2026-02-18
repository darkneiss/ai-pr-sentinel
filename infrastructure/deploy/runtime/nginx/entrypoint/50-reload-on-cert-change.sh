#!/bin/sh
set -eu

if [ "${NGINX_TLS_ENABLED:-false}" != "true" ]; then
  exit 0
fi

CERT_PATH="/etc/letsencrypt/live/${SERVER_NAME}/fullchain.pem"
KEY_PATH="/etc/letsencrypt/live/${SERVER_NAME}/privkey.pem"
RELOAD_INTERVAL_SECONDS="${NGINX_CERT_RELOAD_INTERVAL_SECONDS:-300}"

if ! [ "${RELOAD_INTERVAL_SECONDS}" -ge 1 ] 2>/dev/null; then
  RELOAD_INTERVAL_SECONDS=300
fi

(
  previous_fingerprint=""

  while :; do
    if [ -f "${CERT_PATH}" ] && [ -f "${KEY_PATH}" ]; then
      current_fingerprint="$(
        sha256sum "${CERT_PATH}" "${KEY_PATH}" 2>/dev/null | sha256sum | awk '{print $1}'
      )"

      if [ -n "${current_fingerprint}" ] && [ "${current_fingerprint}" != "${previous_fingerprint}" ]; then
        if [ -n "${previous_fingerprint}" ]; then
          nginx -s reload >/dev/null 2>&1 || true
        fi

        previous_fingerprint="${current_fingerprint}"
      fi
    fi

    sleep "${RELOAD_INTERVAL_SECONDS}"
  done
) &
