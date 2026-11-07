// Paylaşım bağlantısı ya da davet koduyla modül açma.
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
// Paylaşılan modülün özetini getirir; bulunamazsa sunucunun mesajıyla hata fırlatır.
async function modulGetir(anahtar) {
  const y = await fetch(`/api/paylasim/${encodeURIComponent(anahtar)}`, { cache: "no-store" });
  const govde = await y.json().catch(() => ({}));
  if (!y.ok) throw new Error(govde.hata ?? "Bu bağlantı açılamadı.");
  return { ...govde, paylasim: anahtar, kodYolu: `/api/paylasim/${encodeURIComponent(anahtar)}/kod` };
}

// Modüller bölümünün başındaki "Davet koduyla eriş" kartı: bireysel (özel) modülü kısa kodla açar.
// Android kabuğunda yalnızca Modüller sekmesinde görünür (data-sekme="moduller").
const DAVET_STILI = `
.davet-karti{display:grid;gap:.75rem;margin:0 0 1.6rem;padding:1.1rem 1.1rem 1rem;border-radius:var(--yaricap-buyuk,22px);background:var(--yuzey);box-shadow:var(--golge-kart,none)}
.davet-ust{display:flex;align-items:center;gap:.8rem}
.davet-simge{display:grid;place-items:center;flex:none;width:44px;height:44px;border-radius:12px;background:var(--dolgu);color:var(--vurgu)}
.davet-simge svg{width:24px;height:24px}
.davet-karti h2{margin:0;font-size:1.06rem;font-weight:650;letter-spacing:-.01em}
.davet-karti p{margin:.1rem 0 0;color:var(--soluk);font-size:.86rem;text-wrap:pretty}
.davet-form{display:flex;gap:.5rem}
.davet-form input{flex:1;min-width:0;min-height:48px;padding:0 1rem;border:0;border-radius:12px;background:var(--dolgu);color:var(--metin);font:inherit;font-size:1.05rem;font-variant-numeric:tabular-nums;letter-spacing:.08em;text-transform:uppercase}
.davet-form input::placeholder{color:var(--soluk);letter-spacing:.08em}
.davet-form input:focus{outline:2px solid var(--vurgu);outline-offset:0}
.davet-form button{flex:none;min-height:48px;padding:0 1.3rem;border:0;border-radius:12px;background:var(--ana);color:var(--ana-metin);font:inherit;font-weight:600;cursor:pointer;transition:transform .15s var(--egri,ease-out),opacity .15s var(--egri,ease-out)}
.davet-form button:active{transform:scale(.97)}
.davet-form button:disabled{opacity:.5;cursor:not-allowed}
.davet-hata{min-height:0;margin:0;color:var(--soluk);font-size:.86rem}
.davet-hata:empty{display:none}
.davet-karti.sarsil{animation:davet-sarsil .32s var(--egri,ease-out)}
@keyframes davet-sarsil{25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
@media (prefers-reduced-motion:reduce){.davet-karti.sarsil{animation:none}}
:root.hareket-az .davet-karti.sarsil{animation:none}
:root.kontrast .davet-karti{border:1px solid #fff}`;

function davetAlaniKur(ac) {
  const bolum = document.getElementById("modullerim-bolum");
  if (!bolum || document.getElementById("davet-karti")) return;
  if (!document.getElementById("davet-stil")) {
    const stil = document.createElement("style");
    stil.id = "davet-stil";
    stil.textContent = DAVET_STILI;
    document.head.append(stil);
  }
  const kart = document.createElement("section");
  kart.id = "davet-karti";
  kart.className = "davet-karti";
  kart.dataset.sekme = "moduller";
  kart.setAttribute("aria-labelledby", "davet-baslik");
  kart.innerHTML = `<div class="davet-ust">
      <span class="davet-simge" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 7a4 4 0 1 1-3.87 5H8v3H5v-3H3"/><circle cx="15" cy="11" r="1"/></svg></span>
      <div><h2 id="davet-baslik">Davet koduyla eriş</h2>
      <p id="davet-alt">Bir usta seninle bireysel modülünü paylaştıysa kodunu yaz.</p></div>
    </div>
    <form class="davet-form" novalidate>
      <label class="gizli" for="davet-girdi">Davet kodu</label>
      <input id="davet-girdi" placeholder="ABCD-EFGH" maxlength="12" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="go" aria-describedby="davet-alt davet-hata">
      <button type="submit">Aç</button>
    </form>
    <p class="davet-hata" id="davet-hata" role="alert"></p>`;
  bolum.before(kart);
  const girdi = kart.querySelector("#davet-girdi"), hataYeri = kart.querySelector("#davet-hata");
  const dugme = kart.querySelector('button[type="submit"]');
  const hataGoster = (metin) => {
    hataYeri.textContent = metin;
    kart.classList.remove("sarsil");
    void kart.offsetWidth; // animasyonu yeniden başlat
    kart.classList.add("sarsil");
  };
  // Yazarken ABCD-EFGH biçimine getir.
  girdi.addEventListener("input", () => {
    const k = girdi.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    girdi.value = k.length > 4 ? `${k.slice(0, 4)}-${k.slice(4)}` : k;
    hataYeri.textContent = "";
  });
  kart.querySelector("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const kod = girdi.value.replace(/-/g, "");
    if (kod.length !== 8) return hataGoster("Kod 8 harf ve rakamdan oluşur (örneğin ABCD-EFGH).");
    dugme.disabled = true;
    try {
      const m = await modulGetir(`${kod.slice(0, 4)}-${kod.slice(4)}`);
      girdi.value = "";
      girdi.blur();
      ac(m);
    } catch (h) {
      hataGoster(h.message === "Bu bağlantıda bir modül yok ya da artık paylaşılmıyor." ? "Bu kodla bir modül bulunamadı. Kodu ustaya bir daha sor." : h.message);
    } finally { dugme.disabled = false; }
  });
}

export function paylasimiDinle({ ac, hata }) {
  let son = null;
  async function yukle(anahtar) {
    if (!anahtar || anahtar === son) return;
    son = anahtar;
    try {
      ac(await modulGetir(anahtar));
      if (!new URLSearchParams(location.search).has("uygulamasiz")) uygulamadaAcSeridi(anahtar);
    } catch (h) {
      son = null;
      hata(h.message);
    }
  }
  davetAlaniKur(ac);
  window.addEventListener("lonca-paylasim", (e) => yukle(paylasimAnahtari(`/m/${e.detail}`)));
  yukle(window.loncaPaylasim ? paylasimAnahtari(`/m/${window.loncaPaylasim}`) : paylasimAnahtari(location.href));
}
