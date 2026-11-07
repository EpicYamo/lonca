// Web sitesi düzeni: Android uygulaması (html.kabuk) dışında, tarayıcıda açılan Lonca.
//  - Sayfalar: Ana sayfa (/), Keşfet (/#kesif, harita), Modüller (/#moduller), Profil (/#profil). Üst gezinmeden geçilir;
//    adres çubuğu güncellenir, tarayıcının geri/ileri düğmeleri ve yeni sekmede açma çalışır.
//  - Görünüm: web.css (masaüstü, tablet, telefon kırılımları). Android'in kabuğu (kabuk.js/kabuk.css) ayrıdır.
// app.js'e dokunmaz: profile #profil-cip ile girilir, #profil-geri ile çıkılır; böylece veri ve hesap mantığı tek yerde kalır.
import { ciniArkaPlan } from "/ortak/cini.js";
import { loncaLogo } from "/ortak/logo.js";

const kok = document.documentElement;
const ONIZLEME = new URLSearchParams(location.search).has("onizleme");
const $ = (s) => document.querySelector(s);
const SEKMELER = ["ana", "kesif", "moduller", "profil"];
const BASLIK = { ana: "Lonca", kesif: "Keşfet · Lonca", moduller: "Modüller · Lonca", profil: "Profilim · Lonca" };
const hareketAz = () => kok.classList.contains("hareket-az") || matchMedia("(prefers-reduced-motion: reduce)").matches;

