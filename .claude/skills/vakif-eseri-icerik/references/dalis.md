# Dalış: uydudan eserin içine kaydırmalı gezi

Dalışlar "Vakıf Dalışları" modülünde (`data/moduller/vakif-dalislari.js`) oynar; sahne motoru `public/app/dalis.js`, üretim `server/dalis-uretim.js`, ajan `server/dalis-kalfasi.js` (istem: `DALIS_SISTEM`). Bugüne kadar:

| Dalış | Nasıl | Durum |
| --- | --- | --- |
| Bursa Ulucami | elle (`araclar/dalis/bursa-ulucami.json` → `araclar/dalis-uret.mjs`) | onaylı |
| Koza Hanı | elle | onaylı |
| Şehzade Mustafa Türbesi | elle | onaylı |
| Yeşil Türbe | dalış kalfası (Studio) | bekliyor |
| Emir Sultan Külliyesi | dalış kalfası (Studio), elle denetlendi | onaylı |

Elle yapılanlar kalitenin ölçüsüdür: yeni dalışları onlara bakarak yaz.

## Yapı (hikâye omurgası)

1. **Uydu inişi** (platform yapar): z = 6, 9, 12, 14, 16, 18. Hedef koordinat Vikipedi'den ya da kayıttan; eser kaydı yaklaşıksa uydu karesinde gerçekten yapının üstüne düştüğünü gözle doğrula. Yol üstündeki eserler modülde `YERLER` listesinden işaretlenir.
2. **Dış duraklar** (1–3): gerçek fotoğraflar, **uzaktan yakına** (hava → cephe). Burada kim, ne zaman, ne için anlatılır.
3. **Giriş** (isteğe bağlı): kapı/taç kapı/eşik.
4. **Merkez**: iç mekânın ya da avlunun geniş karesi. Kolların bütün nesneleri bu karede ayrı ayrı görünmeli. Merkezin son kartı yol haritasıdır: `{ u: "Gezi", b: "Buradan N yere gideceğiz", m: "A, B, C; her birinden sonra buraya döneceğiz.", k: "" }`.
5. **Kollar** (2–5): şadırvan, minber, mihrap, kitabe, çini, sanduka, revak, mescit… Kaynaklarda hakkında **bilgi olan** ayrıntıları seç; görsel olarak çekici ama kaynaksız ayrıntıyı kol yapma.
6. **Çıkış** (platform yapar): "Gökyüzüne".

### Anlatı dengesi (bir dalışta bulunması gerekenler)
- Kim yaptırdı (bani), kim yaptı (mimar/usta), ne zaman (kitabe/yapım tarihi): kaynakta varsa **ilk iki durakta**.
- **Vakıf boyutu**: neye hizmet etti, kime gelir sağladı ya da hangi vakıftan beslendi. Örn. Koza Hanı, II. Bayezid'in İstanbul'daki külliyesine gelir sağlamak için yapıldı; Geyve Hanı Yeşil Külliye'ye gelir sağlamak üzere vakfedildi.
- En az bir **insan hikâyesi** (envanterde varsa): Somuncu Baba'nın Ulucami açılışındaki tefsiri, Çelebi Mehmed'in ölümünün kırk gün gizlenmesi gibi.
- Bir **onarım/dönüşüm** bilgisi: 1855 depremi, 1889 yangını, 1950'lerdeki onarım. Bugün gördüğünün ne kadarının özgün olduğunu söyler.
- **Bugünkü durum**: kahvehane, çay bahçesi, ibadete açık…
- Gerektiği yerde bir **G kartı**: "Mihrap nedir?", "Kündekâri nedir?" Yabancı terimi ilk geçtiği yerde açıkla.

## Kare kaydı (`data/dalislar/<eser>.json`)

```json
{ "eser": "bursa-yesil-turbe", "ozet": "Lobide görünen tek cümle", "hedef": { "lat": 40.1816, "lng": 29.0742 },
  "durum": "bekliyor | onayli", "kaynak": "el | kalfa",
  "vikipedi": { "baslik": "Yeşil Türbe", "url": "…" }, "kareler": [ … ] }
```
Kare: `g` görsel adı (`public/medya/dalis/<eser>/<g>.jpg`), `t` etiket, `p` portal [x,y,g] (sonraki karenin bu karedeki yeri), `c` çıkış (bu karenin sonrakindeki yeri), `u` uydu `[lat,lng,z,çıkış?]`, `b` durak başlığı, `y: "ust"` (kartlar üstte; görüntünün alt kısmı önemliyse), `k` bilgi kartları.

Kart (bakış): `u` üst etiket, `b` başlık, `m` metin, `k` kaynak, `n` ok noktası [x,y], `a` kamera alanı [x,y,g].
- Bir karede en çok 4 kart (motor 6'ya izin verir, kalfa 4'e kırpar). Bir dalışta en çok 40 kare.
- `n` yalnızca o karede **gerçekten görünen** bir şeyi gösterir. Yapay zekâ karesinde ok, nesneyi işaret ediyorsa bile o nesnenin canlandırma olduğunu unutma: karttaki bilgi gerçek yapıya aittir, görüntüye değil.

