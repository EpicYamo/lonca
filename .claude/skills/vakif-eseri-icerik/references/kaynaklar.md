# Kaynaklar

## 1. Vakıf Katılım yayınları (birincil kaynak, "E")

Yayın sayfası: https://www.vakifkatilim.com.tr/tr/hakkimizda/medya-merkezi/yayinlarimiz
(Sayfada başlıklar "… Vakıf Eserleri Kitabı" diye geçer; projede Bursa kitapları "Bursa Vakıf Eserleri Envanteri" diye anılıyor. Kayıtlarda `kaynak` biçimi aşağıda.)

| Kitap | PDF | Künye (kitabın iç kapağından) |
| --- | --- | --- |
| Bursa Vakıf Eserleri, Cilt 1–3 | `…/documents/KurumsalIletisim/yayinlarimiz/bursa-envanteri-cilt-{1,2,3}.pdf` | Basım: Nisan 2026. ISBN (Cilt 1) 978-625-99247-6-2, takım 978-625-99247-5-5. Bilim Kurulu Başkanı Prof. Dr. Hasan Basri Öcalan. Metin: H. B. Öcalan, Dr. Öğr. Üyesi Doğan Yavaş, Dr. Öğr. Üyesi Sezai Sevim, Fikret Alkan, Aziz Elbas. Editör Emine Şule Demirtaş. Fotoğraf: Erdin Hasdemir, Özkan Yenihayat. Fethin 700. yılı (1326–2026) armağanı olarak hazırlanmış. |
| Konya Vakıf Eserleri, Cilt 1–2 | `…/yayinlarimiz/konya-envanteri-1_cilt-web.pdf`, `…/konya-envanteri-2_cilt-web.pdf` | Basım: Kasım 2024. ISBN 978-625-99247-4-8, takım 978-625-99247-2-4. Bilim Kurulu Başkanı Prof. Dr. Ali Boran. Fotoğraf: Mirkan Tunç ve ekibi. |
| Hatay İli Vakıf Eserleri | `…/documents/KurumsalIletisim/hatay-vakif-eserleri.pdf` | Metin: Halil Agah, Prof. Dr. Nusret Çam, Berica Nevin Berberoğlu Şen. Basım tarihi iç kapakta boş. |

Ön ek: `https://www.vakifkatilim.com.tr`. PDF'ler 40–55 MB; metni `araclar/kitap-ice-aktar.py` (pdftotext gerekir) ya da `pypdf` ile çıkar. Kitaplar tüm hakları saklı yayınlardır: depoda tutma, kartlarda uzun alıntı yapma.

### Bursa kitabının yöntemi (Giriş bölümünden)
- **Kapsam:** Bursa ili sınırlarında, **Vakıflar Genel Müdürlüğü envanterine kayıtlı** vakıf yapıları. Yok olmuş, özel mülkiyete geçmiş ya da başka kuruma devredilmiş yapılar kitapta yok. Kitapta olmayan bir yapı "vakıf eseri değildir" anlamına gelmez; yalnızca bu envanterde değildir.
- **Düzen:** ilçe ilçe. Önce Osmangazi, sonra Yıldırım ve Nilüfer, sonra öteki ilçeler alfabetik. Osmangazi ayrıca konulara bölünür: 1. Külliyeler 2. Camiler ve Hazireler 3. Türbeler ve Mezarlar 4. Eğitim Kurumları (mektep, medrese) 5. Tekke ve Zaviyeler 6. Ticari Yapılar (han, çarşı, bedesten, kervansaray) 7. Su Yapıları (hamam, çeşme, köprü) 8. Sivil Mimari ve Diğer.
- **Her eserin anlatım sırası:** konum → zaman içindeki farklı adları ve gerekçeleri → bani ve hayatı → inşa tarihi → kitabe (asıl metin + günümüz Türkçesi) → mimari özellikler → vakfiye içeriği (varsa) → halkın gösterdiği saygının gerekçesi → onarımlar ve özgünlüğü koruyup korumadıkları → **günümüzdeki durumu tek cümle**.
- **Dayandığı belgeler:** şer'iyye sicilleri, Devlet Arşivleri Başkanlığı kayıtları, Vakıflar Genel Müdürlüğü Arşivi'ndeki vakfiyeler; mimari araştırmalar destekleyici kaynak.
- Metin iki dilli (TR/EN sütunlar). Projedeki `tarihce.en` bu İngilizce sütundur; çeviri yapma, kitabınkini kullan.

