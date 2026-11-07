#!/usr/bin/env bash
# Sunucudaki Lonca'yı GitHub'dan günceller ve yeniden başlatır (Cloudflare Tunnel kurulumu).
#   cd /opt/lonca && ./docker/guncelle.sh            # varsayılan dal: dev
#   LONCA_DAL=main ./docker/guncelle.sh
# Depo salt okunur bir deploy anahtarıyla klonlanmış olmalı (README → "Internet deployment behind Cloudflare").
#
# data/ ve public/medya/ hem depoda hem çalışma verisi: Studio sunucuda modül yayınlar, düzenler, siler.
# Betik bu değişiklikleri korur: önce data/'nın tamamını /opt/lonca-yedek/<zaman>/'a yedekler, değişiklikleri
# kenara alır (git stash), dalı ilerletir, sonra geri koyar. GitHub'dan gelenle aynı dosyanın aynı yeri
# çakışırsa hiçbir şeyin üzerine yazmaz: eski hale döner, durur ve yedeğin yerini söyler.
# Kod dosyalarında (data/ ve public/medya/ dışı) değişiklik varsa hiç başlamaz.
set -euo pipefail
cd "$(dirname "$0")/.."
DAL="${LONCA_DAL:-dev}"
DC=(docker compose -p lonca -f docker-compose.yml -f docker-compose.cloudflare.yml)

[[ -f .env ]] || { echo "✗ .env yok" >&2; exit 1; }
VERI=(data public/medya)
KOD_DEGISIKLIGI=$(git status --porcelain --untracked-files=no -- . ':!data' ':!public/medya')
if [[ -n "$KOD_DEGISIKLIGI" ]]; then
  echo "✗ Sunucuda kod dosyalarında commit'lenmemiş değişiklik var; güncelleme durdu:" >&2
  echo "$KOD_DEGISIKLIGI" >&2
  exit 1
fi
git fetch origin "$DAL"
git checkout -q "$DAL"
ONCE=$(git rev-parse --short HEAD)

# Studio'nun canlı verisi (izlenen dosyalardaki değişiklikler) korunarak ilerle.
STUDIO=$(git status --porcelain --untracked-files=no -- "${VERI[@]}")
if [[ -n "$STUDIO" ]]; then
  YEDEK="${LONCA_YEDEK_DIZINI:-/opt/lonca-yedek}/$(date +%Y%m%d%H%M%S)"
  mkdir -p "$YEDEK" && cp -a data "$YEDEK/"
  echo "▸ Studio'da değişmiş veri korunuyor (yedek: $YEDEK):"
  echo "$STUDIO"
  git stash push -q -m "guncelle: studio verisi $(date -u +%FT%TZ)" -- "${VERI[@]}"
  if ! git merge -q --ff-only "origin/$DAL"; then
    git stash pop -q
    echo "✗ Dal ilerletilemedi (GitHub'dan gelen bir dosya sunucuda yeni oluşmuş bir dosyayla aynı adı taşıyor olabilir). Hiçbir şey değişmedi." >&2
    exit 1
  fi
  if ! git stash pop -q; then
    # Çakışma: GitHub'dan gelen sürüm ile Studio'nun değişikliği aynı yeri değiştirmiş. Eski hale dön, veriyi koru.
    git reset -q --hard "$ONCE"
    git stash pop -q
    echo "✗ Studio'daki değişiklik GitHub'dan gelenle çakıştı; sunucu eski sürümde ($ONCE) bırakıldı, veri yerinde." >&2
    echo "  Çakışan dosyalar: $(git diff --name-only "$ONCE" "origin/$DAL" -- "${VERI[@]}" | tr '\n' ' ')" >&2
    echo "  Yedek: $YEDEK" >&2
    exit 1
  fi
else
  git merge -q --ff-only "origin/$DAL"
fi
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