### Görüntü etiketleri (`t`): dürüstlüğün kendisi
| `t` | Uygulamada | Ne zaman |
| --- | --- | --- |
| `gercek` | Gerçek fotoğraf | fotoğraf yalnızca kırpıldı |
| `genisletilmis` | Gerçek fotoğraf · kenarları YZ | üst/alt boşluk YZ ile dolduruldu, gerçek pikseller geri yapıştırıldı |
| `netlestirilmis` | Gerçek fotoğraf · YZ ile netleştirildi | küçük fotoğraf YZ ile büyütüldü |
| `yeniden-cizim` | Gerçek fotoğraftan · YZ ile yeniden çizildi | gerçek band geri yapıştırılamadı (hizalanmadı) |
| `canlandirma` | Yapay zekâ canlandırması | merkez, giriş, kollar |
| `uydu` | Uydu görüntüsü · Esri, Maxar | uydu inişi |

Üretici bu etiketi kendisi koyar; elle yazarken de aynı ölçüyle koy. **Asla** canlandırmaya `gercek` deme.

## Bilgi kartı kuralları

- `k: "E"`: her ad, tarih, sayı ve kişi **eserin envanter metninde** (`tarihce.tr`) aynen geçmeli.
- `k: "V"`: aynı kural, **dalışın** Vikipedi maddesine göre (`vikipedi.baslik`). Başka bir maddeden alınan bilgi V değildir.
- `k: "G"`: genel kavram (ne olduğu, ne işe yaradığı). Tarih, sayı, kişi adı içermez. Sözlük için `yazim-ve-sozluk.md`.
- `k: ""`: gezi yönlendirmesi (yol haritası kartı). Bilgi taşımaz.
- E ile V çelişiyorsa E'yi yaz; V'deki farklı bilgiyi "Vikipedi'ye göre …" diye ayrı kart yapma, editöre bildir. Örnek çelişki: Yeşil Türbe için envanter "inşaya ne zaman başlandığı bilinmiyor, Çelebi Mehmed'in ölümünden sonra tamamlandı" der; Vikipedi kartı "Mehmet Çelebi tarafından 1421 yılında yaptırılmıştır" diye yazılmış. Doğrusu envanterinki.
- Ad, tarih ve bani/mimar bilgisi kaynakta varsa dalışın bir yerinde **mutlaka** geçer.
- Kaynaktaki çekinceyi koru: "denir", "sanılmaktadır", "kabul edilir" kartta da kalır (Ulucami minareleri: "…yaptırdı denir").
- Tartışmalı/iddia niteliğindeki bilgi "iddia edildi" diye çerçevelenir (Ulucami minberindeki gök cisimleri yorumu gibi).
- Uzunluk: `u` ≤ 20, `b` ≤ 45, `m` ≤ 230 harf (kesme sınırı 24/60/300). Kart ekranda bir nefeste okunmalı.

## Görüntü istemleri (İngilizce)

- **Önek** (`onek`), her görüntüye: `Photorealistic, high-resolution documentary architectural photograph of the <İngilizce ad> in <şehir>, Turkey (<dönem/tarih>). Natural light, crisp detail. No people, no text, no captions, no watermark.`
- **Yazı ürettirme.** Kitabe, levha, hat yapay zekâ ile üretilirse sahte Arapça çıkar. Hat ve kitabe durakları için **gerçek fotoğraf** kullan (Ulucami'deki besmele levhası envanter fotoğrafıdır, kaynak satırı "Fotoğraf: Vakıf envanteri").
- **Genişletme** (`genislet`/`genisletIstem`): yalnızca gökyüzü, tepe, ağaç, çatılar, zemin taşı. "The mosque appears only once." Ana yapıyı ikinci kez çizdirme.
- **Merkez istemi**: her kolun nesnesini konumuyla say ("in the lower centre the marble fountain; on the left pier a framed calligraphy panel; in the background right the wooden pulpit"). İç mekân fotoğrafı varsa ona sadık kal; plan tipini kaynaktan al (Yeşil Türbe sekizgen plan, tek kubbe; Ulucami 20 kubbe, 5 sıra).
- **Kol istemi**: "much closer view of the same scene, same position and composition, now sharp and detailed: …". Kol karesi merkezin kırpımından türer; zincir böyle kopmaz.
- Döneme uy: erken Osmanlı yapısına klasik dönem ya da Selçuklu ayrıntısı koyma; yapının malzemesini ve rengini kaynaktan ya da gerçek fotoğraftan al (Yeşil Türbe: turkuaz sırlı kaplama; Koza Hanı: envantere göre ahşap üst kat revakı). Kaynakta ve fotoğrafta olmayan malzemeyi isteme yazma.

## Dalış kalfası ile çalışırken
- Studio'da isteği somut yaz: eser adı + istenen kollar + vurgulanacak konu ("Koza Hanı; mescit, şadırvan ve ipek ticareti").
- Kalfa yalnızca fotoğrafı olan eserlere dalış yapar; onaylı bir dalışın üzerine yazmaz.
- Çıktı her zaman `durum: "bekliyor"`. Onaylamadan önce:
  1. `node .claude/skills/vakif-eseri-icerik/scripts/kart-denetle.mjs <eser>`; bütün uyarıları kapat.
  2. Kartları envanterle yan yana oku; E/V çelişkilerini ve üstünlük iddialarını ara.
  3. Uydu hedefinin yapının üstüne düştüğünü ve canlandırmaların yapının gerçek planına aykırı olmadığını (ör. olmayan minare, yanlış kubbe sayısı) gözle kontrol et.
  4. `ozet` lobide görünür: abartısız, tek cümle.
- `DALIS_SISTEM` istemini değiştirmen gerekirse bu belgedeki kurallarla tutarlı tut. Başka bir iş akışı `server/kalfa.js` üzerinde çalışıyor olabilir; çakışmamak için önce `git status` bak.
