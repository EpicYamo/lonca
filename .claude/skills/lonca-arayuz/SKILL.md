---
name: lonca-arayuz
description: Lonca vatandaş uygulamasının (public/app, Android/Capacitor paketi) arayüzünü Apple/iOS kalitesinde yaparken uyulacak tasarım kuralları. Uygulamaya yeni ekran, kart, liste, sayfa (sheet) ya da düğme eklerken veya mevcut görünümü değiştirirken kullan.
---

# Lonca arayüz kuralları

Hedef: her ekran birinci parti bir Apple uygulamasında duruyormuş gibi hissettirsin: sakin, net, tanıdık.
Süs değil açıklık. Emin değilsen iOS'un varsayılanını seç; gereksiz görünen şeyi ekleme, çıkar.

## Nerede

- Belirteçler ve son rötuş: `public/app/zarif.css` (en son yüklenir). Yeni stil önce buradaki değişkenleri kullanır.
- Aşağı çekip kapatma: `public/app/zarif.js`. Yeni bir alttan sayfa eklersen `SAYFALAR` listesine kutusunu ve kapatma düğmesini ekle.
- Modüllerin kendi temaları (`sahne.css`, `data-tema` olmayan modül ekranı) bu kurallara tabi değildir.

## Tema

- Varsayılan beyaz tema; siyah tema `:root[data-tema="koyu"]` (üst bardaki ay/güneş düğmesi, `lonca.tema`). İkisi de her değişiklikte denenir.
- Renkler yalnızca belirteçten: `--zemin` (#f5f5f7 / #000), `--yuzey` (#fff / #1c1c1e), `--yuzey-2`, `--metin`, `--soluk`, `--cizgi`, `--dolgu`, `--vurgu` (firuze, tek vurgu rengi), `--ana` (birincil düğme: beyaz temada siyah, siyah temada beyaz).
- Metin kontrastı en az 4.5:1. Hiyerarşi renkle değil boyut ve kalınlıkla kurulur.
- Yüksek kontrast, sade görünüm, hareketi azalt, okunaklı yazı, büyük hedef tercihleri her zaman yeni stilin önündedir.

## Yazı

- Web sitesinde sistem yazı tipi (`--yazi-sistem`). Android uygulamasında (`html.kabuk`, `public/app/uygulama/`) görsel dil web sitesiyle aynı aileden: gövde Figtree, sayfa ve kart başlıkları Young Serif (400), sıcak kâğıt zemin (#f6f4ef), koyu yeşil vurgu; okunaklı yazı tercihi her zaman üstün.
- Ölçek: büyük başlık 1.36rem/700, kart başlığı 1–1.3rem/600–700, gövde 1rem, ikincil .86rem `--soluk`, etiket .72–.82rem/600.
- Başlıkta `text-wrap: balance`, paragrafta `pretty`, sayılarda `tabular-nums`. BÜYÜK HARF etiketi az kullan.

## Yerleşim ve bileşenler

- Güvenli alan: sabit çubuklar ve sayfalar `env(safe-area-inset-*)` kullanır; tam yükseklik `100dvh`.
- Dokunma hedefi en az 44px (Android'de 48px, `mobil.css`). Görsel olarak küçük düğmeyse dolguyu `::before` ile içte çiz, kutuyu 44px bırak.
- Çerçeve yerine boşluk ve gruplama: kartlarda kenarlık yok, açık temada çok hafif gölge, siyah temada yalnızca yüzey farkı. Ayırıcı ya da boşluk; ikisi birden değil. Ayırıcı .5px, simgeden sonra başlar.
- Liste: telefonda iOS gruplu liste (tek beyaz kap, satırlar arasında ince çizgi); geniş ekranda iki sütun hafif kart.
- Süzgeç: bölümlü denetim (gri ray, seçili beyaz kapsül), kapsül çip yığını değil.
- Düğme: birincil dolu `--ana`, ikincil `--dolgu` zeminli ve kenarlıksız, metin düğmesi `--vurgu` renginde. Uygulama "AÇ" kapsülü App Store'daki gibi.
- Arama: `--dolgu` zeminli, 44px, 12px köşe, büyüteç solda, temizle düğmesi sağda.
- Uygulama simgesi köşesi `--yaricap-ikon` (%22.5). Kart köşesi 16px, büyük kart/sayfa 22px, alttan sayfa 14px.
- Pencereler: telefonda alttan açılan sayfa (tutamaçlı, aşağı çekince kapanır), 760px üstünde ortada. Geri alınamaz iş için onay penceresi. İzin isteği iOS uyarısı gibi ortada.
- Gezinme çubuğu yarı saydam (`--malzeme` + blur) ve altında .5px çizgi. Profil gibi alt ekranlarda başlık ortada, geri oku solda `--vurgu` renginde.

## Android uygulaması (html.kabuk)

- Üst çubuk ve alt gezinme `position: fixed`; hiçbir sayfa geçişinde kaymaz, kaybolmaz (yalnızca modül, arama ve klavye açıkken gizlenir). İçerik payları `--ust` / `--alt` değişkenlerinden (kabuk.js çubukların gerçek yüksekliğini yazar).
- Sayfa yana kaymaz: `overflow-x: clip`; yana kayan yalnızca şerit bileşenleridir (öne çıkanlar, envanter, çipler). Yeni öğede `min-width: 0` ve `max-width: 100%` unutulmaz.
- Sekme geçişi yerinde solup yükselme (görünüm geçişi değil); seçimler alttan açılan sayfa (tutamaçlı, aşağı çekince kapanır: `surukleKur`). Geri tuşu: açık sayfa → arama → harita kartı → Ana sayfa → uygulama dışı.

## Hareket

- Yalnızca `transform` ve `opacity`. Eğri `--egri` (iOS sayfa eğrisi), geri bildirim ≤200ms, sayfa geçişi ~320ms. Zıplama yok.
- Basınca hafif küçülme (`scale(.98)`) ya da `--dolgu` vurgusu; üzerine gelince yukarı kalkma yok.
- `prefers-reduced-motion` ve `.hareket-az` tüm animasyonu kapatır.

## Erişilebilirlik

- Odak: 2px `--vurgu` çizgi, 2px boşluk; asla kaldırılmaz. Devre dışı: `opacity: .5; cursor: not-allowed`.
- Yalnızca simgeli düğmede `aria-label`. Girdilerde yapıştırma engellenmez. Hata, işlemin yanında gösterilir.

## Kontrol

Değişiklikten sonra `npm run dev` ile 390px ve 1280px genişlikte, beyaz ve siyah temada ana ekranı, arama sonuçlarını,
Erişilebilirlik sayfasını, eser sayfasını, tanışma sayfasını ve profili ekran görüntüsüyle karşılaştır.
