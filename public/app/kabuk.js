// Uygulama kabuğu: Android uygulamasında (html.kabuk) Lonca'yı tek uzun sayfa yerine yerel bir uygulama gibi gösterir.
//  - Açılış ekranı: Android'in kendi açılış görselinden (aynı logo) devralır, veriler gelince solarak kapanır.
//  - İlk açılışta kaydırmalı tanıtım (3 sayfa, noktalar, Atla/İleri/Başla); sonra karşılama (giriş) ekranı.
//  - Üst uygulama çubuğu: sayfanın adı + sağda simge eylemleri (Ara, Davet kodu, tema, erişilebilirlik).
//  - Alt gezinme: Ana sayfa · Keşfet · Modüller · Profilim. Her sekme kendi kaydırma konumunu hatırlar;
//    Android geri tuşu geldiğin sekmeye, bıraktığın yere döner. Modülden dönünce de aynı yere gelinir.
//  - Tam ekran arama sayfası, alttan açılan davet kodu sayfası, sağdan kayan tam ekran eser sayfası.
//  - Dokunma dalgası (Material ripple) ve hafif titreşim.
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
const titret = (tur = "secim") => window.loncaMobil?.titret?.(tur);
const depoOku = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const depoYaz = (k, v) => { try { localStorage.setItem(k, v); } catch { /* gizli sekme */ } };

let sekme = "ana";
// Her sekmenin kaydırma konumu ve gezinme geçmişi (geri tuşu geldiğin sekmeye döner).
const konum = { ana: 0, kesif: 0, moduller: 0, profil: 0 };
const gecmis = [];
// Geçişler sırasında tarayıcının kendi kaydırma düzeltmeleri kayda geçmesin.
let kilit = false, sonKaydirma = 0;

const SVG = {
  ara: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.5 15.5L21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  anahtar: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3 20 3m-4 4 3 3m-5-1 2 2"/></svg>',
  geri: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12H5M11 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

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
  kok.dataset.sekme = sekme;
  $("#marka-ad").textContent = BASLIK[sekme];
  // Ana sayfanın büyük başlığı (h1) yalnızca orada görünür; diğer sayfalarda başlık çubuktaki sayfa adıdır.
  const ad = $("#marka-ad");
  if (sekme === "ana") { ad.removeAttribute("role"); ad.removeAttribute("aria-level"); }
  else { ad.setAttribute("role", "heading"); ad.setAttribute("aria-level", "1"); }
  // app.js harita gibi görünür olunca kurulan bölümler için dinler.
  dispatchEvent(new CustomEvent("lonca:sekme", { detail: sekme }));
  for (const b of document.querySelectorAll("#alt-gezinme [data-sekme]")) {
    if (b.dataset.sekme === sekme) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
  }
}

// İçerik geç dolabilir (profil, liste yeniden çizimi): hedef konuma inene kadar birkaç kare dener.
function konumaDon(y) {
  kilit = true;
  let deneme = 0;
  const adim = () => {
    scrollTo(0, y);
    if (Math.abs(scrollY - y) > 2 && deneme++ < 40) return requestAnimationFrame(adim);
    sonKaydirma = scrollY;
    requestAnimationFrame(() => { kilit = false; });
  };
  adim();
}

function sekmeyeGec(hedef, { geriDonus = false } = {}) {
  if (!SEKMELER.includes(hedef)) return;
  const profilAcik = !$("#profil-ekrani").hidden;
  if (hedef === sekme && (hedef === "profil") === profilAcik) {
    // Aynı sekmeye yeniden dokunmak sayfanın başına götürür (Android alışkanlığı).
    scrollTo({ top: 0, behavior: hareketAz() ? "auto" : "smooth" });
    return;
  }
  aramaKapat({ sessiz: true });
  davetKapat();
  konum[sekme] = sonKaydirma;
  if (!geriDonus && hedef !== sekme) {
    gecmis.push(sekme);
    if (gecmis.length > 12) gecmis.shift();
  }
  kilit = true;
  const yon = SEKMELER.indexOf(hedef) >= SEKMELER.indexOf(sekme) ? "ileri" : "geri";
  gecisBayragi(yon);
  const onceki = sekme;
  sekme = hedef;
  const hedefKonum = konum[hedef] ?? 0;
  if (hedef === "profil") { ciz(); $("#profil-cip").click(); konumaDon(0); return; }
  if (profilAcik) { ciz(); $("#profil-geri").click(); konumaDon(hedefKonum); return; }
  // Ana sayfa · Keşfet · Modüller: aynı ekranın sayfaları; görünüm geçişiyle değiştir.
  const degistir = () => { ciz(); scrollTo(0, hedefKonum); };
  if (!hareketAz() && document.startViewTransition && onceki !== hedef) {
    const g = document.startViewTransition(degistir);
    g.finished.finally(() => { delete kok.dataset.sekmeGecis; konumaDon(hedefKonum); });
  } else { degistir(); konumaDon(hedefKonum); }
}

