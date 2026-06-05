#!/bin/sh
set -e

# Railway injeta $PORT dinamicamente — nginx precisa escutar nessa porta
PORT="${PORT:-80}"

# URL da API — definida no docker-compose.yml ou injetada pelo Railway
API_URL="${RAILWAY_API_URL:-http://api:3333}"

echo "[nginx-startup] PORT = $PORT"
echo "[nginx-startup] API_URL = $API_URL"

# ── Estratégia de proxy_pass por ambiente ─────────────────────────────────────
#
# A distinção é pelo esquema da URL:
#   http://  → Docker Compose local (hostname interno "api")
#              Usa resolver 127.0.0.11 valid=300s + variável nginx $upstream.
#              valid=300s: nginx re-resolve "api" a cada 5 min.
#              Após reinício do Docker Desktop (novo IP no container api),
#              auto-heals em ≤ 300s sem "docker compose restart web".
#              Problema anterior: valid=10s (TTL padrão do Docker DNS) causava
#              502s intermitentes por re-resolução muito frequente em DNS instável.
#
#   https:// → Railway production (domínio público estável)
#              Usa proxy_pass estático — domínio Railway nunca muda de IP.
#
# Escaping: \$ nas strings single-quoted garante que sed passe $ literal ao nginx
# (em BusyBox sed, \$ no replacement = $ literal). O shell não expande $upstream
# de dentro do valor da variável porque isso não ocorre após expansão de parâmetro.

case "$API_URL" in
  http://*)
    echo "[nginx-startup] Modo: Docker Compose local — resolver dinâmico valid=300s"
    RESOLVER_DIRECTIVE='resolver 127.0.0.11 valid=300s ipv6=off;'
    UPSTREAM_SET='set \$upstream '"$API_URL"';'   # nginx var + URL shell
    PROXY_PASS_URL='\$upstream'
    ;;
  https://*)
    echo "[nginx-startup] Modo: Railway — proxy_pass estático"
    RESOLVER_DIRECTIVE=''
    UPSTREAM_SET=''
    PROXY_PASS_URL="$API_URL"
    ;;
  *)
    echo "[nginx-startup] AVISO: API_URL inesperada ($API_URL) — usando como proxy_pass estático"
    RESOLVER_DIRECTIVE=''
    UPSTREAM_SET=''
    PROXY_PASS_URL="$API_URL"
    ;;
esac

# Copia template e aplica as três substituições em sequência.
# Três sed separados evitam race conditions e tornam cada passo rastreável.
cp /etc/nginx/templates/default.conf.template /etc/nginx/conf.d/default.conf

sed -i "s|RESOLVER_DIRECTIVE_PLACEHOLDER|$RESOLVER_DIRECTIVE|g"  /etc/nginx/conf.d/default.conf
sed -i "s|UPSTREAM_SET_PLACEHOLDER|$UPSTREAM_SET|g"              /etc/nginx/conf.d/default.conf
sed -i "s|PROXY_PASS_URL_PLACEHOLDER|$PROXY_PASS_URL|g"          /etc/nginx/conf.d/default.conf

# Substitui a porta de escuta do nginx
sed -i "s|listen 80;|listen $PORT;|g" /etc/nginx/conf.d/default.conf

# Verifica se todos os placeholders foram substituídos
if grep -q 'RESOLVER_DIRECTIVE_PLACEHOLDER\|UPSTREAM_SET_PLACEHOLDER\|PROXY_PASS_URL_PLACEHOLDER' \
    /etc/nginx/conf.d/default.conf; then
  echo "[nginx-startup] ERRO: substituição de placeholders falhou"
  exit 1
fi

echo "[nginx-startup] Config final — porta $PORT, modo $(echo $API_URL | cut -d: -f1)"
grep -E 'resolver|set \$|proxy_pass' /etc/nginx/conf.d/default.conf | grep -v '#' | head -5 || true

exec nginx -g 'daemon off;'