function kur() {
  if (kok.classList.contains("kabuk") || kok.classList.contains("lonca-native") || kok.classList.contains("gomulu") || ONIZLEME) { kok.classList.remove("web-sekmeli"); $("#web-gezinme")?.remove(); return; }
  kok.classList.add("web-sekmeli");
  // Web'de ana sayfa uygulamaları da gösterir (vitrin); Modüller sayfasında süzgeç ve sıralamayla tam liste.
  document.querySelector(".uygulamalar")?.setAttribute("data-sekme", "ana moduller");

  const anaEkran = $("#ana-ekran"), profilEkrani = $("#profil-ekrani");
  let sekme = "ana";
  const adrestenSekme = () => {
    // Adresler "#/kesif" biçiminde (sayfadaki id'lerle, ör. #moduller listesiyle, çakışıp kaydırmasın); eski "#kesif" de olur.
    const h = location.hash.replace(/^#\/?/, "");
    return SEKMELER.includes(h) ? h : "ana";
  };
  const adres = (s) => (s === "ana" ? `${location.pathname}${location.search}` : `${location.pathname}${location.search}#/${s}`);

  function ciz() {
    if (sekme !== "profil") anaEkran.dataset.sekme = sekme;
    for (const a of document.querySelectorAll("#web-gezinme [data-sekme]")) {
      if (a.dataset.sekme === sekme) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    }
    $("#profil-cip")?.setAttribute("aria-current", sekme === "profil" ? "page" : "false");
    if ($("#modul-ekrani").hidden) document.title = BASLIK[sekme];
    // app.js harita gibi görünür olunca kurulan bölümler için dinler (kabuk.js ile aynı olay).
    dispatchEvent(new CustomEvent("lonca:sekme", { detail: sekme }));
  }

  // Bir sayfaya geç: kaydet = adres çubuğuna yeni kayıt ekle (gezinme düğmeleri); geri/ileri ile gelindiyse ekleme.
  function git(hedef, { kaydet = true } = {}) {
    if (!SEKMELER.includes(hedef)) hedef = "ana";
    const profilAcik = !profilEkrani.hidden;
    if (hedef === sekme && (hedef === "profil") === profilAcik) { scrollTo({ top: 0, behavior: hareketAz() ? "auto" : "smooth" }); return; }
    if (kaydet && adrestenSekme() !== hedef) history.pushState({ sekme: hedef }, "", adres(hedef));
    sekme = hedef;
    if (hedef === "profil") { ciz(); if (!profilAcik) profilSayfasi(); return; }
    if (profilAcik) { ciz(); $("#profil-geri").click(); scrollTo(0, 0); return; }
    const degistir = () => { ciz(); scrollTo(0, 0); };
    if (!hareketAz() && document.startViewTransition) {
      kok.dataset.webGecis = "1";
      const g = document.startViewTransition(degistir);
      g.ready.catch(() => {});
      g.finished.catch(() => {}).finally(() => delete kok.dataset.webGecis);
    } else degistir();
    // Ekran okuyucu ve klavye için odak yeni sayfanın başlığına.
    requestAnimationFrame(() => anaEkran.querySelector(`[data-sekme~="${hedef}"] h2`)?.focus?.({ preventScroll: true }));
  }

  $("#web-gezinme").addEventListener("click", (e) => {
    const a = e.target.closest("a[data-sekme]");
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return; // yeni sekmede açma tarayıcıya kalır
    e.preventDefault();
    git(a.dataset.sekme);
  });
  addEventListener("popstate", () => git(adrestenSekme(), { kaydet: false }));

  // Profil başka yoldan açılır/kapanırsa (üst sağdaki profil, hesap işlemleri, modülden dönüş) adresi ve gezinmeyi eşitle.
  new MutationObserver(() => {
    const profilde = !profilEkrani.hidden;
    if (profilde && sekme !== "profil") {
      sekme = "profil";
      if (adrestenSekme() !== "profil") history.pushState({ sekme }, "", adres("profil"));
      ciz();
    } else if (!profilde && sekme === "profil" && !anaEkran.hidden) {
      sekme = anaEkran.dataset.sekme && anaEkran.dataset.sekme !== "profil" ? anaEkran.dataset.sekme : "ana";
      if (adrestenSekme() === "profil") history.pushState({ sekme }, "", adres(sekme));
      ciz();
    }
  }).observe(profilEkrani, { attributes: true, attributeFilter: ["hidden"] });

  // ---------- Profil menüsü ve "Giriş yap" ----------
  // Üst sağdaki profil düğmesi web'de bir açılır menü açar (özet, Profilim, Modüllerim, erişilebilirlik, Studio, giriş/çıkış).
  // Profil sayfası menüden ya da /#profil adresinden açılır; sitenin üst çubuğu altında normal bir sayfadır.
  const cip = $("#profil-cip");
  let cipGecir = false;
  function profilSayfasi() { cipGecir = true; cip.click(); cipGecir = false; }
  const H = () => window.loncaHesap;

  const girisDugmesi = Object.assign(document.createElement("button"), { type: "button", className: "web-giris", textContent: "Giriş yap" });
  girisDugmesi.addEventListener("click", () => H()?.ac("giris")?.then(girisCiz));
  $(".vitrin-dugmeler").append(girisDugmesi);
  const girisCiz = () => { girisDugmesi.hidden = !!H()?.kullanici; };

  const menu = document.createElement("div");
  menu.id = "profil-menu";
  menu.className = "profil-menu";
  menu.hidden = true;
  menu.setAttribute("role", "menu");
  menu.setAttribute("aria-label", "Profil menüsü");
  document.body.append(menu);
  cip.setAttribute("aria-haspopup", "menu");
  cip.setAttribute("aria-expanded", "false");
  cip.setAttribute("aria-controls", "profil-menu");

  const oge = (metin, tik, { ikincil = "", sinif = "" } = {}) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = `pm-oge ${sinif}`; b.setAttribute("role", "menuitem");
    b.append(Object.assign(document.createElement("span"), { textContent: metin }));
    if (ikincil) b.append(Object.assign(document.createElement("small"), { textContent: ikincil }));
    b.addEventListener("click", () => { menuKapat(false); tik(); });
    return b;
  };
  function menuCiz() {
    const p = H()?.profil?.() ?? { ad: $("#cip-ad")?.textContent ?? "Gezgin", seviye: 1, puan: 0 };
    const k = H()?.kullanici;
    const ust = document.createElement("div");
    ust.className = "pm-ust";
    const av = $("#cip-avatar").cloneNode(true);
    av.removeAttribute("id");
    ust.append(av, Object.assign(document.createElement("div"), { className: "pm-kim" }));
    ust.lastChild.append(
      Object.assign(document.createElement("strong"), { textContent: p.ad }),
      Object.assign(document.createElement("span"), { textContent: k ? `@${k.kimlik} · Seviye ${p.seviye}` : `Misafir · Seviye ${p.seviye} · ${p.puan} puan` }));
    const ayrac = () => Object.assign(document.createElement("hr"), { className: "pm-ayrac" });
    const ogeler = [
      oge("Profilim", () => git("profil"), { ikincil: "Puan, başarımlar, ayarlar" }),
      oge("Modüllerim", () => git("moduller")),
      oge("Erişilebilirlik ve görünüm", () => $("#ust-bar [data-ayar]")?.click()),
      oge(kok.dataset.tema === "koyu" ? "Açık tema" : "Koyu tema", () => $("#tema-dugme")?.click(), { sinif: "pm-dar" }),
      oge($("#dil-dugme")?.textContent.trim() === "EN" ? "English" : "Türkçe", () => $("#dil-dugme")?.click(), { sinif: "pm-dar" }),
      oge("Lonca Studio", () => window.open("/studio/", "_blank", "noopener"), { ikincil: "Modül hazırla · yeni sekmede" }),
    ];
    const hesap = k
      ? [oge("Oturumu kapat", () => { H()?.cikis(); girisCiz(); }, { sinif: "tehlike" })]
      : [oge("Giriş yap", () => H()?.ac("giris")?.then(girisCiz), { sinif: "vurgulu" }), oge("Hesap oluştur", () => H()?.ac("kayit")?.then(girisCiz))];
    menu.replaceChildren(ust, ayrac(), ...ogeler, ayrac(), ...hesap);
  }
  function menuAc() {
    menuCiz();
    const r = cip.getBoundingClientRect();
    menu.style.top = `${r.bottom + 8}px`;
    menu.style.right = `${Math.max(8, innerWidth - r.right)}px`;
    menu.hidden = false;
    cip.setAttribute("aria-expanded", "true");
    menu.querySelector(".pm-oge")?.focus({ preventScroll: true });
  }
  function menuKapat(odakla = true) {
    if (menu.hidden) return;
    menu.hidden = true;
    cip.setAttribute("aria-expanded", "false");
    if (odakla) cip.focus({ preventScroll: true });
  }
  // app.js'in profil açma dinleyicisinden önce yakala: web'de önce menü.
  cip.addEventListener("click", (e) => {
    if (cipGecir) return;
    e.stopImmediatePropagation();
    if (menu.hidden) menuAc(); else menuKapat();
  }, true);
  document.addEventListener("pointerdown", (e) => { if (!menu.hidden && !menu.contains(e.target) && !cip.contains(e.target)) menuKapat(false); });
  menu.addEventListener("keydown", (e) => {
    const ogeler = [...menu.querySelectorAll(".pm-oge")];
    const i = ogeler.indexOf(document.activeElement);
    if (e.key === "Escape") { e.preventDefault(); menuKapat(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); ogeler[(i + 1) % ogeler.length]?.focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); ogeler[(i - 1 + ogeler.length) % ogeler.length]?.focus(); }
    else if (e.key === "Home") { e.preventDefault(); ogeler[0]?.focus(); }
    else if (e.key === "End") { e.preventDefault(); ogeler.at(-1)?.focus(); }
    else if (e.key === "Tab") menuKapat(false);
  });
  addEventListener("resize", () => menuKapat(false));
  new MutationObserver(girisCiz).observe($("#cip-ad"), { childList: true, characterData: true, subtree: true });
  setTimeout(girisCiz, 0);
  addEventListener("focus", girisCiz);

  susleKur();

  // Başlıklar odak alabilsin (sayfa geçişinde odak taşınır), görünür çerçeve çizmeden.
  for (const h of anaEkran.querySelectorAll("section[data-sekme] > .bolum-ust h2, section[data-sekme] > h2")) if (!h.hasAttribute("tabindex")) h.tabIndex = -1;

  // Üst çubuk sayfa kayınca hafif gölge alır.
  let kaydi = false;
  addEventListener("scroll", () => { const k = scrollY > 4; if (k !== kaydi) { kaydi = k; kok.classList.toggle("web-kaydi", k); } }, { passive: true });

  sekme = "ana";
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  const ilk = adrestenSekme();
  if (ilk !== "ana") requestAnimationFrame(() => scrollTo(0, 0));
  if (ilk === "profil") { sekme = "ana"; ciz(); git("profil", { kaydet: false }); }
  else { sekme = ilk; ciz(); }
}