// ---------- Tam ekran arama (Material arama görünümü) ----------
let aramaOncesi = 0;
function aramaAc() {
  if (kok.classList.contains("arama-sayfasi")) return;
  davetKapat();
  aramaOncesi = sonKaydirma;
  kilit = true;
  kok.classList.add("arama-sayfasi");
  $("#arama")?.focus({ preventScroll: true });
  requestAnimationFrame(() => { kilit = false; });
}
function aramaKapat({ sessiz = false } = {}) {
  if (!kok.classList.contains("arama-sayfasi")) return false;
  const girdi = $("#arama");
  if (girdi?.value) $("#arama-temizle")?.click();
  girdi?.blur();
  kok.classList.remove("arama-sayfasi");
  if (!sessiz) konumaDon(aramaOncesi);
  return true;
}

// ---------- Alttan açılan sayfa: davet kodu ----------
let perde = null;
function perdeyiKur() {
  perde = document.createElement("div");
  perde.className = "kabuk-perde";
  perde.hidden = true;
  perde.addEventListener("click", () => davetKapat());
  document.body.append(perde);
}
function davetAc() {
  const kart = $("#davet-karti");
  if (!kart) return;
  aramaKapat({ sessiz: true });
  perde.hidden = false;
  kart.classList.add("acik");
  kart.setAttribute("role", "dialog");
  kart.setAttribute("aria-modal", "true");
  kok.classList.add("sayfa-acik");
  $("#kabuk-davet")?.setAttribute("aria-expanded", "true");
  titret();
  setTimeout(() => $("#davet-girdi")?.focus(), hareketAz() ? 0 : 260);
}
function davetKapat() {
  const kart = $("#davet-karti");
  if (!kart?.classList.contains("acik")) return false;
  kart.classList.remove("acik");
  kart.style.transform = "";
  kart.removeAttribute("role");
  kart.removeAttribute("aria-modal");
  perde.hidden = true;
  kok.classList.remove("sayfa-acik");
  $("#davet-girdi")?.blur();
  const d = $("#kabuk-davet");
  d?.setAttribute("aria-expanded", "false");
  if (sekme === "moduller") d?.focus({ preventScroll: true });
  return true;
}
// Sayfayı aşağı çekince kapanır (tutamaçtan ya da başlıktan); kapatma ayrıca perdeye dokunarak ve geri tuşuyla.
function surukleKur(kart) {
  let bas = null, son = 0;
  kart.addEventListener("touchstart", (o) => {
    if (o.target.closest("input, button")) return;
    bas = o.touches[0].clientY; son = bas;
  }, { passive: true });
  kart.addEventListener("touchmove", (o) => {
    if (bas === null) return;
    son = o.touches[0].clientY;
    kart.style.transition = "none";
    kart.style.transform = `translateY(${Math.max(0, son - bas)}px)`;
  }, { passive: true });
  const birak = () => {
    if (bas === null) return;
    const fark = son - bas;
    bas = null;
    kart.style.transition = "";
    if (fark > 90) davetKapat(); else kart.style.transform = "";
  };
  kart.addEventListener("touchend", birak);
  kart.addEventListener("touchcancel", birak);
}

