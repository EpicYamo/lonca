# Doğrulama bulguları (7 Kasım 2026)

Mevcut içeriğin kaynaklarla karşılaştırılması. Yöntem: `scripts/kart-denetle.mjs` (E kartları ↔ envanter metni, V kartları ↔ Türkçe Vikipedi), Vakıf Katılım Bursa Cilt 1, Konya Cilt 1 ve Hatay kitaplarının künye ve giriş bölümleri, ayrıca elle okuma. Düzeltilen her maddeyi buradan sil.

Güven: **Kesin** = kaynak metniyle gösterildi. **Güçlü** = yaygın akademik kabul, ama kartın kaynağı (E/V) aksini ya da eksiğini söylüyor. **Açık** = doğrulanamadı.

## Dalışlar

### Yeşil Türbe (`bursa-yesil-turbe`, kalfa, bekliyor)
1. **Kesin, E/V çelişkisi.** `d1` "BANİ VE MİMAR": "Mehmet Çelebi tarafından 1421 yılında yaptırılmıştır" (V). Envanter: "inşasına ne zaman başlandığı kesin olarak bilinmemektedir… yerinin Çelebi Mehmed'in sağlığında belirlendiği… yapının ise onun vefatından sonra tamamlandığı kabul edilmektedir." Öneri: "Yeri Çelebi Mehmed'in sağlığında belirlendi; türbe onun 1421'deki ölümünden sonra tamamlandı." (Ölüm yılı envanter kitabesinde hicrî 824 olarak geçer: "erbâîn ve işrîn ve semâne mi'e".)
2. **Güçlü.** `k2` "MİHRAP": "Buradaki çiniler İznik çiniciliğinin şaheser örnekleri" (V; Vikipedi gerçekten böyle yazıyor). Yeşil Külliye çinileri akademik yazında genellikle Tebrizli ustalar ("Ustâdân-ı Tebriz") ve renkli sır tekniğiyle ilişkilendirilir; "İznik" ataması tartışmalıdır. Öneri: bu cümleyi çıkar ya da "kaynaklarda … diye anılır" diye yumuşat.
3. **Kesin, veri.** Envanter metnindeki kitabede PDF bozukluğu: `!ehîdis` → `şehîdis`, `i!rîn` → `işrîn`.
4. Kalan kartlar (9 sanduka, Daya Hatun, sekizgen plan, Türk üçgeni, kırk gün) kaynaklarıyla uyumlu.

### Emir Sultan Külliyesi (`bursa-emir-sultan-kulliyesi`, kalfa, bekliyor; başka bir iş akışında üretiliyor)
1. **Kesin.** Kollardan "Ahşap Avlu Şadırvanı" ve "Kufi Hat Levhası"nın envanter metninde hiç karşılığı yok (metinde şadırvan, levha, kufi geçmiyor); iki kol da yalnızca G kartıyla anlatılıyor. Kural: kaynakta hakkında bilgi olmayan ayrıntı kol yapılmaz. Ayrıca hat levhası yapay zekâ ile üretilirse sahte yazı çıkar.
2. **Açık.** Vikipedi başlığı denetimde bulunamadı; V kartı yok, sorun değil.
3. Envanter kartları (28 tasdik imzası, Hundi Hatun, Edremit-Havran gelirleri) metinle uyumlu; vakıf boyutunu iyi anlatıyor.

### Bursa Ulucami (`bursa-ulucami`, el, onaylı)
1. **Açık.** `k1` "Türkiye'de iç cemaat yeri en geniş camidir" (V). Vikipedi'de aynen geçiyor ama kaynaksız bir üstünlük iddiası. Öneri: "…en geniş camilerden biri olarak anılır".
2. **Küçük tutarsızlık.** `k1` "1396-1400" (V) ile `k2` "açılış 1399" (E) ve minber kitabesi "802 (1399)". Çelişki değil (inşa aralığı ve açılış), ama aynı dalışta ikisi yan yana okunuyor; "1396'da başlandı, 1399'da açıldı" daha açık.
3. `k7` besmele kartının kaynağı serbest metin ("Fotoğraf: Vakıf envanteri"); doğru ve bilinçli (gerçek fotoğraf). Örnek alınabilir.

### Koza Hanı, Şehzade Mustafa Türbesi (el, onaylı)
Kartlar kaynaklarıyla uyumlu. Şehzade Mustafa'nın V kartları "Muradiye Külliyesi" maddesinden; denetimde bu başlık kullanılmalı (betikte tanımlı).

## Eser kayıtları (`data/eserler.json`)
1. **Kesin.** PDF çıkarım bozukluğu olan 5 kayıt (9 sözcük): `bursa-hidirlik-nilufer-hatun-camii` (!erîf), `bursa-kanberler-sitti-hatun-camii` (vakfetmi!tir, !artla, ba!ka, deği!tirirse, düzenlenmi!tir), `bursa-hz-uftade-tekkesi` (!eyi), `bursa-yesil-turbe` (!ehîdis, i!rîn). `!` → ş.
2. **Kesin.** `edirne-selimiye-camii` tarihçesi: "2000'de UNESCO tarafından Dünya Mirası listesine dahil edilen … 2011'de ise Dünya Mirası olarak tescil edildi". Vikipedi'den alınmış ama yanıltıcı: 2000'deki geçici listedir, Dünya Mirası Listesi'ne giriş 28 Haziran 2011'dir (aynı madde ileride bunu söylüyor). Ayrıca son cümle ("Mimar Sinan'ın 80 yaşında … zirvesi kabul edilir") metnin başındaki bilgiyi tekrar ediyor; sonradan eklenmiş.
3. **Bilgi.** 187 kaydın 66'sında `yuzyil: null` (kural gereği: yapım tarihi yok). 49 kayıt konumlu, bunların 27'si yaklaşık.
4. **Ad.** Projede kitap "Bursa Vakıf Eserleri Envanteri" diye anılıyor; yayın sayfasında "Bursa Vakıf Eserleri Kitabı", kapakta "Bursa Vakıf Eserleri / Foundation Buildings of Bursa". Kaynak satırları tutarlı olduğu için değiştirmek gerekmiyor, ama dışarıya yazarken kitabın kendi adını kullan.

## İlişkiler (`data/eser-iliskileri.json`)
1. **Kesin, kaynaksız birleştirme.** `bursa-koza-izmir-kizlaragasi` (tur: `ticaret`): "Bursa ipeği İzmir limanı üzerinden Akdeniz'e ulaşırdı." Bu cümle iki kaynakta da yok; iki ayrı bilgiden üretilmiş bir iddia. Öneri: cümleyi çıkar ya da bunu söyleyen bir kaynak bul.
2. **Biçim.** Şehirler arası bağların `kaynak` satırında "Vakıf Katılım," öneki eksik (`Bursa Vakıf Eserleri Envanteri, Cilt 2, s. 15; Vikipedi, …`).

## Kaynak notları
- Hatay kitabının basım tarihi iç kapakta boş; 6 Şubat 2023 depremlerinden önceki durumu anlatıyor olabilir. Hatay eserlerini eklerken "bugünkü durum" bilgisini güncel bir kaynaktan doğrula.