### Kayıtta kaynak yazımı
```
Vakıf Katılım, Bursa Vakıf Eserleri Envanteri, Cilt 2, s. 391
```
Sayfa bilinmiyorsa en azından cilt. Konya ve Hatay için aynı kalıp: `Vakıf Katılım, Konya Vakıf Eserleri, Cilt 1, s. …`, `Vakıf Katılım, Hatay İli Vakıf Eserleri, s. …`.

### Yeni bir kitap eklerken dikkat
- **Hatay:** kitabın basım tarihi belirtilmemiş. 6 Şubat 2023 depremlerinde Antakya'daki tarihî yapıların önemli bir kısmı yıkıldı ya da ağır hasar gördü. Kitaptaki "günümüzdeki durum" cümlesi deprem öncesine ait olabilir; bugünkü durumu güncel bir kaynaktan doğrulamadan "bugün ibadete açıktır" gibi bir şey yazma.
- **Konya:** Selçuklu ağırlıklıdır; Bursa'daki "erken Osmanlı" çerçevesini taşıma. Yüzyıl ve hanedan bilgisini kitabın kendisinden al.
- PDF çıkarımında Türkçe harfler bozulabilir (`!` → ş, `%` → Ş/İ, `/f_i` → fi bağı). İçe aktarma sonrası `grep -n '[!%]' ` ile tara.

## 2. Türkçe Vikipedi ("V")
- Bursa dışındaki 22 kayıt ve dalış kartlarının bir kısmı buradan (CC BY-SA 4.0). Kayıtta madde URL'si `kaynak` alanında durur.
- Kalfa maddeyi adla arar ve en iyi eşleşen başlığı seçer (`server/dalis-kalfasi.js → vikipedi()`); yanlış madde gelme riski var, başlığı doğrula.
- Vikipedi ikincil kaynaktır: üstünlük iddiaları ("en geniş", "ilk") ve atıflar (mimar, çini ustası) çoğu zaman kaynaksızdır. Bunları kart yaparken "…olarak anılır / …olduğu sanılır" diye yumuşat ya da envanterle karşılaştır.

## 3. Görsel kaynaklar
- Bursa fotoğrafları kitaplardan çıkarıldı (`araclar/foto-cikar.py`), öteki şehirler Wikimedia Commons'tan (yerel kopya, CC BY-SA).
- Uydu: Esri World Imagery. Uygulamada "Uydu: Esri World Imagery" yazar.
- Yapay zekâ görüntüleri yalnızca dalışlarda ve her zaman etiketli.

## 4. Doğrulama için başvurulabilecek ek kaynaklar (kartlarda doğrudan "E/V" değildir)
- TDV İslâm Ansiklopedisi (islamansiklopedisi.org.tr): bani, mimar, tarih çelişkilerinde.
- Vakıflar Genel Müdürlüğü yayınları ve vakfiyeler.
- Kültür ve Turizm Bakanlığı / Kültür Envanteri; UNESCO Dünya Mirası sayfaları (ör. "Bursa ve Cumalıkızık: Osmanlı İmparatorluğu'nun Doğuşu", 2014; Edirne Selimiye, 2011).

Bu kaynaklarla bir çelişki bulursan kartı değiştirmeden önce editöre bildir; şu an kart şeması yalnızca E/V/G etiketini taşıyor. Ek kaynaktan gelen bir bilgiyi kullanmak gerekirse `k` alanına serbest metin yazılabilir (modül `KAYNAK[k] ?? k` gösterir; örnek: Ulu Cami'deki `"Fotoğraf: Vakıf envanteri"`), ama bu istisnadır ve denetim betiği içeriğini denetleyemez.