// ---------- Üst çubuk eylemleri ----------
function ustEylemleriKur() {
  const kap = $("#ust-bar .vitrin-dugmeler");
  if (!kap || $("#kabuk-ara")) return;
  const dugme = (id, ad, svg) => {
    const b = document.createElement("button");
    b.type = "button"; b.id = id; b.className = "kabuk-ikon"; b.setAttribute("aria-label", ad); b.title = ad;
    b.innerHTML = svg;
    return b;
  };
  const ara = dugme("kabuk-ara", "Ara", SVG.ara);
  ara.addEventListener("click", aramaAc);
  const davet = dugme("kabuk-davet", "Davet koduyla modül aç", SVG.anahtar);
  davet.setAttribute("aria-haspopup", "dialog");
  davet.setAttribute("aria-expanded", "false");
  davet.addEventListener("click", davetAc);
  kap.prepend(ara, davet);

  // Ana sayfadaki arama kutusuna dokunmak tam ekran aramayı açar.
  $("#arama")?.addEventListener("focus", aramaAc);
  // Arama sayfasının geri oku (kutunun solunda, büyütecin yerinde).
  const kutu = $(".arama-kutu");
  if (kutu && !$("#arama-geri")) {
    const g = document.createElement("button");
    g.type = "button"; g.id = "arama-geri"; g.className = "arama-geri"; g.setAttribute("aria-label", "Aramayı kapat");
    g.innerHTML = SVG.geri;
    g.addEventListener("click", (e) => { e.preventDefault(); aramaKapat(); });
    kutu.prepend(g);
  }
}

// Eser sayfası: uygulamada tam ekran, kapatma düğmesi sol üstte geri oku.
function eserSayfasiKur() {
  const x = $("#ep-x");
  if (!x) return;
  x.innerHTML = SVG.geri;
  x.setAttribute("aria-label", "Geri");
}

// ---------- Kaydırmalı tanıtım (yalnızca ilk açılışta, karşılamadan önce) ----------
const TANITIM = [
  { baslik: "Bursa'nın vakıf eserleri, cebinde", metin: "Camiler, hanlar, türbeler ve çeşmeler: envanter kaydı, fotoğrafları ve tarihçesiyle." },
  { baslik: "Haritada keşfet", metin: "Yakınındaki eserleri bul, haritada gez, bir eserden ilişkili eserlere geç." },
  { baslik: "Rehberler, oyunlar ve dalışlar", metin: "Modülleri aç, eserlerin içine dal; puan ve başarım topla, ilerlemen seninle kalsın." },
];
let tanitim = null;
function tanitimKur() {
  if (depoOku("lonca.tanitim") || tanitim) return;
  tanitim = document.createElement("section");
  tanitim.id = "tanitim";
  tanitim.className = "tanitim";
  tanitim.setAttribute("role", "dialog");
  tanitim.setAttribute("aria-modal", "true");
  tanitim.setAttribute("aria-label", "Lonca'yı tanı");
  tanitim.innerHTML = `
    <button type="button" class="tn-atla">Atla</button>
    <div class="tn-serit" tabindex="0" aria-label="Tanıtım sayfaları, yana kaydır">${TANITIM.map((s, i) => `
      <article class="tn-sayfa" aria-label="${i + 1} / ${TANITIM.length}">
        <div class="tn-gorsel" aria-hidden="true"><span class="tn-sayi">${String(i + 1).padStart(2, "0")}</span></div>
        <div class="tn-metin"><h2>${s.baslik}</h2><p>${s.metin}</p></div>
      </article>`).join("")}
    </div>
    <div class="tn-alt">
      <div class="tn-noktalar" aria-hidden="true">${TANITIM.map(() => "<i></i>").join("")}</div>
      <button type="button" class="dugme tn-ileri">İleri</button>
    </div>`;
  document.body.append(tanitim);
  const serit = tanitim.querySelector(".tn-serit");
  const noktalar = [...tanitim.querySelectorAll(".tn-noktalar i")];
  const sayfalar = [...tanitim.querySelectorAll(".tn-sayfa")];
  const ileri = tanitim.querySelector(".tn-ileri");
  const indeks = () => Math.round(serit.scrollLeft / Math.max(1, serit.clientWidth));
  const guncelle = () => {
    const i = indeks();
    noktalar.forEach((n, j) => n.classList.toggle("secili", j === i));
    // Ekran okuyucu yalnızca görünen sayfayı okur.
    sayfalar.forEach((s, j) => s.setAttribute("aria-hidden", String(j !== i)));
    ileri.textContent = i === TANITIM.length - 1 ? "Başla" : "İleri";
  };
  serit.addEventListener("scroll", () => requestAnimationFrame(guncelle), { passive: true });
  ileri.addEventListener("click", () => {
    const i = indeks();
    titret();
    if (i >= TANITIM.length - 1) return tanitimBitir();
    serit.scrollTo({ left: (i + 1) * serit.clientWidth, behavior: hareketAz() ? "auto" : "smooth" });
  });
  tanitim.querySelector(".tn-atla").addEventListener("click", tanitimBitir);
  guncelle();
  // Görseller: vitrinin fotoğrafları (çevrimdışı da pakette).
  fetch("/api/vitrin").then((y) => y.json()).then((v) => {
    const fotolar = [...new Set([v?.gununEseri?.foto, ...(v?.secki ?? []).map((s) => s.foto), ...Object.values(v?.kapaklar ?? {}).map((k) => k?.foto)].filter(Boolean))];
    tanitim?.querySelectorAll(".tn-gorsel").forEach((g, i) => { if (fotolar[i]) g.style.backgroundImage = `url("${fotolar[i]}")`; });
  }).catch(() => {});
  ileri.focus({ preventScroll: true });
}
function tanitimBitir() {
  if (!tanitim) return;
  depoYaz("lonca.tanitim", "1");
  const t = tanitim;
  tanitim = null;
  const sil = () => { t.remove(); $("#ks-giris")?.focus({ preventScroll: true }); };
  if (hareketAz()) return sil();
  t.classList.add("gidiyor");
  setTimeout(sil, 280);
}
function tanitimGeri() {
  if (!tanitim) return null;
  const serit = tanitim.querySelector(".tn-serit");
  const i = Math.round(serit.scrollLeft / Math.max(1, serit.clientWidth));
  if (i === 0) return false;
  serit.scrollTo({ left: (i - 1) * serit.clientWidth, behavior: hareketAz() ? "auto" : "smooth" });
  return true;
}

