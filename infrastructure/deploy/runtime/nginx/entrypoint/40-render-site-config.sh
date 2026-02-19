#!/bin/sh
set -eu

DEFAULT_CONF_PATH="/etc/nginx/conf.d/default.conf"
HTTP_TEMPLATE_PATH="/opt/nginx/templates/site-http.conf.template"
TLS_TEMPLATE_PATH="/opt/nginx/templates/site-tls.conf.template"
COMMON_SERVER_TEMPLATE_PATH="/opt/nginx/templates/snippets/runtime-server-common.conf.template"
SNIPPETS_DIR="/etc/nginx/snippets"
COMMON_SERVER_SNIPPET_PATH="$SNIPPETS_DIR/runtime-server-common.conf"
TLS_FULLCHAIN_PATH="/etc/letsencrypt/live/${SERVER_NAME}/fullchain.pem"
TLS_PRIVKEY_PATH="/etc/letsencrypt/live/${SERVER_NAME}/privkey.pem"
SITE_TEMPLATE_VARIABLES='${SERVER_NAME} ${API_UPSTREAM_HOST} ${API_UPSTREAM_PORT} ${NGINX_CLIENT_MAX_BODY_SIZE} ${NGINX_KEEPALIVE_TIMEOUT} ${NGINX_CLIENT_BODY_TIMEOUT} ${NGINX_CLIENT_HEADER_TIMEOUT} ${NGINX_SEND_TIMEOUT} ${NGINX_PROXY_READ_TIMEOUT} ${NGINX_PROXY_SEND_TIMEOUT} ${NGINX_ROBOTS_TAG}'
COMMON_SERVER_TEMPLATE_VARIABLES='${NGINX_CLIENT_MAX_BODY_SIZE} ${NGINX_KEEPALIVE_TIMEOUT} ${NGINX_CLIENT_BODY_TIMEOUT} ${NGINX_CLIENT_HEADER_TIMEOUT} ${NGINX_SEND_TIMEOUT}'

install -m 0755 -d "$SNIPPETS_DIR"
envsubst "$COMMON_SERVER_TEMPLATE_VARIABLES" < "$COMMON_SERVER_TEMPLATE_PATH" > "$COMMON_SERVER_SNIPPET_PATH"

if [ "${NGINX_TLS_ENABLED:-false}" = "true" ]; then
  if [ ! -f "$TLS_FULLCHAIN_PATH" ] || [ ! -f "$TLS_PRIVKEY_PATH" ]; then
    echo "TLS requested but certificate files are missing under /etc/letsencrypt/live/${SERVER_NAME}" >&2
    exit 1
  fi

  envsubst "$SITE_TEMPLATE_VARIABLES" < "$TLS_TEMPLATE_PATH" > "$DEFAULT_CONF_PATH"
  exit 0
fi

envsubst "$SITE_TEMPLATE_VARIABLES" < "$HTTP_TEMPLATE_PATH" > "$DEFAULT_CONF_PATH"
