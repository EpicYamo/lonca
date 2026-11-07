# Eser kaydı ve tarihsel ilişkiler

## Eser kaydı (`data/eserler.json → eserler[]`)

Doğrulama kuralları `server/dogrulama.js → eserDogrula` içindedir; Studio, öneri kuyruğu ve içe aktarma aynı kuralı kullanır.

| Alan | Kural | Nereden |
| --- | --- | --- |
| `id` | `<il>-<ad>` küçük harf, Türkçe harfsiz, tireli (`kimlikUret`). Örn. `bursa-yesil-turbe`, `bursa-koza-hani`. Bir kez verildikten sonra değişmez (dalış, ilişki ve modüller buna bağlı). | — |
| `ad` | Kitaptaki başlık. Parantezli diğer adlar başlıkta kalabilir: "Aynalı (Hoca Tabib-Hoca Tayyip-Çapraz) Camii". | E |
| `ad_en` | Kitabın İngilizce başlığı; yoksa `null`. Uydurma çeviri yapma. | E |
| `tur` | `cami, mescit, medrese, han, hamam, cesme, turbe, kulliye, imaret, kopru, tekke, hazire, carsi, kutuphane, sivil, diger`. "Cami ve Haziresi" → `cami`. Bedesten → `carsi` ya da `diger` (listede bedesten yok). | E |
| `il`, `ilce` | Kitabın ilçe bölümü. | E |
| `yuzyil` | **Yalnızca yapım tarihi** varsa (1–21). Hicrî tarih varsa miladisinden hesapla (H. 981 = M. 1573 → 16). Onarım/ihya/kitabe yenileme tarihi değildir. Belirsizse `null`. Otomatik çıkarımın düzeltmeleri `data/bursa-ek.json`'da tutulur. | E |
| `konum` | `{ lat, lng, yaklasik }`. Kitaplarda koordinat yok: elle girilen ya da `npm run konum` ile bulunan konum `yaklasik: true`. Vikipedi koordinatı kullanıldıysa `konum_kaynagi: "vikipedi"`. Yanlış eşleşmeye dikkat: aynı adlı başka bir yapıya düşmesin, eserden 20 km'den uzak koordinatı kabul etme. | ek / V |
| `adres` | Kitaptaki konum cümlesi ya da adres; yoksa `null`. | E |
| `tarihce.tr` | Kitap metni (kısaltılmış). Kendi cümleni katma; kısaltırken anlamı değiştirme. PDF bozukluklarını (`!`→ş, `%`→Ş/İ) düzelt. En az 20 harf. | E / V |
| `tarihce.en` | Kitabın İngilizce sütunu; yoksa `null`. | E |
| `fotograflar` | En çok 12; yerel `/medya/...` (jpg/png/webp) ya da `https://`. İlki kapak. | E / Commons |
| `kaynak` | **Zorunlu.** `Vakıf Katılım, Bursa Vakıf Eserleri Envanteri, Cilt N, s. X`. Envanterde olmayan bir eser kayda girmez; Vikipedi yalnızca var olan bir kaydın konumunu ya da dalış kartını destekleyebilir. | — |
| `sergi` | Müze/sergi notu; çoğunlukla `null`. | — |

### Kayıt yazarken
- Kitap sırasını koru: konum, adlar, bani, tarih, kitabe, mimari, vakfiye, onarımlar, bugünkü durum. Kısaltırken önce mimari ayrıntıyı kısalt; **bani, tarih, vakıf ve bugünkü durum** cümlelerini atma.
- Kitabe metni alıntılanıyorsa hem asıl metni hem günümüz Türkçesini ("Mealen: …") birlikte tut; birini tek başına bırakma.
- Hicrî/miladî tarihleri kitaptaki biçimde yaz: `H. 981 / M. 1573`.
- **Yalnızca Vakıf Katılım envanterindeki eserler.** Vikipedi'den ya da başka bir kaynaktan yeni eser eklenmez (Kasım 2026'da Vikipedi'den eklenmiş 22 kayıt bu yüzden kaldırıldı). Yeni şehir ancak Vakıf Katılım'ın o şehrin envanteri (örn. Konya, Hatay) içe aktarılarak eklenir.
- Değişiklikten sonra `npm test`.

## Tarihsel ilişkiler (`data/eser-iliskileri.json → iliskiler[]`)

```json
{ "id": "koza-pirinc", "a": "bursa-koza-hani", "b": "bursa-pirinc-hani", "tur": "bani",
  "baslik": "Aynı bani: II. Bayezid",
  "aciklama": "Koza Hanı, II. Bayezid'in İstanbul'daki külliyesine gelir sağlamak için 1491'de; Pirinç Hanı ise aynı padişahın camisine gelir sağlamak için 1507-1508'de yaptırılmıştır.",
  "kaynak": "Vakıf Katılım, Bursa Vakıf Eserleri Envanteri, Cilt 2, s. 15, 43" }
```

| `tur` | Ne zaman | Örnek |
| --- | --- | --- |
| `kulliye` | Envanter iki yapıyı aynı külliyenin parçası diye anar | Yeşil Külliye ↔ Yeşil Türbe |
| `vakif` | Biri ötekine gelir sağlamak için vakfedilmiş | Geyve Hanı → Yeşil Külliye |
| `bani` | Aynı kişi yaptırmış | Koza Hanı ↔ Pirinç Hanı (II. Bayezid) |
| `mimar` | Aynı mimar/baş mimar | Geyve Hanı ↔ İpek Hanı (Hacı İvaz Paşa) |
| `aile` | Hanedan/aile bağı (defin, ebeveyn) | Osman Gazi ↔ Orhan Gazi türbeleri |
| `metin` | Envanter bir yapıyı ötekiyle açıkça ilişkilendirir | Bedesten ↔ Emir Hanı |
| `komsu` | Envanter konumu ötekine göre tarif eder / aynı tarihî doku | Orhan Bey Camii ↔ Ulucami |
| `tipoloji` | Aynı plan tipi (kaynakta adıyla geçmeli) | Bursa Ulucami ↔ Edirne Eski Cami |
| `ticaret` | Belgelenmiş ticaret ağı | (dikkat: kaynağı zayıf, bkz. bulgular) |

Kurallar:
- **Her bağ kaynakta açıkça yazılı olmalı.** Ad benzerliği, yakınlık tahmini ya da "muhtemelen" bağ değildir. Şehirler arası bağlar (`tipoloji`, `ticaret`) en kolay uydurmaya kayan türlerdir; iki ayrı kaynaktaki iki ayrı bilgiyi birleştirip yeni bir iddia ("Bursa ipeği İzmir limanından Akdeniz'e ulaşırdı") üretme. Bunu söyleyen tek bir kaynak bul ya da bağı yazma.
- `aciklama` 1–2 cümle, kaynaktaki tarih ve adları içerir; `baslik` kısa ve ilişkinin türünü söyler.
- `kaynak` cilt ve sayfa; iki eser iki ayrı sayfadaysa ikisini de yaz. Biçimi eser kaydındakiyle aynı tut ("Vakıf Katılım, …").
- `id` tekil ve okunur: `<a-kisa>-<b-kisa>`.
- Bağın iki ucu da `eserler.json`'da olmalı.