// ---------- Dokunma dalgası (Material ripple) ----------
const DALGA = ".kabuk-ikon, .pl-satir, .uygulama-satiri, .dugme, .kh-arac, .mc-geri, .mc-dugme, .ayar-dugme, .tema-dugme, .ag-ikon, .as-satir, .kh-liste button, .devam-karti, .gunun-karti, .kategori-cip, .arama-geri, .ep-x, .tn-atla, .metin-dugme, .secki-karti, .oc-kart, .pk-duzenle, .ks-devam, .bolumlu button";
function dalgaKur() {
  document.addEventListener("pointerdown", (o) => {
    if (o.button !== 0 || hareketAz()) return;
    let h = o.target.closest?.(DALGA);
    const nav = o.target.closest?.("#alt-gezinme button");
    if (nav) h = nav.querySelector(".ag-ikon");
    if (!h || h.disabled || h.closest("#sahne")) return;
    const r = h.getBoundingClientRect();
    const boyut = Math.max(r.width, r.height) * 2.2;
    const d = document.createElement("span");
    d.className = "dalga";
    d.setAttribute("aria-hidden", "true");
    d.style.cssText = `width:${boyut}px;height:${boyut}px;left:${o.clientX - r.left - boyut / 2}px;top:${o.clientY - r.top - boyut / 2}px`;
    // Konumlandırılmamış öğe dalgayı içine alsın diye göreli olur; zaten konumluysa (absolute/fixed) dokunulmaz.
    if (!h.classList.contains("dalgali") && getComputedStyle(h).position === "static") h.style.position = "relative";
    h.classList.add("dalgali");
    h.append(d);
    let bitti = false;
    const bitir = () => { if (bitti) return; bitti = true; d.classList.add("bitiyor"); setTimeout(() => d.remove(), 320); };
    addEventListener("pointerup", bitir, { once: true });
    addEventListener("pointercancel", bitir, { once: true });
    setTimeout(bitir, 900);
  }, { passive: true });
}

// Android geri tuşu (kopru.js çağırır). Sıra: tanıtım → alttan sayfa → arama → harita kartı/liste → önceki sekme.
// İşi yaptıysa true döner; false ise uygulama arka plana alınır.
function geri() {
  if (!$("#modul-ekrani").hidden) return false;
  const t = tanitimGeri();
  if (t !== null) return t;
  if (davetKapat()) return true;
  if (aramaKapat()) return true;
  if ($("#kh-kart") && !$("#kh-kart").hidden) { $("#kh-kapat").click(); return true; }
  if ($("#kh-liste") && !$("#kh-liste").hidden) { $("#kh-liste-dugme")?.click(); return true; }
  while (gecmis.length) {
    const onceki = gecmis.pop();
    if (onceki !== sekme) { sekmeyeGec(onceki, { geriDonus: true }); return true; }
  }
  if (sekme !== "ana") { sekmeyeGec("ana", { geriDonus: true }); return true; }
  if (scrollY > 200) { scrollTo({ top: 0, behavior: hareketAz() ? "auto" : "smooth" }); return true; }
  return false;
}

