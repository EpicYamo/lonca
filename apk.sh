#!/usr/bin/env bash
# Lonca Android APK'sını üretir.
#
#   ./apk.sh             → hata ayıklama (debug) APK'sı: dist/lonca.apk
#   ./apk.sh --release   → imzalı sürüm APK'sı (ilk seferde mobil/anahtar/lonca.keystore oluşturulur)
#   ./apk.sh --kur       → derledikten sonra USB/kablosuz bağlı telefona adb ile kurar
#
# Ortam değişkenleri (isteğe bağlı):
#   LONCA_SUNUCU_URL=https://kozmos.itaskira.com   uygulamanın bağlanacağı tek sunucu (varsayılan; .env'den de okunur).
#                                           Yerel deneme için tam adres verilebilir: http://192.168.1.20:3000
#                                           "yok" verilirse sunucu gömülmez, uygulama yalnızca çevrimdışı çalışır
#   LONCA_API_ANAHTARI=...                  sunucu API anahtarı istiyorsa (.env'den de okunur)
#
# Uygulama yalnızca bu adrese bağlanır (ağ taraması yok); ulaşamazsa APK içindeki verilerle çevrimdışı çalışır.
set -euo pipefail
cd "$(dirname "$0")"

TUR=debug
KUR=0
for a in "$@"; do
  case "$a" in
    --release) TUR=release ;;
    --kur|--install) KUR=1 ;;
    -h|--help) sed -n '2,15p' "$0"; exit 0 ;;
    *) echo "Bilinmeyen seçenek: $a" >&2; exit 1 ;;
  esac
done

