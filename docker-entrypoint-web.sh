#!/bin/sh
set -e

# Railway injeta $PORT dinamicamente — nginx precisa escutar nessa porta
PORT="${PORT:-80}"

# API URL para proxy reverso
API_URL="${RAILWAY_API_URL:-http://api:3333}"

echo "[nginx-startup] PORT = $PORT"
echo "[nginx-startup] API_URL = $API_URL"

# Substitui placeholders no template
sed "s|RAILWAY_API_URL_PLACEHOLDER|$API_URL|g" \
  /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

# Substitui a porta de escuta do nginx
sed -i "s|listen 80;|listen $PORT;|g" /etc/nginx/conf.d/default.conf

# Verifica se as substituições funcionaram
if grep -q 'RAILWAY_API_URL_PLACEHOLDER' /etc/nginx/conf.d/default.conf; then
  echo "[nginx-startup] ERRO: substituição de API_URL falhou"
  exit 1
fi

echo "[nginx-startup] Config gerada — porta $PORT, API $API_URL"

exec nginx -g 'daemon off;'