function kur() {
  const logo = $("#ae-logo");
  if (logo) logo.innerHTML = loncaLogo({ boyut: 84 });
  if (!etkin) { $("#acilis-ekrani")?.remove(); $("#alt-gezinme")?.remove(); return; }

  perdeyiKur();
  ustEylemleriKur();
  eserSayfasiKur();
  dalgaKur();

  $("#alt-gezinme").addEventListener("click", (e) => {
    const b = e.target.closest("[data-sekme]");
    if (b) sekmeyeGec(b.dataset.sekme);
  });

  // Davet kartı paylasim.js tarafından sonradan eklenir: gelince alttan sayfaya dönüştür.
  const davetHazirla = () => {
    const kart = $("#davet-karti");
    if (!kart) return false;
    if (kart.dataset.kabuk) return true;
    kart.dataset.kabuk = "1";
    const tutamac = document.createElement("span");
    tutamac.className = "kabuk-tutamac";
    tutamac.setAttribute("aria-hidden", "true");
    kart.prepend(tutamac);
    surukleKur(kart);
    document.body.append(kart);
    return true;
  };
  if (!davetHazirla()) {
    const mo = new MutationObserver(() => { if (davetHazirla()) mo.disconnect(); });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  // Alt çubuk yalnızca Lonca'nın kendi sayfalarında; modül açıkken modül tam ekrandır.
  const nav = $("#alt-gezinme");
  let modulde = false;
  const gozle = () => {
    const simdiModulde = !$("#modul-ekrani").hidden;
    if (simdiModulde !== modulde) {
      modulde = simdiModulde;
      if (modulde) { kilit = true; konum[sekme] = sonKaydirma; davetKapat(); }
      // Modülden dönünce bıraktığın yere.
      else konumaDon(konum[sekme] ?? 0);
    }
    nav.hidden = modulde;
    kok.classList.toggle("kabuk-modulde", modulde);
    const profilde = !$("#profil-ekrani").hidden;
    kok.classList.toggle("kabuk-profilde", profilde && !modulde);
    // Profil başka yoldan açıldı/kapandıysa (ör. hesap işlemi sonrası ana ekrana dönüş) sekmeyi eşitle.
    if (profilde && sekme !== "profil") { gecmis.push(sekme); sekme = "profil"; ciz(); }
    else if (!profilde && sekme === "profil" && !$("#ana-ekran").hidden) { sekme = gecmis.pop() ?? "ana"; ciz(); }
  };
  const o = new MutationObserver(gozle);
  for (const s of ["#modul-ekrani", "#profil-ekrani", "#ana-ekran"]) o.observe($(s), { attributes: true, attributeFilter: ["hidden"] });
  gozle();
  ciz();

  // Sayfa kayınca üst çubuk yüzey rengine geçer ve altına ince çizgi gelir (Material "kaydırınca yüksel").
  let kaydirildi = false;
  addEventListener("scroll", () => {
    if (!kilit && !modulde && !kok.classList.contains("arama-sayfasi")) sonKaydirma = scrollY;
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

  // Karşılama ilk kez açılınca önce kaydırmalı tanıtım gelir.
  const ks = $("#karsilama");
  if (ks) {
    const bak = () => { if (!ks.hidden) tanitimKur(); };
    new MutationObserver(bak).observe(ks, { attributes: true, attributeFilter: ["hidden"] });
    bak();
  }

  // Modül çubuğu: geri oku modülü kapatır (#geri ile aynı yol), başlık modülün adını izler.
  $("#modul-geri").addEventListener("click", () => $("#geri").click());
  const baslikEsle = () => { $("#modul-baslik").textContent = $("#baslik").textContent; };
  new MutationObserver(baslikEsle).observe($("#baslik"), { childList: true, characterData: true, subtree: true });
  baslikEsle();

  // Escape (klavye/erişilebilirlik): açık alttan sayfa ya da boş arama kapanır.
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (davetKapat() || (kok.classList.contains("arama-sayfasi") && !$("#arama").value && aramaKapat())) e.preventDefault();
  });

  window.loncaKabuk = { geri, sekmeyeGec, aramaAc, davetAc, get sekme() { return sekme; } };
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", kur, { once: true }); else kur();
