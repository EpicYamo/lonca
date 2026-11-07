#!/bin/sh
# Nginx'in kullanacağı sertifikayı seçer. Let's Encrypt sertifikası varsa onu, yoksa geçici (kendinden imzalı)
# bir sertifikayı /etc/nginx/ssl/etkin'e bağlar; böylece Nginx sertifika alınmadan da açılır (80'deki ACME
# doğrulaması için gerekir). Açılışta arkada bir döngü başlatır: 5 dakikada bir bakar, sertifika değiştiyse
# ya da 12 saat geçtiyse (certbot yenilemiş olabilir) Nginx'i yeniden yükler.
#   Elle: docker compose -f docker-compose.yml -f docker-compose.sunucu.yml exec nginx /docker-entrypoint.d/40-lonca-sertifika.sh yenile
set -eu
ALAN="${LONCA_ALAN_ADI:?LONCA_ALAN_ADI tanımlı değil}"
ONEK="${LONCA_YOL_ONEKI:-}"
case "$ONEK" in
  "") ;;
  /|/*/|*[!A-Za-z0-9/_-]*|//*) echo "lonca: LONCA_YOL_ONEKI '/lonca' biçiminde olmalı (sonda / yok)" >&2; exit 1 ;;
  /*) ;;
  *) echo "lonca: LONCA_YOL_ONEKI '/' ile başlamalı" >&2; exit 1 ;;
esac
LE="/etc/letsencrypt/live/$ALAN"
GECICI=/etc/nginx/ssl/gecici
ETKIN=/etc/nginx/ssl/etkin

# Etkin sertifikayı seçer; bağlantı değiştiyse 0 döner.
sec() {
  if [ -s "$LE/fullchain.pem" ] && [ -s "$LE/privkey.pem" ]; then
    hedef="$LE"
  else
    if [ ! -s "$GECICI/fullchain.pem" ]; then
      mkdir -p "$GECICI"
      openssl req -x509 -nodes -newkey rsa:2048 -days 30 -subj "/CN=$ALAN" \
        -keyout "$GECICI/privkey.pem" -out "$GECICI/fullchain.pem" >/dev/null 2>&1
      echo "lonca: $ALAN için Let's Encrypt sertifikası yok, geçici sertifika kullanılıyor (./docker/sertifika-al.sh)"
    fi
    hedef="$GECICI"
  fi
  onceki=$(readlink "$ETKIN" 2>/dev/null || true)
  ln -sfn "$hedef" "$ETKIN"
  [ "$onceki" != "$hedef" ]
}

if [ "${1:-}" = "yenile" ]; then
  sec || true
  nginx -s reload
  echo "lonca: Nginx yeniden yüklendi, sertifika: $(readlink "$ETKIN")"
  exit 0
fi

sec || true
(
  sayac=0
  while sleep 300; do
    sayac=$((sayac + 1))
    if sec || [ "$sayac" -ge 144 ]; then
      sayac=0
      nginx -s reload 2>/dev/null || true
    fi
  done
) &
