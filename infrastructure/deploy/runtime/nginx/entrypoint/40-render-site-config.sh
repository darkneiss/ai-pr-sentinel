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

  envsubst '${SERVER_NAME} ${API_UPSTREAM_HOST} ${API_UPSTREAM_PORT} ${NGINX_CLIENT_MAX_BODY_SIZE} ${NGINX_KEEPALIVE_TIMEOUT} ${NGINX_CLIENT_BODY_TIMEOUT} ${NGINX_CLIENT_HEADER_TIMEOUT} ${NGINX_SEND_TIMEOUT} ${NGINX_PROXY_READ_TIMEOUT} ${NGINX_PROXY_SEND_TIMEOUT} ${NGINX_ROBOTS_TAG}' < "$TLS_TEMPLATE_PATH" > "$DEFAULT_CONF_PATH"
  exit 0
fi

envsubst '${SERVER_NAME} ${API_UPSTREAM_HOST} ${API_UPSTREAM_PORT} ${NGINX_CLIENT_MAX_BODY_SIZE} ${NGINX_KEEPALIVE_TIMEOUT} ${NGINX_CLIENT_BODY_TIMEOUT} ${NGINX_CLIENT_HEADER_TIMEOUT} ${NGINX_SEND_TIMEOUT} ${NGINX_PROXY_READ_TIMEOUT} ${NGINX_PROXY_SEND_TIMEOUT} ${NGINX_ROBOTS_TAG}' < "$HTTP_TEMPLATE_PATH" > "$DEFAULT_CONF_PATH"
