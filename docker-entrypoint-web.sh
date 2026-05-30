#!/bin/sh
set -e

# Substitui RAILWAY_API_URL no template nginx usando sed (sem problemas de quoting do envsubst)
API_URL="${RAILWAY_API_URL:-http://api:3333}"

echo "[nginx-startup] API_URL = $API_URL"

sed "s|RAILWAY_API_URL_PLACEHOLDER|$API_URL|g" \
  /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

# Verifica se a substituição funcionou
if grep -q 'RAILWAY_API_URL_PLACEHOLDER' /etc/nginx/conf.d/default.conf; then
  echo "[nginx-startup] ERRO: substituição do placeholder falhou"
  exit 1
fi

echo "[nginx-startup] Config gerada com sucesso"

exec nginx -g 'daemon off;'
