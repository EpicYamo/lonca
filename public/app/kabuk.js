// Uygulama kabuğu: Android uygulamasında (html.kabuk) Lonca'yı tek uzun sayfa yerine yerel bir uygulama gibi gösterir.
//  - Açılış ekranı: Android'in kendi açılış görselinden (aynı logo) devralır, veriler gelince solarak kapanır.
//  - Üst çubuk: bulunulan sayfanın adı (Ana sayfada Lonca markası); modül açıkken geri oklu modül çubuğu.
//  - Alt gezinme: Ana sayfa · Keşfet (harita) · Modüller · Profilim; her biri ayrı sayfa, aralarında yumuşak geçiş.
// Web'de yalnızca ?kabuk ile açılır (deneme için). app.js'e dokunmaz: profil ve ana ekran geçişleri onun kendi
// düğmeleriyle (#profil-cip, #profil-geri) yapılır, böylece veri yükleme ve hesap mantığı tek yerde kalır.
import { loncaLogo } from "/ortak/logo.js";

const kok = document.documentElement;
if (kok.classList.contains("lonca-native")) kok.classList.add("kabuk");
const etkin = kok.classList.contains("kabuk") && !new URLSearchParams(location.search).has("onizleme");

const $ = (s) => document.querySelector(s);
const SEKMELER = ["ana", "kesif", "moduller", "profil"];
const BASLIK = { ana: "Lonca", kesif: "Keşfet", moduller: "Modüller", profil: "Profilim" };
const hareketAz = () => kok.classList.contains("hareket-az") || matchMedia("(prefers-reduced-motion: reduce)").matches;
let sekme = "ana";

function acilisKapat() {
  const a = $("#acilis-ekrani");
  if (!a || a.classList.contains("gidiyor")) return;
  a.classList.add("gidiyor");
  setTimeout(() => a.classList.add("bitti"), hareketAz() ? 0 : 420);
}

// Geçiş: app.js'in görünüm geçişleri (gecis) bu bayrak varken "solup belirme" (fade-through) olarak çalışır.
function gecisBayragi(yon) {
  kok.dataset.sekmeGecis = yon;
  clearTimeout(gecisBayragi.z);
  gecisBayragi.z = setTimeout(() => { delete kok.dataset.sekmeGecis; }, 600);
}

function ciz() {
  $("#ana-ekran").dataset.sekme = sekme === "profil" ? "ana" : sekme;
  $("#marka-ad").textContent = BASLIK[sekme];
  // app.js harita gibi görünür olunca kurulan bölümler için dinler.
  dispatchEvent(new CustomEvent("lonca:sekme", { detail: sekme }));
  for (const b of document.querySelectorAll("#alt-gezinme [data-sekme]")) {
    if (b.dataset.sekme === sekme) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
  }
}

function sekmeyeGec(hedef, { kaydir = true } = {}) {
  if (!SEKMELER.includes(hedef)) return;
  const profilAcik = !$("#profil-ekrani").hidden;
  if (hedef === sekme && (hedef === "profil") === profilAcik) {
    // Aynı sekmeye yeniden dokunmak sayfanın başına götürür (Android alışkanlığı).
    scrollTo({ top: 0, behavior: hareketAz() ? "auto" : "smooth" });
    return;
  }
  const yon = SEKMELER.indexOf(hedef) >= SEKMELER.indexOf(sekme) ? "ileri" : "geri";
  gecisBayragi(yon);
  const onceki = sekme;
  sekme = hedef;
  if (hedef === "profil") { ciz(); $("#profil-cip").click(); return; }
  if (profilAcik) { ciz(); $("#profil-geri").click(); if (kaydir) scrollTo(0, 0); return; }
  // Ana sayfa · Keşfet · Modüller: aynı ekranın sayfaları; görünüm geçişiyle değiştir.
  const degistir = () => { ciz(); if (kaydir) scrollTo(0, 0); };
  if (!hareketAz() && document.startViewTransition && onceki !== hedef) {
    const g = document.startViewTransition(degistir);
    g.finished.finally(() => delete kok.dataset.sekmeGecis);
  } else degistir();
}

