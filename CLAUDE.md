# CLAUDE.md

Lonca: vakıf mirası eserleri için yapay zekâ destekli mini uygulama (modül) platformu. KÖK&KOD Hackathon, Takım Kozmos.
Kullanıcı Türkçe yazar; yanıtlar Türkçe olsun.

## Çalışma kuralları (kullanıcının kuralları, pazarlık konusu değil)

1. **Önce projeyi derinlemesine anla, sonra işe başla.** İlgili dosyaları, çağıranları, testleri ve README'yi oku. Bir şeyi değiştirmeden önce nerede kullanıldığını bul (`grep -rn`).
2. **Varsayma, doğrula.** Bir dosyanın, fonksiyonun, alanın, rotanın ya da ortam değişkeninin var olduğunu koddan teyit et. "Çalışıyor" demeden önce çalıştır: `npm test`, sunucuyu açıp ilgili sayfaya/uç noktaya bak. Doğrulayamadığın şeyi doğrulanmış gibi söyleme.
3. **Her iş kendi git dalında.** İşe başlarken `main`'den (ya da kullanıcının söylediği dal) yeni bir dal aç: `feat/…`, `duzelt/…`, `docs/…`. `fix/…` kullanma: uzakta `fix` adlı bir dal var, `fix/…` push edilemez. Yeni bir önek seçmeden önce `git ls-remote --heads origin` ile çakışma olmadığını kontrol et. Doğrudan `main`'e commit atma.
4. **Commit mesajları kısa: yalnızca tek başlık satırı, ayrıntı/gövde yok.** Örnek: `Add dive approval flow`.
5. **Aynı klasörde başka oturumlar da çalışabilir.** Yalnızca işinin gerektirdiği dosyalara dokun; `git add -A` / `git add .` kullanma, dosyaları adıyla ekle. Başkasının yarım değişikliğini commit'leme, geri alma, üzerine yazma.

## Proje kuralları

- **Sırlar depoya girmez.** `.env` gitignore'da; anahtarlar yalnızca `.env`'de durur. Yeni bir ayar eklersen `.env.example`'a açıklamasıyla, değeri boş olarak ekle. API anahtarı tarayıcıya gitmez (istisna: `GOOGLE_HARITA_ANAHTARI`, referrer kısıtıyla).
- **Commit'ten önce `npm test` geçmeli.** Arayüz değişikliğinde sayfayı tarayıcıda açıp gözle doğrula.
- **Tarih uydurulmaz.** Eserlerle ilgili her ad, tarih, kişi bir kaynakta aynen geçmeli. Yüzyıl yalnızca yapım tarihinden gelir (onarım tarihi değil); yoksa `null`. Yaklaşık konum `yaklasik: true` taşır. İçerik işlerinde `.claude/skills/vakif-eseri-icerik` skill'ini kullan.
- **İnsan onayı:** kalfa ve dalış kalfası yalnızca taslak üretir (`durum: "bekliyor"`); yayın editör onayıyla olur (`"onayli"`).
- **Modül sözleşmesi** `sdk/lonca-sdk.d.ts`'dedir. Modül yalnızca `@lonca/sdk` import eder, ağa/DOM'a erişemez, `sahne.ayarla` zorunlu, en çok 2000 satır. SDK'ya düğüm/ekran eklersen `.d.ts`, `sdk/lonca-sdk.js`, `public/app/sahne.js` ve `server/kalfa.js` denetimini birlikte güncelle.
- **Girdi doğrulaması sunucuda** (`server/dogrulama.js`). Yeni bir alan/uç nokta eklerken doğrulamasını ve testini de ekle. Yönetici işlemleri `x-yonetici-sifre` başlığıyla korunur (`server/guvenlik.js`).
- **Adlandırma Türkçe.** Değişken, fonksiyon, dosya ve JSON alanları ASCII Türkçe (`eserler`, `yuzyil`, `tarihce`, `kalfaHazirla`, `dalis-kalfasi.js`); kullanıcıya görünen metin düzgün Türkçe (ç, ğ, ı, ö, ş, ü). Kod yorumları Türkçe.
- **Derleme adımı yok.** Saf ES modülleri (`"type": "module"`), Node ≥ 20.12, tarayıcı tarafı doğrudan `public/`'ten sunulur. TypeScript yalnızca kalfanın tip denetimi için kullanılır. Yeni bağımlılık eklemeden önce gerçekten gerekli mi düşün.
- **Dosya alanları:**
  - `public/studio/`: Studio. Yerleşim mantığı `duzen.js`'de, iş mantığı `studio.js`'de. Varsayılan açık tema + koyu tema anahtarı (`lonca.studio.tema`).
  - `public/app/`: vatandaş uygulaması. `public/ortak/` (özellikle `tasarim.css`) iki tarafça paylaşılır; değiştirmeden önce etkisini iki tarafta da kontrol et.
  - `server/`: API ve kalfalar. `data/`: içerik (JSON). `mobil/` + `android/`: Capacitor paketi.
- **Çalışırken oluşan veriler commit'lenmez:** `data/eser-oneriler.json`, `data/yuklenen/`, `data/eser-gecmisi.json`, `data/gecmis/`, `data/moduller/eski/` (gitignore'da). Büyük kaynaklar (`kitaplar/`, `veri-kaynak/`) depoda değil.
- **Telif:** Bursa metin ve fotoğrafları © Vakıf Katılım (depo bu yüzden özel). Vikipedi/Commons içeriği CC BY-SA; kaynak bağlantısı kayıtta kalır.

