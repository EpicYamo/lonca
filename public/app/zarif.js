// Alttan açılan sayfaları aşağı sürükleyerek kapatma (iOS sayfa davranışı).
// Yalnızca telefon genişliğinde ve sayfanın içeriği en üstteyken çalışır; aksi hâlde normal kaydırma sürer.
// Kapatma, sayfanın kendi "vazgeç/kapat" düğmesine tıklanarak yapılır; böylece app.js'teki kapanış mantığı aynen işler.

const SAYFALAR = [
  { kutu: "#ayarlar .ayarlar-kutu", kapat: "#ayar-kapat" },
  { kutu: "#tanisma .ayarlar-kutu", kapat: "#tanisma-gec" },
  { kutu: "#hesap-penceresi .hesap-kutu", kapat: "#hesap-vazgec" },
  { kutu: "#katki .ayarlar-kutu", kapat: "#katki-vazgec" },
  { kutu: "#eser-penceresi", kapat: "#ep-x" },
];
const ESIK = 110;           // bu kadar piksel aşağı çekilirse kapanır
const HIZ_ESIGI = 0.6;      // ya da bu hızla (px/ms) fırlatılırsa
const darEkran = matchMedia("(max-width: 759px)");
const hareketAz = () => document.documentElement.classList.contains("hareket-az") || matchMedia("(prefers-reduced-motion: reduce)").matches;

function baglan({ kutu, kapat }) {
  const el = document.querySelector(kutu);
  if (!el) return;
  let baslangic = null, son = 0, sonZaman = 0, hiz = 0, cekiliyor = false;

  el.addEventListener("touchstart", (o) => {
    if (!darEkran.matches || o.touches.length !== 1) return;
    // Android kabuğunda eser sayfası tam ekrandır: aşağı çekince kapanmaz (geri oku ve geri tuşu kapatır).
    // Giriş, kayıt ve tanışma da uygulamada tam sayfadır; vazgeç düğmesi ve geri tuşu kapatır.
    if (["#eser-penceresi", "#hesap-penceresi .hesap-kutu", "#tanisma .ayarlar-kutu"].includes(kutu) && document.documentElement.classList.contains("kabuk")) return;
    // Form alanında ya da yatay şeritte başlayan dokunuş sürükleme sayılmaz.
    if (o.target.closest("input, textarea, select, .ep-fotolar, .ep-ilgili, .ep-harita, [type=range]")) return;
    if (el.scrollTop > 0) return;
    baslangic = o.touches[0].clientY; son = baslangic; sonZaman = o.timeStamp; hiz = 0; cekiliyor = false;
  }, { passive: true });

  el.addEventListener("touchmove", (o) => {
    if (baslangic === null) return;
    const y = o.touches[0].clientY, fark = y - baslangic;
    if (!cekiliyor && (fark < 6 || el.scrollTop > 0)) { if (fark < 0) baslangic = null; return; }
    cekiliyor = true;
    const dt = Math.max(1, o.timeStamp - sonZaman);
    hiz = (y - son) / dt; son = y; sonZaman = o.timeStamp;
    el.classList.add("surukleniyor");
    el.style.transform = `translateY(${Math.max(0, fark)}px)`;
    if (o.cancelable) o.preventDefault();
  }, { passive: false });

  const birak = () => {
    if (baslangic === null) return;
    const fark = son - baslangic;
    baslangic = null;
    el.classList.remove("surukleniyor");
    if (!cekiliyor) return;
    cekiliyor = false;
    if (fark > ESIK || hiz > HIZ_ESIGI) {
      const bitir = () => { el.classList.remove("yerine-otur"); el.style.transform = ""; document.querySelector(kapat)?.click(); };
      if (hareketAz()) return bitir();
      el.classList.add("yerine-otur");
      el.style.transform = "translateY(100%)";
      setTimeout(bitir, 220);
    } else {
      el.classList.add("yerine-otur");
      el.style.transform = "";
      setTimeout(() => el.classList.remove("yerine-otur"), 320);
    }
  };
  el.addEventListener("touchend", birak);
  el.addEventListener("touchcancel", birak);
}

SAYFALAR.forEach(baglan);