// Android geri tuşu (kopru.js çağırır): açık harita kartını kapatır; diğer sekmelerden Ana sayfaya döner;
// Ana sayfada arama doluysa temizler.
// İşi yaptıysa true döner; false ise uygulama arka plana alınır.
function geri() {
  if (!$("#modul-ekrani").hidden) return false;
  if (!$("#kh-kart")?.hidden) { $("#kh-kapat").click(); return true; }
  if (sekme !== "ana") { sekmeyeGec("ana"); return true; }
  const arama = $("#arama");
  if (arama?.value) { $("#arama-temizle")?.click(); return true; }
  if (scrollY > 200) { scrollTo({ top: 0, behavior: hareketAz() ? "auto" : "smooth" }); return true; }
  return false;
}

function kur() {
  const logo = $("#ae-logo");
  if (logo) logo.innerHTML = loncaLogo({ boyut: 84 });
  if (!etkin) { $("#acilis-ekrani")?.remove(); $("#alt-gezinme")?.remove(); return; }

  $("#alt-gezinme").addEventListener("click", (e) => {
    const b = e.target.closest("[data-sekme]");
    if (b) sekmeyeGec(b.dataset.sekme);
  });

  // Alt çubuk yalnızca Lonca'nın kendi sayfalarında; modül açıkken modül tam ekrandır.
  const nav = $("#alt-gezinme");
  const gozle = () => {
    const modulde = !$("#modul-ekrani").hidden;
    nav.hidden = modulde;
    kok.classList.toggle("kabuk-modulde", modulde);
    // Profil başka yoldan kapandıysa (ör. hesap işlemi sonrası ana ekrana dönüş) sekmeyi eşitle.
    const profilde = !$("#profil-ekrani").hidden;
    if (profilde && sekme !== "profil") { sekme = "profil"; ciz(); }
    else if (!profilde && sekme === "profil" && !$("#ana-ekran").hidden) { sekme = "ana"; ciz(); }
  };
  const o = new MutationObserver(gozle);
  for (const s of ["#modul-ekrani", "#profil-ekrani", "#ana-ekran"]) o.observe($(s), { attributes: true, attributeFilter: ["hidden"] });
  gozle();
  ciz();

  // Sayfa kayınca üst çubuk yüzey rengine geçer ve altına ince çizgi gelir (Material "kaydırınca yüksel").
  let kaydirildi = false;
  addEventListener("scroll", () => {
    const k = scrollY > 4;
    if (k !== kaydirildi) { kaydirildi = k; kok.classList.toggle("kaydirildi", k); }
  }, { passive: true });

  // Açılış ekranı: uygulama listesi dolunca (en geç 4,5 sn) kapanır; çok hızlı yanıtta logo bir an görünür kalır.
  const baslangic = performance.now();
  const kapat = () => setTimeout(acilisKapat, Math.max(0, 650 - (performance.now() - baslangic)));
  const liste = $("#moduller");
  if (liste.childElementCount) kapat();
  else new MutationObserver((_, mo) => { if (liste.childElementCount) { mo.disconnect(); kapat(); } }).observe(liste, { childList: true });
  setTimeout(acilisKapat, 4500);
  // Modül çubuğu: geri oku modülü kapatır (#geri ile aynı yol), başlık modülün adını izler.
  $("#modul-geri").addEventListener("click", () => $("#geri").click());
  const baslikEsle = () => { $("#modul-baslik").textContent = $("#baslik").textContent; };
  new MutationObserver(baslikEsle).observe($("#baslik"), { childList: true, characterData: true, subtree: true });
  baslikEsle();

  window.loncaKabuk = { geri, sekmeyeGec, get sekme() { return sekme; } };
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", kur, { once: true }); else kur();
