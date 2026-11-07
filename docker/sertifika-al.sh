#!/usr/bin/env bash
# İlk Let's Encrypt sertifikasını alır ve Nginx'e yükletir. Önce:
#   - alan adının DNS A (varsa AAAA) kaydı bu sunucunun genel IP'sini göstermeli,
#   - 80 ve 443 portları dışarıya açık olmalı,
#   - docker compose -f docker-compose.yml -f docker-compose.sunucu.yml up -d çalışıyor olmalı.
# Deneme: SERTIFIKA_DENEME=1 ./docker/sertifika-al.sh  (Let's Encrypt staging; gerçek sınıra takılmaz)
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -f .env ]]; then set -a; . ./.env; set +a; fi
LONCA_ALAN_ADI="${LONCA_ALAN_ADI:-kozmos.itaskira.com}"  # docker-compose.sunucu.yml ile aynı varsayılan
: "${LONCA_EPOSTA:?.env içinde LONCA_EPOSTA tanımlı olmalı (sertifika bildirimleri için)}"
DC=(docker compose -f docker-compose.yml -f docker-compose.sunucu.yml)
EK=()
if [[ "${SERTIFIKA_DENEME:-}" == "1" ]]; then EK+=(--staging); fi

"${DC[@]}" run --rm --entrypoint certbot certbot certonly --webroot -w /var/www/certbot \
  -d "$LONCA_ALAN_ADI" --email "$LONCA_EPOSTA" --agree-tos --no-eff-email --non-interactive ${EK[@]+"${EK[@]}"}
"${DC[@]}" exec nginx /docker-entrypoint.d/40-lonca-sertifika.sh yenile
echo "Hazır: https://$LONCA_ALAN_ADI${LONCA_YOL_ONEKI:-}/api/merhaba"
