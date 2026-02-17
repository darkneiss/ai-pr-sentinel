#!/bin/sh
set -eu

DEFAULT_CONF_PATH="/etc/nginx/conf.d/default.conf"
HTTP_TEMPLATE_PATH="/opt/nginx/templates/site-http.conf.template"
TLS_TEMPLATE_PATH="/opt/nginx/templates/site-tls.conf.template"
TLS_FULLCHAIN_PATH="/etc/letsencrypt/live/${SERVER_NAME}/fullchain.pem"
TLS_PRIVKEY_PATH="/etc/letsencrypt/live/${SERVER_NAME}/privkey.pem"

if [ "${NGINX_TLS_ENABLED:-false}" = "true" ]; then
  if [ ! -f "$TLS_FULLCHAIN_PATH" ] || [ ! -f "$TLS_PRIVKEY_PATH" ]; then
    echo "TLS requested but certificate files are missing under /etc/letsencrypt/live/${SERVER_NAME}" >&2
    exit 1
  fi

  envsubst '${SERVER_NAME} ${API_UPSTREAM_HOST} ${API_UPSTREAM_PORT}' < "$TLS_TEMPLATE_PATH" > "$DEFAULT_CONF_PATH"
  exit 0
fi

envsubst '${SERVER_NAME} ${API_UPSTREAM_HOST} ${API_UPSTREAM_PORT}' < "$HTTP_TEMPLATE_PATH" > "$DEFAULT_CONF_PATH"