// ---------- Süsleme: kayan yazı bandı, çini şeritler, alt bilgi, kaydırınca beliren bölümler ----------
const TUR = { cami: "Cami", mescit: "Mescit", han: "Han", hamam: "Hamam", cesme: "Çeşme", turbe: "Türbe", medrese: "Medrese", kulliye: "Külliye", kopru: "Köprü", carsi: "Çarşı", imaret: "İmaret", tekke: "Tekke" };
function susleKur() {
  // Kayan yazı: envanterden eser adları. Süs amaçlı (ekran okuyucudan gizli); üzerine gelince ya da odakta durur,
  // "Durdur" düğmesiyle kalıcı durur, hareketi azalt tercihlerinde hiç kaymaz.
  const bant = document.createElement("section");
  bant.className = "kayan-bant";
  bant.dataset.sekme = "ana";
  bant.setAttribute("aria-label", "Envanterden eser adları");
  bant.innerHTML = `<div class="kb-iz" aria-hidden="true"><div class="kb-serit"></div><div class="kb-serit"></div></div>
    <button type="button" class="kb-durdur" aria-pressed="false" aria-label="Kayan yazıyı durdur">
      <svg class="kb-dur" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>
      <svg class="kb-oynat" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>
    </button>`;
  bant.style.setProperty("--cini", ciniArkaPlan("lonca-bant", "firuze"));
  const arama = document.querySelector(".arama-alani");
  arama?.after(bant);
  const durdur = bant.querySelector(".kb-durdur");
  durdur.addEventListener("click", () => {
    const d = !bant.classList.contains("durdu");
    bant.classList.toggle("durdu", d);
    durdur.setAttribute("aria-pressed", String(d));
    durdur.setAttribute("aria-label", d ? "Kayan yazıyı başlat" : "Kayan yazıyı durdur");
  });
  fetch("/api/eserler").then((y) => y.json()).then((liste) => {
    const secilen = liste.filter((e) => e.ad).sort(() => Math.random() - 0.5).slice(0, 28);
    const parca = () => secilen.map((e) => {
      const s = document.createElement("span");
      s.className = "kb-oge";
      const meta = [TUR[e.tur], e.yuzyil ? `${e.yuzyil}. yy` : null, e.ilce].filter(Boolean).join(" · ");
      s.append(Object.assign(document.createElement("strong"), { textContent: e.ad }), Object.assign(document.createElement("small"), { textContent: meta }));
      return s;
    });
    for (const serit of bant.querySelectorAll(".kb-serit")) serit.replaceChildren(...parca());
    bant.style.setProperty("--kb-sure", `${Math.max(40, secilen.length * 3.2)}s`);
    bant.classList.add("hazir");
  }).catch(() => bant.remove());

  // Çini şerit: kapağın altında ince süs bordürü.
  const bordur = document.createElement("div");
  bordur.className = "cini-bordur";
  bordur.setAttribute("aria-hidden", "true");
  bordur.dataset.sekme = "ana";
  bordur.style.backgroundImage = ciniArkaPlan("lonca-bordur", "kobalt");
  document.querySelector("#vitrin")?.after(bordur);

  // Alt bilgi
  const alt = document.createElement("footer");
  alt.className = "web-alt";
  alt.innerHTML = `<div class="wa-cini" aria-hidden="true"></div>
    <div class="wa-ic">
      <div class="wa-marka"><span class="wa-logo" aria-hidden="true"></span><div><strong>Lonca</strong>
        <p>Bursa'nın vakıf eserlerini rehberler, oyunlar, haritalar ve dalışlarla keşfet. İçerik kaynaklı; her ad ve tarih envanterde geçer.</p></div></div>
      <nav class="wa-baglantilar" aria-label="Alt bilgi">
        <div><h2>Keşfet</h2><a href="/">Ana sayfa</a><a href="/#/kesif">Harita</a><a href="/#/moduller">Modüller</a></div>
        <div><h2>Katkı</h2><a href="/#/profil">Profilim</a><a href="/studio/" target="_blank" rel="noopener">Lonca Studio</a><button type="button" class="wa-oner">Eser öner</button></div>
      </nav>
      <p class="wa-kaynak">Veriler: Vakıf Katılım, <em>Bursa, Konya ve Hatay vakıf eserleri kitapları</em>. Fotoğraflar envanter kitaplarındandır. Vikipedi içerikleri CC BY-SA.</p>
    </div>`;
  alt.querySelector(".wa-logo").innerHTML = loncaLogo({ boyut: 36 });
  alt.querySelector(".wa-cini").style.backgroundImage = ciniArkaPlan("lonca-alt", "firuze");
  alt.querySelector(".wa-oner").addEventListener("click", () => document.querySelector("#eser-oner")?.click());
  for (const a of alt.querySelectorAll('a[href^="/#"], a[href="/"]')) {
    a.addEventListener("click", (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      const h = a.getAttribute("href").replace(/^\//, "");
      if (location.hash !== h) { history.pushState({}, "", h || location.pathname); dispatchEvent(new PopStateEvent("popstate")); }
      scrollTo(0, 0);
    });
  }
  document.querySelector("#bildirimler").before(alt);

  // Kaydırınca beliren bölümler: yalnızca hareket serbestse; içerik JS olmadan da görünür kalır.
  if (!hareketAz() && "IntersectionObserver" in window) {
    kok.classList.add("belirme");
    const g = new IntersectionObserver((k) => {
      for (const x of k) if (x.isIntersecting) { x.target.classList.add("belirdi"); g.unobserve(x.target); }
    }, { rootMargin: "0px 0px -8% 0px" });
    // Gizli sayfadaki bölümler görünür olunca yeniden izlenir (display:none iken kesişim hesaplanmaz).
    const izle = () => requestAnimationFrame(() => {
      for (const b of document.querySelectorAll(".meydan-ana > section:not(.belirdi), .meydan-yan > section:not(.belirdi), .web-alt:not(.belirdi)")) {
        g.unobserve(b);
        g.observe(b);
      }
    });
    addEventListener("lonca:sekme", izle);
    izle();
  }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", kur, { once: true }); else kur();
