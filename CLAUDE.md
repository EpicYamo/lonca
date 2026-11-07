# Lonca — Claude için çalışma kuralları

Lonca, vakıf eserleri için yapay zekâ destekli bir modül platformudur (KÖK&KOD Hackathon, Takım Kozmos).
Ayrıntılı tanım README.md'de. Kullanıcıyla Türkçe konuş.

## Çalışma kuralları (ustanın kuralları)

1. **Her iş kendi branch'inde.** İşe başlamadan yeni bir branch aç (`fix/...`, `feat/...`). `main`'e ya da başkasının
   branch'ine doğrudan commit atma. Aynı klasörde başka bir çalışma sürüyorsa yalnızca kendi dosyalarını commit et.
2. **Varsayım yapma, doğrula.** Bir şeyin çalıştığını söylemeden önce çalıştır: testi koş, sunucuyu aç, uç noktayı çağır,
   çıktıya bak. Emin olmadığın bir şeyi "muhtemelen" diye geçme; kontrol et ya da açıkça "denemedim" de.
3. **Projeyi bilmeden iş yapma.** Bir dosyayı değiştirmeden önce onu ve onu çağıran yerleri oku. İlgili akışı
   (sunucu rotası → kalfa → Studio arayüzü) baştan sona anla, sonra değiştir.
4. **Commit mesajı kısa olsun.** Tek satırlık bir başlık yeter, ayrıntılı gövde yazma.
   Örnek: `Modül kalfası USTAGPT anahtarına düşsün`
5. **Gizli bilgi:** `.env` asla commit edilmez, anahtar değerleri ekrana, mesaja ya da koda yazılmaz.
6. **Kurulum izni:** Yeni bağımlılık, araç ya da bağlayıcı kurmadan önce sor.

## Komutlar

```bash
npm install
npm run dev          # http://localhost:3000/app · Studio: /studio
npm test             # node:test (test/*.test.mjs), sahte kalfa ile çalışır
npm run test:e2e     # uçtan uca senaryo (Playwright)
```

Değişiklikten sonra en az `npm test` çalıştır. Kalfaya dokunduysan gerçek anahtarla bir istek de dene.

## Yapı

```
server/uygulama.js       Fastify rotaları (eserler, modüller, dalışlar, kalfa uçları)
server/kalfa.js          Modül kalfası: ustanın fikrini tek dosyalık bir Lonca modülüne çevirir (araç çağrılı döngü,
                         TypeScript ile denetim). Sağlayıcılar: anthropic | openai-uyumlu | sahte
server/dalis-kalfasi.js  Dalış kalfası: istekten eseri seçer, Vikipedi + envanter toplar, plan yapar, kareleri üretir,
                         data/dalislar/<eser>.json'a "bekliyor" olarak kaydeder
server/dalis-uretim.js   Dalış karesi üretimi (ffmpeg, Pillow, görsel model, Esri uydu karoları)
sdk/                     Modüllerin tek erişim yolu (lonca-sdk.d.ts sözleşmedir)
public/app/              Vatandaş uygulaması (dalis.js dalış oynatıcı)
public/studio/           Studio: Atölye (Modül / Dalış kipi), modüller, içerik
data/eserler.json        Eser verisi · data/moduller/ modüller · data/dalislar/ dalış tanımları
araclar/                 Veri hattı ve komut satırı araçları (dalis-uret.mjs vb.)
```

## İki kalfa ve .env

- **Modül kalfası** `KALFA_SAGLAYICI`, `KALFA_API_URL`, `KALFA_API_ANAHTARI`, `KALFA_MODEL` okur. Bunlar boşsa
  `USTAGPT_BASE_URL` + `USTAGPT_API_KEY` kullanılır (model varsayılanı `gemini-3.8-flash`). Hiçbiri yoksa **sessizce
  sahte kipe** düşer: sunucu açılışında `Kalfa: SAHTE` yazar ve hazır şablon döner.
- **Dalış kalfası** `DALIS_API_URL`, `DALIS_API_ANAHTARI` (yoksa `USTAGPT_*`), `DALIS_MODELLER`,
  `DALIS_METIN_MODELLERI` okur. `KALFA_*` satırlarını okumaz.
- Dalış için makinede **ffmpeg, ffprobe, python3 + Pillow** gerekir; eksikse kalfa başlamadan söyler
  (`spawnSync ffprobe ENOENT` bu eksikliğin eski belirtisiydi).
- UstaGPT'de uzun, araç çağrılı isteklerde `gpt-*` ve `claude-*` modelleri ~60 sn'de 503 verebiliyor;
  modül kalfası için `gemini-3.8-flash` denenmiş ve çalışıyor.

## Dikkat

- Tarihî bilgi uydurulmaz: modüller veriyi yalnızca SDK'dan okur, dalış kartları yalnızca envanter (E) ve Vikipedi (V)
  metninden yazılır. Kalfa yalnızca taslak üretir, editör onaylar.
- Dalış üretimi gerçek API çağrısı yapar (~12-15 görsel, birkaç dakika); test için gereksiz yere çalıştırma.
