---
name: vakif-eseri-icerik
description: Lonca'da vakıf eseri içeriği üretme ve denetleme rehberi. Vakıf Katılım "Vakıf Eserleri" kitaplarından (Bursa 3 cilt, Konya 2 cilt, Hatay) ya da Vikipedi'den eser kaydı eklerken, data/eserler.json'daki tarihçe/yüzyıl/konum/kaynak alanlarını düzenlerken, eser-iliskileri.json'a tarihsel bağ yazarken, bir eser için dalış (uydudan içine kaydırmalı gezi, data/dalislar) planlarken ya da bilgi kartlarını (E/V/G) yazıp doğrularken, ve modül/kalfa istemlerinde vakıf eserlerini anlatırken kullan. Tetikleyiciler - vakıf eseri, envanter, dalış, bilgi kartı, bakış, kitabe, vakfiye, bani, külliye, cami, türbe, han, medrese, eser kaydı, kaynak denetimi, fact-check.
---

# Vakıf eseri içeriği (Lonca)

Lonca bir vakıf mirası kataloğunu oynanabilir kılar; değerini **doğruluk** belirler. Bu skill, şimdiye kadar içeriğin nasıl üretildiğini ve bundan sonra nasıl üretilmesi gerektiğini tek yerde toplar. Kod tarafını (SDK, kalfa, Studio) başka belgeler anlatır; burası **içeriğin** kurallarıdır.

## Altın kurallar (hiçbiri pazarlık konusu değil)

