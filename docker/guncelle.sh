#!/usr/bin/env bash
# Sunucudaki Lonca'yı GitHub'dan günceller ve yeniden başlatır (Cloudflare Tunnel kurulumu).
#   cd /opt/lonca && ./docker/guncelle.sh            # varsayılan dal: dev
#   LONCA_DAL=main ./docker/guncelle.sh
# Depo salt okunur bir deploy anahtarıyla klonlanmış olmalı (README → "Internet deployment behind Cloudflare").
#
# Dikkat: data/ ve public/medya/ hem depoda hem çalışma verisi. Studio'da sunucuda yapılan yayın/düzenlemeler
# bu dosyaları değiştirir. Öyle bir değişiklik varsa betik hiçbir şeyin üzerine yazmaz, durur ve listeler.
set -euo pipefail
cd "$(dirname "$0")/.."
DAL="${LONCA_DAL:-dev}"
DC=(docker compose -p lonca -f docker-compose.yml -f docker-compose.cloudflare.yml)

[[ -f .env ]] || { echo "✗ .env yok" >&2; exit 1; }
if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo "✗ Sunucuda commit'lenmemiş değişiklik var; üzerine yazılmasın diye güncelleme durdu:" >&2
  git status --short --untracked-files=no >&2
  echo "  İçerik Studio'da düzenlendiyse önce bu değişiklikleri depoya taşı, sonra tekrar çalıştır." >&2
  exit 1
fi
git fetch origin "$DAL"
git checkout -q "$DAL"
ONCE=$(git rev-parse --short HEAD)
git merge --ff-only "origin/$DAL"
SONRA=$(git rev-parse --short HEAD)
# Container "node" kullanıcısıyla (uid 1000) çalışır; bağlanan klasörlere yazabilmeli.
chown -R 1000:1000 data public/medya 2>/dev/null || true
"${DC[@]}" up -d --build
echo "✓ $DAL: $ONCE → $SONRA"
for i in $(seq 1 30); do
  if "${DC[@]}" exec -T lonca node -e "fetch('http://127.0.0.1:3000/api/merhaba').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))" 2>/dev/null; then
    echo "✓ Lonca yanıt veriyor"; exit 0
  fi
  sleep 2
done
echo "✗ Lonca 60 sn içinde yanıt vermedi: ${DC[*]} logs lonca" >&2
exit 1