## Komutlar

```bash
npm install
cp .env.example .env      # isteğe bağlı; hiçbir ayar olmadan da çalışır
npm run dev               # node --watch server/index.js → http://localhost:3000/app · /studio
npm start                 # izlemesiz
npm test                  # node --test "test/*.test.mjs" (API, doğrulama, kalfa denetimi)
npm run test:e2e          # Playwright ile uçtan uca senaryo (test/e2e/uctan-uca.mjs)
npm run konum             # eser koordinatı bul (-- --dene yalnızca yazdırır)
npm run vendor            # gerçek 3B kütüphanesini esbuild ile yeniden paketle
node araclar/dalis-uret.mjs araclar/dalis/<eser>.json   # elle dalış karelerini üret
node araclar/dalis-modul.mjs <eser-id> …                # dalış tanımını data/dalislar/'a yaz
node mobil/hazirla.mjs [--sunucu http://IP:3000]         # Android web katmanını (mobil/www) hazırla
```

Bu Mac'te Playwright'ın kendi Chromium'u yok; tarayıcı testlerinde `chromium.launch({ channel: "chrome" })` kullan.

## Dış gereksinimler

- Node.js ≥ 20.12.
- Dalış üretimi için: `ffmpeg` ve `ffprobe` PATH'te (`brew install ffmpeg`), `python3` + Pillow (`pip3 install Pillow`). `server/dalis-kalfasi.js` iş başlamadan bunları denetler.
- Veri hattı (`araclar/*.py`) için python3.

## Ortam değişkenleri (`.env`)

| Anahtar | İşlev |
| --- | --- |
| `PORT` | Sunucu portu (varsayılan 3000) |
| `KALFA_SAGLAYICI` | `openai-uyumlu` · `anthropic` · `sahte` |
| `KALFA_API_URL`, `KALFA_API_ANAHTARI`, `KALFA_MODEL` | Modül kalfası uç noktası (Gemini, OpenCode Go, Ollama…) |
| `ANTHROPIC_API_KEY` | `KALFA_SAGLAYICI=anthropic` için |
| `KALFA_SAHTE=1` | Kalfayı hazır şablonla çalıştır (çevrimdışı) |
| `KALFA_SINIR` | IP başına 10 dakikadaki kalfa isteği sınırı |
| `YONETICI_SIFRE` | Studio yönetici şifresi; boşsa geliştirme modu (şifresiz) |
| `GOOGLE_HARITA_ANAHTARI` | Google harita + gerçek 3B; boşsa OpenStreetMap, 3B kapalı |
| `DALIS_API_URL`, `DALIS_API_ANAHTARI` | Dalış kalfası (OpenAI uyumlu, görsel üretebilen uç nokta) |
| `DALIS_MODELLER`, `DALIS_METIN_MODELLERI` | Dalışta sırayla denenen görsel / metin modelleri |
| `USTAGPT_BASE_URL`, `USTAGPT_API_KEY` | Ortak yedek: `DALIS_*` boşsa dalış kalfası, `KALFA_*` boşsa modül kalfası bunu kullanır |
| `LONCA_API_ANAHTARI` | `mobil/hazirla.mjs`'nin mobil pakete koyduğu API anahtarı |

`KALFA_*` yalnızca modül kalfası, `DALIS_*` yalnızca dalış kalfası içindir.

## Mimari

- **Sunucu** (Fastify): `server/index.js` → `server/uygulama.js` (tüm rotalar), `kalfa.js` (modül kalfası: `eser_ara` / `modul_yaz` araçları, kurallar + TS tip denetimi, en çok 3 deneme), `dalis-kalfasi.js` + `dalis-uretim.js` (dalış ajanı ve görüntü üretimi), `dogrulama.js`, `guvenlik.js`, `depo.js` (JSON dosya deposu).
- **Başlıca API'ler:** `/api/eserler` (+`/yakin`, `/:id`, tamlık filtreleri), `/api/eser-iliskileri`, `/api/eser-oneriler`, `/api/eser-gecmisi`, `/api/moduller`, `/api/kalfa`, `/api/dalislar`, `/api/dalis-kalfasi`, `/api/medya`.
- **SDK** (`sdk/`): `lonca-sdk.js` modül iframe'inde çalışır; `lonca-sdk.d.ts` sözleşme; `ornekler/` kalfanın öğrendiği örnekler (`hanlar-rehberi.js`, `yuzyil-avi.js`).
- **Uygulama** (`public/app/`): modül sandbox iframe'de çalışır (`calistirici.js`), arayüz ağacını `sahne.js` çizer; `ekranlar.js`, `harita.js` (Leaflet), `uc-gercek.js` (Google 3D Tiles), `dalis.js` (dalış oynatıcı), `profil.js`.
- **Studio** (`public/studio/`): Atölye (kalfa | kod | önizleme), Modüller, İçerik, Dalışlar.
- **Veri** (`data/`): `eserler.json` (eser kayıtları), `eser-iliskileri.json` (kaynaklı tarihsel bağlar), `moduller/` (`index.json` + modül JS), `dalislar/` (dalış tanımları). Medya `public/medya/`.
- **Durumlar:** modül ve dalış `bekliyor` → `onayli`; ayrıca `kaldirildi`, `arsiv`, `reddedildi`.
- **Mobil:** Capacitor (`capacitor.config.json`, `webDir: mobil/www`), `public/mobil/` köprü ve yerel API.

Ayrıntılı anlatım için `README.md`.
