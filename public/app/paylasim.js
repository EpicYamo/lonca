// Paylaşım bağlantısıyla modül açma.
//  - Web: https://<alan>/m/<anahtar> sunucuda /app/?modul=<anahtar> adresine yönlenir; burada modül açılır.
//  - Android: aynı bağlantı (App Links ya da lonca://m/<anahtar>) uygulamayı açar; mobil/kopru.js anahtarı
//    window.loncaPaylasim'e yazar ve "lonca-paylasim" olayını yayar.
// Anahtar özel modülde tahmin edilemez bir dizgi, yayındaki modülde modül kimliğidir.

const ANAHTAR = /^[A-Za-z0-9_-]{1,64}$/;

// Bağlantıdan anahtarı çıkarır: .../m/<anahtar>, lonca://m/<anahtar> ya da ?modul=<anahtar>.
export function paylasimAnahtari(adres) {
  try {
    const u = new URL(adres, location.href);
    const yol = u.protocol === "lonca:" ? `/${u.host}${u.pathname}` : u.pathname;
    const eslesme = yol.match(/^\/m\/([^/]+)\/?$/);
    const anahtar = eslesme ? decodeURIComponent(eslesme[1]) : u.searchParams.get("modul");
    return anahtar && ANAHTAR.test(anahtar) ? anahtar : null;
  } catch {
    return null;
  }
}

const yerelMi = () => !!window.Capacitor?.isNativePlatform?.();

// Android tarayıcısında açılan bağlantı için "Uygulamada aç" şeridi (uygulama yoksa Play/indirme yerine bu sayfada kalır).
function uygulamadaAcSeridi(anahtar) {
  if (yerelMi() || !/Android/i.test(navigator.userAgent) || document.getElementById("paylasim-serit")) return;
  if (!document.getElementById("paylasim-stil")) {
    const stil = document.createElement("style");
    stil.id = "paylasim-stil";
    stil.textContent = `#paylasim-serit{position:fixed;z-index:60;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));display:flex;align-items:center;gap:8px;padding:8px 8px 8px 16px;border-radius:16px;background:var(--yuzey,#fff);color:var(--metin,#1d1d1f);box-shadow:0 6px 24px rgb(0 0 0 / .14);font:.9rem/1.3 var(--yazi-sistem,system-ui,sans-serif)}
#paylasim-serit span{flex:1}
#paylasim-serit a,#paylasim-serit button{min-height:44px;display:inline-flex;align-items:center;padding:0 14px;border-radius:12px;border:0;font:inherit;font-weight:600;text-decoration:none;cursor:pointer}
#paylasim-serit a{background:var(--ana,#1d1d1f);color:var(--zemin,#fff)}
#paylasim-serit button{background:transparent;color:var(--soluk,#6e6e73);padding:0 10px}`;
    document.head.append(stil);
  }
  const yedek = `${location.origin}/app/?modul=${encodeURIComponent(anahtar)}&uygulamasiz=1`;
  const hedef = `intent://m/${encodeURIComponent(anahtar)}#Intent;scheme=lonca;package=com.kozmos.lonca;S.browser_fallback_url=${encodeURIComponent(yedek)};end`;
  const serit = document.createElement("div");
  serit.id = "paylasim-serit";
  serit.setAttribute("role", "region");
  serit.setAttribute("aria-label", "Lonca uygulaması");
  const metin = document.createElement("span");
  metin.textContent = "Lonca uygulaman varsa bu modülü orada aç.";
  const ac = document.createElement("a");
  ac.href = hedef;
  ac.textContent = "Uygulamada aç";
  const kapat = document.createElement("button");
  kapat.type = "button";
  kapat.textContent = "Kapat";
  kapat.addEventListener("click", () => serit.remove(), { once: true });
  serit.append(metin, ac, kapat);
  document.body.append(serit);
}

/**
 * Paylaşılan modülü açar. `ac(modul)` uygulamanın modül açıcısıdır; modül nesnesi `kodYolu` taşır.
 * `hata(mesaj)` bağlantı geçersizse kullanıcıya söyler.
 */
export function paylasimiDinle({ ac, hata }) {
  let son = null;
  async function yukle(anahtar) {
    if (!anahtar || anahtar === son) return;
    son = anahtar;
    try {
      const y = await fetch(`/api/paylasim/${encodeURIComponent(anahtar)}`, { cache: "no-store" });
      const govde = await y.json().catch(() => ({}));
      if (!y.ok) throw new Error(govde.hata ?? "Bu bağlantı açılamadı.");
      ac({ ...govde, paylasim: anahtar, kodYolu: `/api/paylasim/${encodeURIComponent(anahtar)}/kod` });
      if (!new URLSearchParams(location.search).has("uygulamasiz")) uygulamadaAcSeridi(anahtar);
    } catch (h) {
      son = null;
      hata(h.message);
    }
  }
  window.addEventListener("lonca-paylasim", (e) => yukle(paylasimAnahtari(`/m/${e.detail}`)));
  yukle(window.loncaPaylasim ? paylasimAnahtari(`/m/${window.loncaPaylasim}`) : paylasimAnahtari(location.href));
}
