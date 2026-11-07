# Doğrulama bulguları (7 Kasım 2026)

Mevcut içeriğin kaynaklarla karşılaştırılması. Yöntem: `scripts/kart-denetle.mjs` (E kartları ↔ envanter metni, V kartları ↔ Türkçe Vikipedi), Vakıf Katılım Bursa Cilt 1, Konya Cilt 1 ve Hatay kitaplarının künye ve giriş bölümleri, ayrıca elle okuma. Düzeltilen her maddeyi buradan sil.

Güven: **Kesin** = kaynak metniyle gösterildi. **Güçlü** = yaygın akademik kabul, ama kartın kaynağı (E/V) aksini ya da eksiğini söylüyor. **Açık** = doğrulanamadı.

## Dalışlar

### Yeşil Türbe (`bursa-yesil-turbe`, kalfa, bekliyor)
1. Düzeltildi: `d1` 1421 kartı envanterdeki ifadeyle yeniden yazıldı (mimar ayrı V kartında), `k2` "İznik çiniciliğinin şaheser örnekleri" cümlesi çıkarıldı. Kitabedeki PDF bozukluğu (`!ehîdis`, `i!rîn`) `data/eserler.json`'da düzeltildi. Kalan kartlar kaynaklarıyla uyumlu.

### Emir Sultan Külliyesi (`bursa-emir-sultan-kulliyesi`, kalfa, onaylı)
1. Düzeltildi: hedef Vikipedi koordinatına (40.18111, 29.08111) taşındı ve uydu kareleri yeniden üretildi (eski hedef yaklaşık 770 m kuzeydeydi). Kaynaksız ve sahte yazılı "Kufi Hat Levhası" kolu çıkarıldı. Şadırvan kolu Vikipedi "Emir Sultan Camii" maddesine bağlandı (avlunun ortasında şadırvan).
2. **Açık.** `k1` türbe kapısı canlandırmasının alınlığında yapay zekânın ürettiği okunmaz yazı var; görüntü yeniden üretilirken yazısız istenmeli.

### Bursa Ulucami (`bursa-ulucami`, el, onaylı)
1. **Açık.** `k1` "Türkiye'de iç cemaat yeri en geniş camidir" (V). Vikipedi'de aynen geçiyor ama kaynaksız bir üstünlük iddiası. Öneri: "…en geniş camilerden biri olarak anılır".
2. **Küçük tutarsızlık.** `k1` "1396-1400" (V) ile `k2` "açılış 1399" (E) ve minber kitabesi "802 (1399)". Çelişki değil (inşa aralığı ve açılış), ama aynı dalışta ikisi yan yana okunuyor; "1396'da başlandı, 1399'da açıldı" daha açık.
3. `k7` besmele kartının kaynağı serbest metin ("Fotoğraf: Vakıf envanteri"); doğru ve bilinçli (gerçek fotoğraf). Örnek alınabilir.

### Koza Hanı, Şehzade Mustafa Türbesi (el, onaylı)
Kartlar kaynaklarıyla uyumlu. Şehzade Mustafa'nın V kartları "Muradiye Külliyesi" maddesinden; denetimde bu başlık kullanılmalı (betikte tanımlı).

## Eser kayıtları (`data/eserler.json`)
1. **Bilgi.** 187 kaydın 66'sında `yuzyil: null` (kural gereği: yapım tarihi yok). 153 kayıt konumlu, bunların 131'i yaklaşık (Bursa'da 130/165; konum_kaynagi `openstreetmap` olanlar OSM'de adıyla bulunup mahallesi kaydın adresiyle karşılaştırıldı, sokak ya da köy düzeyinde olanlar da var). Konumsuz 35 Bursa eseri OSM'de güvenle bulunamadı; elle girilmeli.
2. **Açık.** Birçok kaydın `adres` alanı boş, ama adres `tarihce.tr`'nin ilk cümlesinde duruyor; oradan doldurulabilir.
3. **Ad.** Projede kitap "Bursa Vakıf Eserleri Envanteri" diye anılıyor; yayın sayfasında "Bursa Vakıf Eserleri Kitabı", kapakta "Bursa Vakıf Eserleri / Foundation Buildings of Bursa". Kaynak satırları tutarlı olduğu için değiştirmek gerekmiyor, ama dışarıya yazarken kitabın kendi adını kullan.

## İlişkiler (`data/eser-iliskileri.json`)
1. **Kesin, kaynaksız birleştirme.** `bursa-koza-izmir-kizlaragasi` (tur: `ticaret`): "Bursa ipeği İzmir limanı üzerinden Akdeniz'e ulaşırdı." Bu cümle iki kaynakta da yok; iki ayrı bilgiden üretilmiş bir iddia. Öneri: cümleyi çıkar ya da bunu söyleyen bir kaynak bul.
2. **Biçim.** Şehirler arası bağların `kaynak` satırında "Vakıf Katılım," öneki eksik (`Bursa Vakıf Eserleri Envanteri, Cilt 2, s. 15; Vikipedi, …`).

## Kaynak notları
- Hatay kitabının basım tarihi iç kapakta boş; 6 Şubat 2023 depremlerinden önceki durumu anlatıyor olabilir. Hatay eserlerini eklerken "bugünkü durum" bilgisini güncel bir kaynaktan doğrula.