bilgi() { printf '\033[1;34m▸ %s\033[0m\n' "$*"; }
hata() { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# ---------- Araçlar ----------
command -v node >/dev/null || hata "Node.js gerekli (20.19+)."

if [[ -z "${JAVA_HOME:-}" || ! -x "${JAVA_HOME}/bin/java" ]] || ! "${JAVA_HOME}/bin/java" -version 2>&1 | grep -qE 'version "(2[1-9]|1[7-9])'; then
  JAVA_HOME=""
  for aday in "$(/usr/libexec/java_home -v 21 2>/dev/null || true)" /opt/homebrew/opt/openjdk@21 /usr/local/opt/openjdk@21 \
              /opt/homebrew/opt/openjdk /usr/lib/jvm/java-21-openjdk* /usr/lib/jvm/temurin-21*; do
    if [[ -n "$aday" && -x "$aday/bin/java" ]] && "$aday/bin/java" -version 2>&1 | grep -qE 'version "(2[1-9])'; then JAVA_HOME="$aday"; break; fi
  done
  [[ -n "$JAVA_HOME" ]] || hata "JDK 21 bulunamadı. Kur: brew install openjdk@21"
fi
export JAVA_HOME PATH="$JAVA_HOME/bin:$PATH"

if [[ -z "${ANDROID_HOME:-}" || ! -d "${ANDROID_HOME}" ]]; then
  ANDROID_HOME="${ANDROID_SDK_ROOT:-}"
  for aday in "$HOME/Library/Android/sdk" /opt/homebrew/share/android-commandlinetools /usr/local/share/android-commandlinetools "$HOME/Android/Sdk"; do
    [[ -z "$ANDROID_HOME" && -d "$aday" ]] && ANDROID_HOME="$aday"
  done
  [[ -n "$ANDROID_HOME" ]] || hata "Android SDK bulunamadı. Kur: brew install --cask android-commandlinetools  (sonra: sdkmanager --licenses)"
fi
export ANDROID_HOME ANDROID_SDK_ROOT="$ANDROID_HOME"
[[ -f "$ANDROID_HOME/licenses/android-sdk-license" ]] || hata "Android SDK lisansları kabul edilmemiş. Bir kez çalıştır: sdkmanager --sdk_root=\"$ANDROID_HOME\" --licenses"
echo "sdk.dir=$ANDROID_HOME" > android/local.properties
bilgi "JDK: $JAVA_HOME"
bilgi "Android SDK: $ANDROID_HOME"

[[ -d node_modules/@capacitor/android ]] || { bilgi "Bağımlılıklar kuruluyor"; npm install; }

# ---------- Sunucu: ortam > .env > projenin alan adı ("yok" ise gömülmez) ----------
if [[ -z "${LONCA_SUNUCU_URL:-}" && -f .env ]]; then LONCA_SUNUCU_URL=$(sed -n 's/^LONCA_SUNUCU_URL=//p' .env | tail -n 1); fi
LONCA_SUNUCU_URL="${LONCA_SUNUCU_URL:-https://kozmos.itaskira.com}"
bilgi "Sunucu: $LONCA_SUNUCU_URL"
ANAHTAR_ARG=()
[[ -n "${LONCA_API_ANAHTARI:-}" ]] && ANAHTAR_ARG+=(--anahtar "$LONCA_API_ANAHTARI")

# ---------- Web katmanı + Capacitor ----------
bilgi "Uygulama dosyaları ve çevrimdışı veri hazırlanıyor"
node mobil/hazirla.mjs --sunucu "$LONCA_SUNUCU_URL" ${ANAHTAR_ARG[@]+"${ANAHTAR_ARG[@]}"}
bilgi "Capacitor eşitleniyor"
npx cap sync android

# ---------- Gradle ----------
SURUM_KODU=$(git rev-list --count HEAD 2>/dev/null || echo 1)
GRADLE_ARG=(-PloncaSurumKodu="$SURUM_KODU")
if [[ "$TUR" == release ]]; then
  ANAHTAR=mobil/anahtar/lonca.keystore
  if [[ ! -f "$ANAHTAR" ]]; then
    bilgi "İmza anahtarı oluşturuluyor ($ANAHTAR) — sakla; güncellemeler aynı anahtarla imzalanmalı"
    mkdir -p mobil/anahtar
    # 24 rastgele baytın hex biçimi; head ile sonsuz akışı kesmek pipefail altında SIGPIPE üretiyordu.
    SIFRE=$(od -An -N24 -tx1 /dev/urandom | tr -d '[:space:]')
    keytool -genkeypair -v -keystore "$ANAHTAR" -alias lonca -keyalg RSA -keysize 2048 -validity 10000 \
      -storepass "$SIFRE" -keypass "$SIFRE" -dname "CN=Lonca, OU=Kozmos, O=Lonca, C=TR" >/dev/null 2>&1
    printf '%s' "$SIFRE" > mobil/anahtar/sifre.txt
    chmod 600 "$ANAHTAR" mobil/anahtar/sifre.txt
  fi
  SIFRE=$(cat mobil/anahtar/sifre.txt)
  GRADLE_ARG+=(-PloncaAnahtar="$PWD/$ANAHTAR" -PloncaSifre="$SIFRE")
  GOREV=assembleRelease; CIKTI=android/app/build/outputs/apk/release/app-release.apk
else
  GOREV=assembleDebug; CIKTI=android/app/build/outputs/apk/debug/app-debug.apk
fi

bilgi "APK derleniyor ($TUR)"
( cd android && ./gradlew --no-daemon -q "$GOREV" "${GRADLE_ARG[@]}" )

mkdir -p dist
HEDEF=dist/lonca.apk
[[ "$TUR" == release ]] && HEDEF=dist/lonca-release.apk
cp "$CIKTI" "$HEDEF"
BOYUT=$(du -h "$HEDEF" | cut -f1)
printf '\033[1;32m✓ APK hazır: %s (%s)\033[0m\n' "$HEDEF" "$BOYUT"

if [[ "$KUR" == 1 ]]; then
  ADB="$ANDROID_HOME/platform-tools/adb"; command -v adb >/dev/null && ADB=adb
  bilgi "Telefona kuruluyor"
  "$ADB" install -r "$HEDEF"
  "$ADB" shell monkey -p com.kozmos.lonca -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1 || true
fi