1. **Uydurma yok.** Her ad, tarih, sayı ve kişi bir kaynakta *aynen* geçmeli. Kaynakta yoksa yazma; "emin değilim" kartı yazmamak, yanlış kart yazmaktan iyidir.
2. **Her bilginin kaynağı görünür.** Eser kaydında `kaynak` (kitap, cilt, sayfa ya da Vikipedi URL'si), dalış kartında `k` (E / V / G), ilişkide `kaynak` (cilt, sayfa).
3. **Kaynak sırası:** Vakıf Katılım envanteri (E) > Türkçe Vikipedi (V) > genel kavram (G). E ile V çelişirse E'yi esas al, çelişkiyi editöre not düş; ikisini harmanlayıp yeni bir "olgu" üretme.
4. **Yüzyıl yalnızca yapım tarihinden.** Onarım, tamir, ihya, kitabe yenileme tarihi yapım tarihi değildir. Tarih yoksa `yuzyil: null` (sorularda kullanılmaz).
5. **Yaklaşık olan yaklaşık görünür.** Kitaplarda koordinat yok; elle girilen konum `yaklasik: true` taşır ve uygulama bunu söyler. Yapay zekâ görüntüsü her zaman etiketlenir (gerçek / netleştirilmiş / genişletilmiş / yeniden çizim / canlandırma).
6. **İnsan onayı.** Kalfa ve bu skill yalnızca **taslak** üretir; yayına editör onayıyla girer (`durum: "bekliyor"` → `"onayli"`).
7. **Telif.** Bursa metin ve fotoğrafları © Vakıf Katılım; hackathon kapsamında, özel depoda kullanılır. Kitap metnini kartlarda uzun alıntılama; özetle. Vikipedi/Commons içeriği CC BY-SA: kaynak bağlantısı kayıtta kalır.

## Hangi iş, hangi rehber

| İş | Oku |
| --- | --- |
| Kaynak seçmek, kitabın yöntemini anlamak, yeni şehir kitabı (Konya, Hatay) eklemek | `references/kaynaklar.md` |
| `data/eserler.json` kaydı eklemek/düzeltmek, `eser-iliskileri.json` bağı yazmak | `references/kayit-ve-iliski.md` |
| Dalış planlamak, kare ve bilgi kartı yazmak, görüntü istemleri | `references/dalis.md` |
| Kart dili, uzunluklar, ton, terim sözlüğü (G kartları için) | `references/yazim-ve-sozluk.md` |
| Mevcut içerikte bilinen hatalar ve açık sorular (doğrulama raporu) | `references/dogrulama-bulgulari.md` |

## İş akışı

### 1. Kaynağı topla, önce oku
- Eser kaydını aç: `data/eserler.json` → `eserler[]` içinde `id`. `tarihce.tr` envanter metnidir (kitaptan otomatik çıkarılmış, kısaltılmış); `kaynak` cilt ve sayfayı verir.
- Metinde PDF çıkarım bozukluğu ara: `!` çoğu zaman **ş**, `%` çoğu zaman **Ş/İ** yerine geçmiştir (ör. `!ehîdis` → `şehîdis`). Bunları alıntılamadan önce düzelt ya da editöre bildir.
- Gerekirse Türkçe Vikipedi maddesini al (kalfa bunu `server/dalis-kalfasi.js → vikipedi()` ile yapar). Madde başlığını doğrula: "Yeşil Türbe" ararken "Yeşil Cami" gelmesin.

### 2. Kitabın sırasıyla düşün
Vakıf Katılım envanteri her eseri aynı sırayla anlatır; içerik de bu omurgaya oturmalı:
**konum → farklı adları ve nedeni → bani ve hayatı → inşa tarihi → kitabe (asıl metin + günümüz Türkçesi) → mimari → vakfiye içeriği → halkın gösterdiği saygı → onarımlar ve özgünlüğe etkisi → bugünkü durumu (tek cümle).**
Bir dalış ya da kart dizisi en az şunları vermeli (kaynakta varsa): **ne, nerede, kim yaptırdı, kim yaptı, ne zaman, vakıf olarak neye hizmet etti, bugün ne durumda.**

### 3. Yaz
- Kayıt/ilişki için `references/kayit-ve-iliski.md`, dalış için `references/dalis.md`, dil için `references/yazim-ve-sozluk.md`.
- "Vakıf" boyutunu atlama: eser kimin vakfıydı, gelirini ne sağlıyordu (ör. Koza Han, II. Bayezid'in İstanbul'daki külliyesine gelir sağlamak için yapıldı). Lonca'yı sıradan bir gezi rehberinden ayıran budur.

### 4. Denetle
```bash
node .claude/skills/vakif-eseri-icerik/scripts/kart-denetle.mjs                       # bütün dalışlar
node .claude/skills/vakif-eseri-icerik/scripts/kart-denetle.mjs bursa-koza-hani --viki "Koza Han"
node .claude/skills/vakif-eseri-icerik/scripts/kart-denetle.mjs /yol/taslak.json        # yayından önce taslak
```
Betik her E/V kartındaki sayıları, sayı sözcüklerini ve özel adları kaynağında arar; G kartında özgül bilgi varsa uyarır; biçim ve uzunluk sınırlarını ve PDF bozukluklarını yakalar. **Uyarı ≠ hata**: her uyarıyı kaynağa bakarak kapat. Betik eş anlamlı ya da yorumlanmış bir uydurmayı yakalayamaz; son okuma insanındır.

Eser kaydı değiştiyse ayrıca `npm test` çalıştır (doğrulama kuralları `server/dogrulama.js`).

### 5. Teslim et
Değişikliği editöre şu üç şeyle sun: neyi değiştirdin, hangi kaynağa (cilt/sayfa ya da URL) dayandın, kapatılamayan uyarılar ve açık sorular. Onaylı (`"onayli"`) bir dalışın üzerine yazma; yenisini taslak olarak hazırla.

## Yapma listesi
- Ad benzerliğinden ilişki ya da bilgi türetme ("Yeşil" adlı her yapı aynı külliyeden değildir).
- Onarım yılını yapım yılı yazma; "yaptırdı" ile "onarttı"yı karıştırma.
- "En büyük", "ilk", "tek", "en eski" gibi üstünlük iddialarını kaynakta aynen yoksa yazma; varsa kaynağın sözcüğüyle ver ("…olarak anılır").
- Tartışmalı atıfları (mimar, çini atölyesi, tarih) kesin bilgi gibi sunma: "…olduğu sanılır / kaynaklarda … diye geçer".
- G kartına tarih, sayı ya da kişi adı koyma; o artık kaynaklı bir karttır.
- Yapay zekâ görüntüsüne gerçek fotoğraf etiketi verme; görüntüde yazı, kitabe ya da insan ürettirme.
- Kişilerin ölümü, şehzade katli, savaş gibi konuları dramatize etme; kaynağın ölçülü dilinde kal.
