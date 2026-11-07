# Dallar, CI ve APK sürümleri

## Dal akışı

```
feat/… duzelt/… docs/…  ──PR──▶  dev  ──PR (beta)──▶  main  ──PR/birleştirme──▶  build  ──▶  APK GitHub Release
```

| Dal | Ne için | CI |
| --- | --- | --- |
| `feat/…`, `duzelt/…`, `docs/…` | Tek bir iş | Zorunlu değil |
| `dev` | Deneyler ve birleştirme alanı | Zorunlu değil (push'ta çalışmaz) |
| `main` | Beta sürüm: `dev`'den PR ile gelir | Her PR'da ve her push'ta tam CI |
| `build` | Yayın: `main`'den PR ile gelir | Her PR'da tam CI; push'ta tam CI + APK Release |

- `dev`'e doğrudan ya da PR ile istediğin gibi itebilirsin; CI ancak `dev → main` PR'ı açılınca devreye girer.
- `main` → `build` birleştirmesi `apk-1.0.<commit sayısı>` etiketli bir GitHub Release üretir. Sürüm numarası
  `android/app/build.gradle`'daki `versionName "1.0." + loncaSurumKodu` ile aynıdır.
- Dal korumasını (Settings → Branches) `main` ve `build` için açıp aşağıdaki işleri "required status checks" yapmak
  önerilir; bunun için depoda yönetici yetkisi gerekir.

## CI işleri (`.github/workflows/ci.yml`)

| İş | Ne denetler |
| --- | --- |
| Test (Node 20.19, 22) | `npm test`: API, yetki, doğrulama, kalfa denetimi |
| Lint, biçim ve tutarlılık | `npm run lint` (ESLint), `npm run format:check` (Prettier), `npm run denetle` (veri ve modül sözleşmesi, depoya girmemesi gereken dosyalar), `node --check`, `bash -n apk.sh` |
| Uçtan uca | `npm run test:e2e`, Playwright Chromium ile |
| Erişilebilirlik | `npm run test:erisim`: axe-core (WCAG 2.2 AA), klavye yolu, büyük yazı, Playwright Chromium ile |
| Bağımlılık denetimi | `npm audit --omit=dev --audit-level=high` engeller; tüm bağımlılıklar için `npm audit` yalnızca uyarır |
| Sır taraması | gitleaks, tüm git geçmişi üzerinde |
| Docker | İmaj derlenir, konteyner açılır: `/api/merhaba`, imajın HEALTHCHECK komutu, `/api/eserler`, statik yollar; ardından `LONCA_API_ANAHTARI` ile 401/200 denetimi |
| Android | JDK 21 + Android SDK ile `./apk.sh` (debug); APK 7 gün artefakt olarak saklanır |

Yerelde aynı denetimler:

```bash
npm run lint
npm run format:check
npm run denetle
npm test
```

Prettier şimdilik yalnızca yeni yapılandırma dosyalarını denetler; mevcut kaynak klasörleri `.prettierignore`'da.
Açık dallar birleşince `npm run format` ile toplu biçimlendirme ayrı bir commit'te yapılıp bu satırlar kaldırılabilir.

## APK sürümü (`.github/workflows/apk-surumu.yml`)

`build`'e push → CI'ın tamamı (yeniden kullanılır) → `./apk.sh --release` → GitHub Release (`.apk` + `.sha256`).
Elle tetiklemek için: Actions → "APK sürümü" → Run workflow.

### Gerekli sırlar

Settings → Secrets and variables → Actions. Değerler hiçbir zaman depoya ya da iş akışına yazılmaz.

| Ad | Tür | Açıklama |
| --- | --- | --- |
| `ANDROID_KEYSTORE_BASE64` | Secret | İmza anahtarı (`lonca.keystore`), base64. Alias `lonca` olmalı. |
| `ANDROID_KEYSTORE_SIFRE` | Secret | Anahtar deposu şifresi; anahtar şifresi de aynıdır (`apk.sh` böyle bekler). |
| `LONCA_API_ANAHTARI` | Secret, isteğe bağlı | Sunucu anahtar istiyorsa APK'ya gömülür. Release'i görebilen herkes APK'dan okuyabilir. |
| `LONCA_SUNUCU_URL` | Variable, isteğe bağlı | APK'nın bağlanacağı tek sunucu. Boşsa `apk.sh` varsayılanı `https://kozmos.42.fr`. Uygulama ağ taraması yapmaz. |

İmza sırları yoksa iş akışı durmaz, **debug** APK yayımlar ve bunu sürüm notuna yazar. Güncellemelerin telefona
üstüne kurulabilmesi için hep aynı anahtar kullanılmalı.

Mevcut yerel anahtarı (`./apk.sh --release` ilk seferde `mobil/anahtar/` altında üretir) sır olarak eklemek:

```bash
gh secret set ANDROID_KEYSTORE_BASE64 < <(base64 -i mobil/anahtar/lonca.keystore)
gh secret set ANDROID_KEYSTORE_SIFRE < mobil/anahtar/sifre.txt
```

Yeni bir anahtar üretmek için:

```bash
keytool -genkeypair -keystore lonca.keystore -alias lonca -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Lonca, OU=Kozmos, O=Lonca, C=TR"
```
