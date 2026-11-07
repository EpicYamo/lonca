// Lonca web sitesi (kozmos.itaskira.com). Android uygulamasından ayrıdır: kendi düzeni, kendi stili (site.css).
// Uygulamayla yalnızca public/ortak/ yardımcılarını (dil, çini, logo, arama) paylaşır. Modüller sitenin içinde
// değil, modül oynatıcısında (/app/?modul=<id>&gomulu=1) açılır; oradan kapatınca siteye dönülür.
//
// Bölümler: modül vitrini (slideshow) → sayılar → modüller → eserler (süzgeçli duvar) → harita → dalışlar →
// günün eseri → Studio çağrısı. Eser sayfası: /#/eser/<kimlik>.
import { dilAl, dilDegisince } from "/ortak/dil.js";
import { ciniArkaPlan } from "/ortak/cini.js";
import { loncaLogo } from "/ortak/logo.js";
import { TUR_ADLARI, eserAra } from "/ortak/arama.js";
import { modulRozeti, eserRozeti } from "/ortak/dogrulama.js";
import { el, foto, sahneGorseli, temaStili, kategoriAdi } from "/web/sahneler.js";

const $ = (s) => document.querySelector(s);
const kok = document.documentElement;
const hareketAz = () => matchMedia("(prefers-reduced-motion: reduce)").matches || kok.classList.contains("hareket-az");
const depoOku = (k, v = null) => { try { return JSON.parse(localStorage.getItem(k)) ?? v; } catch { return v; } };
const depoYaz = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const getir = async (yol) => { const y = await fetch(yol); if (!y.ok) throw new Error(`${y.status}`); return y.json(); };

export const modulAdresi = (id) => `/app/?modul=${encodeURIComponent(id)}&gomulu=1`;
const eserAdresi = (id) => `/#/eser/${encodeURIComponent(id)}`;
const turAdi = (t) => TUR_ADLARI[t] ?? "Yapı";
const yuzyilYazi = (y) => (y ? `${y}. yüzyıl` : null);
// Birden çok ilden eser varsa künyede il de yazılır (Osmangazi, Bursa); tek ilde yalnızca ilçe.
let cokIlli = false;
const yer = (e) => (cokIlli ? [e.ilce, e.il].filter(Boolean).join(", ") : e.ilce || e.il);
const kunye = (e) => [turAdi(e.tur), yuzyilYazi(e.yuzyil), yer(e)].filter(Boolean).join(" · ");

$("#logo").innerHTML = loncaLogo({ boyut: 30 });
$("#alt-logo").innerHTML = loncaLogo({ boyut: 26 });

// ---------- Tema ----------
const temaDugme = $("#tema");
function temaCiz() {
  const koyu = kok.dataset.tema === "koyu";
  temaDugme.setAttribute("aria-pressed", String(koyu));
  temaDugme.setAttribute("aria-label", koyu ? "Açık temaya geç" : "Koyu temaya geç");
  document.querySelector('meta[name="theme-color"]').content = koyu ? "#0f0f0d" : "#f6f4ef";
}
temaDugme.addEventListener("click", () => {
  const koyu = kok.dataset.tema !== "koyu";
  if (koyu) kok.dataset.tema = "koyu"; else delete kok.dataset.tema;
  try { localStorage.setItem("lonca.tema", koyu ? "koyu" : "acik"); } catch {}
  temaCiz();
});
temaCiz();

// ---------- Erişilebilirlik (uygulamayla aynı anahtar: lonca.erisim) ----------
const SINIF = { okunakli: "okunakli", aralik: "aralik", kontrast: "kontrast", sade: "sade", odak: "belirgin-odak", hareket: "hareket-az" };
const VARSAYILAN = { yazi: "1", okunakli: false, aralik: false, kontrast: false, sade: false, odak: false, hareket: false };
const tercih = { ...VARSAYILAN, ...depoOku("lonca.erisim", {}) };
function tercihUygula() {
  kok.style.setProperty("--olcek", String(Number(tercih.yazi) || 1));
  for (const [ad, sinif] of Object.entries(SINIF)) kok.classList.toggle(sinif, !!tercih[ad]);
  document.querySelectorAll("#erisim [data-tercih]").forEach((k) => { k.checked = !!tercih[k.dataset.tercih]; });
  const r = document.querySelector(`#erisim input[name="yazi"][value="${tercih.yazi}"]`);
  if (r) r.checked = true;
  depoYaz("lonca.erisim", { ...depoOku("lonca.erisim", {}), ...tercih });
  if (tercih.hareket) vitrin?.durdur(true);
}
document.querySelectorAll("#erisim [data-tercih]").forEach((k) => k.addEventListener("change", () => { tercih[k.dataset.tercih] = k.checked; tercihUygula(); }));
document.querySelectorAll('#erisim input[name="yazi"]').forEach((r) => r.addEventListener("change", () => { tercih.yazi = r.value; tercihUygula(); }));
$("#erisim-sifirla").addEventListener("click", () => { Object.assign(tercih, VARSAYILAN); tercihUygula(); });

// Perdeli pencere (erişilebilirlik, arama): Esc ve dışına tıklama kapatır, odak açan düğmeye döner.
function perde(kutu, acan, { acilinca } = {}) {
  let onceki = null;
  const kapat = () => {
    if (kutu.hidden) return;
    kutu.hidden = true;
    acan?.setAttribute("aria-expanded", "false");
    kok.classList.remove("perdeli");
    onceki?.focus?.();
  };
  const ac = () => {
    onceki = document.activeElement;
    kutu.hidden = false;
    acan?.setAttribute("aria-expanded", "true");
    kok.classList.add("perdeli");
    acilinca?.();
  };
  kutu.addEventListener("click", (e) => { if (e.target === kutu) kapat(); });
  kutu.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.stopPropagation(); kapat(); }
    if (e.key !== "Tab") return;
    const odaklar = [...kutu.querySelectorAll("button, input, select, a[href]")].filter((o) => o.offsetParent);
    const [ilk, son] = [odaklar[0], odaklar.at(-1)];
    if (e.shiftKey && document.activeElement === ilk) { e.preventDefault(); son.focus(); }
    else if (!e.shiftKey && document.activeElement === son) { e.preventDefault(); ilk.focus(); }
  });
  return { ac, kapat };
}
const erisim = perde($("#erisim"), $("#erisim-ac"), { acilinca: () => $("#erisim input:checked")?.focus() });
$("#erisim-ac").addEventListener("click", () => erisim.ac());
$("#erisim-kapat").addEventListener("click", () => erisim.kapat());
tercihUygula();

// ---------- Mobil menü ----------
const menuDugme = $("#menu-ac");
menuDugme.addEventListener("click", () => {
  const acik = menuDugme.getAttribute("aria-expanded") !== "true";
  menuDugme.setAttribute("aria-expanded", String(acik));
  menuDugme.setAttribute("aria-label", acik ? "Menüyü kapat" : "Menüyü aç");
  kok.classList.toggle("menu-acik", acik);
});
$("#ust-gezinme").addEventListener("click", (e) => {
  if (!e.target.closest("a")) return;
  menuDugme.setAttribute("aria-expanded", "false");
  kok.classList.remove("menu-acik");
});

// ---------- Veri ----------
const veri = { vitrin: null, moduller: [], eserler: [], dalislar: [], iliskiler: [], iller: [] };
const eserBul = (id) => veri.eserler.find((e) => e.id === id);
const yukleniyor = Promise.allSettled([
  getir("/api/vitrin").then((v) => { veri.vitrin = v; }),
  getir("/api/moduller").then((m) => { veri.moduller = m; }),
  getir("/api/eserler").then((e) => { veri.eserler = e; }),
  getir("/api/dalislar").then((d) => { veri.dalislar = d; }),
  getir("/api/eser-iliskileri").then((i) => { veri.iliskiler = i; }),
]);

// ---------- 1. Modül vitrini ----------
let vitrin = null;
function vitrinKur() {
  const kap = $("#vitrin-sahneler");
  const sekmeler = $("#vitrin-sekmeler");
  const moduller = veri.moduller;
  if (!moduller.length) { $("#vitrin").hidden = true; return null; }
  const SURE = 8000;
  let sira = 0, zamanlayici = null, durdu = hareketAz(), uzerinde = false;

  const sahneler = moduller.map((m, i) => {
    const izinler = (m.izinler ?? []).includes("konum") ? el("li", { metin: "Konum ister" }) : null;
    return el("article", { sinif: `sahne sahne-${m.id}`, stil: temaStili(m), "aria-roledescription": "slide", "aria-label": `${i + 1} / ${moduller.length}: ${m.ad}`, id: `sahne-${i}`, role: "tabpanel" },
      el("div", { sinif: "sahne-yazi" },
        el("p", { sinif: "sahne-ust" }, el("span", { metin: kategoriAdi(m.kategori) }), el("span", { sinif: "sahne-sira", translate: "no", metin: `${String(i + 1).padStart(2, "0")} / ${String(moduller.length).padStart(2, "0")}` })),
        el("h2", { sinif: "sahne-ad" }, m.ad, modulRozeti(m)),
        el("p", { sinif: "sahne-aciklama", metin: m.aciklama }),
        el("ul", { sinif: "sahne-etiketler" }, el("li", { metin: "Giriş gerekmez" }), izinler),
        el("div", { sinif: "sahne-dugmeler" },
          el("a", { sinif: "dugme sahne-ac", href: modulAdresi(m.id) }, "Modülü aç", el("span", { sinif: "ok", "aria-hidden": "true", metin: "→" })),
          el("a", { sinif: "dugme cizgili", href: "/#moduller" }, "Tüm modüller"))),
      sahneGorseli(m, veri));
  });
  kap.replaceChildren(...sahneler);

  const sekme = moduller.map((m, i) => el("button", {
    type: "button", role: "tab", sinif: "vitrin-sekme", id: `sekme-${i}`, "aria-controls": `sahne-${i}`, stil: temaStili(m),
    onclick: () => { git(i); durdur(true); },
  }, el("span", { sinif: "vs-ad", metin: m.ad }), el("span", { sinif: "vs-tur", metin: kategoriAdi(m.kategori) }), el("span", { sinif: "vs-cubuk", "aria-hidden": "true" }, el("i"))));
  sekmeler.replaceChildren(...sekme);
  sekmeler.addEventListener("keydown", (e) => {
    const yon = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!yon) return;
    e.preventDefault();
    git(sira + yon); durdur(true);
    sekme[sira].focus();
  });

  function git(i) {
    sira = (i + moduller.length) % moduller.length;
    sahneler.forEach((s, j) => {
      const aktif = j === sira;
      s.classList.toggle("aktif", aktif);
      s.inert = !aktif;
      s.setAttribute("aria-hidden", String(!aktif));
    });
    sekme.forEach((s, j) => { s.setAttribute("aria-selected", String(j === sira)); s.tabIndex = j === sira ? 0 : -1; s.classList.remove("akiyor"); });
    $("#vitrin").style.cssText = temaStili(moduller[sira]);
    planla();
  }
  function planla() {
    clearTimeout(zamanlayici);
    sekme.forEach((s) => s.classList.remove("akiyor"));
    if (durdu || uzerinde || document.hidden) return;
    void sekme[sira].offsetWidth;
    sekme[sira].style.setProperty("--sure", `${SURE}ms`);
    sekme[sira].classList.add("akiyor");
    zamanlayici = setTimeout(() => git(sira + 1), SURE);
  }
  function durdur(evet) {
    durdu = evet;
    const d = $("#vitrin-durdur");
    d.setAttribute("aria-pressed", String(durdu));
    d.setAttribute("aria-label", durdu ? "Vitrini oynat" : "Vitrini durdur");
    planla();
  }
  $("#vitrin-onceki").addEventListener("click", () => { git(sira - 1); });
  $("#vitrin-sonraki").addEventListener("click", () => { git(sira + 1); });
  $("#vitrin-durdur").addEventListener("click", () => durdur(!durdu));
  const v = $("#vitrin");
  v.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") { uzerinde = true; planla(); } });
  v.addEventListener("pointerleave", () => { uzerinde = false; planla(); });
  v.addEventListener("focusin", () => { uzerinde = true; planla(); });
  v.addEventListener("focusout", (e) => { if (!v.contains(e.relatedTarget)) { uzerinde = false; planla(); } });
  document.addEventListener("visibilitychange", planla);
  // Dokunmatik kaydırma
  let basX = null;
  kap.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") basX = e.clientX; });
  kap.addEventListener("pointerup", (e) => {
    if (basX == null) return;
    const fark = e.clientX - basX; basX = null;
    if (Math.abs(fark) > 50) { git(sira + (fark < 0 ? 1 : -1)); durdur(true); }
  });
  durdur(durdu);
  git(0);
  return { durdur };
}

// ---------- 2. Sayılar ----------
function sayilarCiz() {
  const s = veri.vitrin?.sayilar;
  if (!s) { $(".sayilar").hidden = true; return; }
  const kalem = (n, ad, bag) => el("li", {}, el("a", { href: bag }, el("strong", { metin: String(n) }), el("span", { metin: ad })));
  $("#sayilar").replaceChildren(
    kalem(s.eser, "vakıf eseri", "/#eserler"), kalem(s.fotografli, "fotoğraflı", "/#eserler"),
    kalem(s.konumlu, "haritada", "/#harita"), kalem(veri.iller.length, "il", "/#eserler"), kalem(s.ilce, "ilçe", "/#eserler"),
    kalem(veri.moduller.length, "modül", "/#moduller"));
}

// ---------- 3. Modüller ----------
function modullerCiz() {
  const ul = $("#modul-izgara");
  if (!veri.moduller.length) { ul.replaceChildren(el("li", { sinif: "bos", metin: "Henüz yayında modül yok." })); return; }
  ul.replaceChildren(...veri.moduller.map((m, i) => {
    const kapak = veri.vitrin?.kapaklar?.[m.id];
    return el("li", { sinif: `modul-kart mk-${i % 3}`, stil: temaStili(m) },
      el("a", { href: modulAdresi(m.id), sinif: "mk-bag" },
        el("div", { sinif: "mk-ust" },
          el("span", { sinif: "cini mk-cini", stil: `background-image:${ciniArkaPlan(m.id, m.renk)}`, "aria-hidden": "true" }),
          kapak?.foto ? foto(kapak.foto, "", "16 / 10", "mk-foto") : null),
        el("div", { sinif: "mk-govde" },
          el("p", { sinif: "mk-tur", metin: kategoriAdi(m.kategori) }),
          el("h3", {}, m.ad, modulRozeti(m)),
          el("p", { sinif: "mk-aciklama", metin: m.aciklama }),
          el("span", { sinif: "mk-ac" }, "Aç", el("span", { "aria-hidden": "true", metin: " →" })))));
  }));
}

// ---------- Davet kodu: ustanın özel modülünü açar ----------
// Kod sunucuda doğrulanır (GET /api/paylasim/:kod); bulunursa modül oynatıcısı aynı kodla açılır.
function davetKur() {
  const form = $("#davet-form"), girdi = $("#davet-kodu"), hata = $("#davet-hata"), kutu = $("#davet");
  if (!form) return;
  const dugme = form.querySelector("button");
  const hataGoster = (metin) => {
    hata.textContent = metin;
    kutu.classList.remove("sarsil");
    void kutu.offsetWidth; // animasyonu yeniden başlat
    kutu.classList.add("sarsil");
    girdi.focus();
  };
  // Yazarken ABCD-EFGH biçimine getir; küçük harf, boşluk ve tire serbest.
  girdi.addEventListener("input", () => {
    const k = girdi.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    girdi.value = k.length > 4 ? `${k.slice(0, 4)}-${k.slice(4)}` : k;
    hata.textContent = "";
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const k = girdi.value.replace(/-/g, "");
    if (k.length !== 8) return hataGoster("Davet kodu 8 harf ve rakamdan oluşur (örneğin ABCD-EFGH).");
    const kod = `${k.slice(0, 4)}-${k.slice(4)}`;
    dugme.disabled = true;
    try {
      const y = await fetch(`/api/paylasim/${encodeURIComponent(kod)}`, { cache: "no-store" });
      if (y.ok) { location.href = modulAdresi(kod); return; }
      hataGoster(y.status === 404 ? "Bu kodla bir modül bulunamadı. Kodu ustaya bir daha sor." : ((await y.json().catch(() => ({}))).hata ?? "Kod şu an denetlenemedi; biraz sonra tekrar dene."));
    } catch {
      hataGoster("Sunucuya ulaşılamadı; bağlantını denetleyip tekrar dene.");
    } finally { dugme.disabled = false; }
  });
}
davetKur();

// ---------- 4. Eserler: süzgeçli duvar ----------
const suzgec = { tur: "", il: "", ilce: "", yuzyil: "" };
const SAYFA = 24;
let gosterilen = SAYFA;

function eserTasi(e) {
  const f = e.fotograflar?.[0];
  const gorsel = f
    ? el("img", { src: f, alt: "", loading: "lazy", decoding: "async", onload: (x) => x.target.parentElement.classList.add("yuklendi") })
    : el("span", { sinif: "cini et-cini", stil: `background-image:${ciniArkaPlan(e.id)}`, "aria-hidden": "true" });
  return el("li", { sinif: "eser-tasi" },
    el("a", { href: eserAdresi(e.id) },
      el("span", { sinif: `et-gorsel${f ? "" : " fotosuz"}` }, gorsel),
      el("span", { sinif: "et-ad", metin: e.ad }),
      el("span", { sinif: "et-kunye", metin: kunye(e) })));
}

function suzulmus() {
  return veri.eserler
    .filter((e) => (!suzgec.tur || e.tur === suzgec.tur) && (!suzgec.il || e.il === suzgec.il) && (!suzgec.ilce || e.ilce === suzgec.ilce) && (!suzgec.yuzyil || String(e.yuzyil) === suzgec.yuzyil))
    .sort((a, b) => (b.fotograflar?.length ? 1 : 0) - (a.fotograflar?.length ? 1 : 0) || a.ad.localeCompare(b.ad, "tr"));
}

function cipler(kap, secenekler, anahtar) {
  kap.replaceChildren(...secenekler.map(([deger, ad, sayi]) => el("button", {
    type: "button", sinif: "cip", "aria-pressed": String(suzgec[anahtar] === deger),
    onclick: () => { suzgec[anahtar] = deger; gosterilen = SAYFA; suzgecCiz(); duvarCiz(); },
  }, el("span", { metin: ad }), sayi != null ? el("small", { metin: String(sayi) }) : null)));
}

function suzgecCiz() {
  const say = (f) => veri.eserler.reduce((m, e) => m.set(f(e), (m.get(f(e)) ?? 0) + 1), new Map());
  const turler = [...say((e) => e.tur)].sort((a, b) => b[1] - a[1]);
  cipler($("#tur-cipleri"), [["", "Tümü", veri.eserler.length], ...turler.map(([t, n]) => [t, turAdi(t), n])], "tur");
  const yuzyillar = [...say((e) => e.yuzyil)].filter(([y]) => y).sort((a, b) => a[0] - b[0]);
  cipler($("#yuzyil-cipleri"), [["", "Hepsi"], ...yuzyillar.map(([y, n]) => [String(y), `${y}. yy`, n])], "yuzyil");
  // Önce il, sonra o ilin ilçeleri.
  const ilSec = $("#il-sec");
  if (ilSec.options.length === 1) {
    for (const [il, n] of [...say((e) => e.il)].filter(([i]) => i).sort((a, b) => a[0].localeCompare(b[0], "tr")))
      ilSec.append(el("option", { value: il, metin: `${il} (${n})` }));
    if (veri.iller.length === 1) { ilSec.value = veri.iller[0]; suzgec.il = veri.iller[0]; }
    ilSec.addEventListener("change", () => { suzgec.il = ilSec.value; suzgec.ilce = ""; gosterilen = SAYFA; ilceleriDoldur(); duvarCiz(); });
    $("#ilce-sec").addEventListener("change", (e) => { suzgec.ilce = e.target.value; gosterilen = SAYFA; duvarCiz(); });
    ilceleriDoldur();
  }
}

function ilceleriDoldur() {
  const sec = $("#ilce-sec");
  const say = new Map();
  for (const e of veri.eserler) if (e.ilce && (!suzgec.il || e.il === suzgec.il)) say.set(e.ilce, (say.get(e.ilce) ?? 0) + 1);
  sec.replaceChildren(el("option", { value: "", metin: suzgec.il ? `${suzgec.il}: tüm ilçeler` : "Tüm ilçeler" }),
    ...[...say].sort((a, b) => a[0].localeCompare(b[0], "tr")).map(([ilce, n]) => el("option", { value: ilce, metin: `${ilce} (${n})` })));
  sec.disabled = !suzgec.il;
  sec.title = suzgec.il ? "" : "Önce il seç";
}

function duvarCiz() {
  const liste = suzulmus();
  $("#eser-sayaci").textContent = `${liste.length} eser`;
  $("#eser-duvari").replaceChildren(...liste.slice(0, gosterilen).map(eserTasi));
  $("#daha-fazla").hidden = liste.length <= gosterilen;
}
$("#daha-fazla").addEventListener("click", () => {
  const ilkYeni = gosterilen;
  gosterilen += SAYFA;
  duvarCiz();
  $("#eser-duvari").children[ilkYeni]?.querySelector("a")?.focus();
});

// ---------- 5. Harita (uygulamanın ortak haritası: /app/harita.js, görünür olunca yüklenir) ----------
const TUR_RENK = { cami: "#167a54", mescit: "#2e7d4f", turbe: "#5b2a6e", kulliye: "#1f3a93", hamam: "#157f7d", han: "#b0832a", medrese: "#c0352b", tekke: "#8a6420" };
const turRengi = (t) => TUR_RENK[t] ?? "#6b6658";
async function haritaKur(kap, eserler, { yakinlik } = {}) {
  const { haritaAc, isaretKoy } = await import("/app/harita.js");
  kap.replaceChildren();
  const noktalar = eserler.filter((e) => e.konum?.lat).map((e) => [e, [Number(e.konum.lng), Number(e.konum.lat)]]);
  const tek = yakinlik && noktalar.length === 1;
  const h = await haritaAc(kap, { gomulu: true, merkez: tek ? noktalar[0][1] : [29.0625, 40.1836], zoom: tek ? yakinlik - 1 : 11, pitch: tek ? 45 : 0 });
  const ml = window.maplibregl;
  for (const [e, nokta] of noktalar) {
    const oge = el("div", { sinif: "hn" });
    oge.style.setProperty("--renk", turRengi(e.tur));
    const icerik = el("div", { sinif: "hb" },
      e.fotograflar?.[0] ? el("img", { src: e.fotograflar[0], alt: "" }) : null,
      el("strong", { metin: e.ad }), el("span", { metin: kunye(e) }),
      el("a", { href: eserAdresi(e.id), metin: "Eser sayfası →" }));
    const acilir = new ml.Popup({ maxWidth: "240px", offset: 12 }).setDOMContent(icerik);
    isaretKoy(h, nokta, oge, { ad: e.ad, onSec: () => acilir.setLngLat(nokta).addTo(h) });
  }
  if (!tek && noktalar.length) {
    const s = new ml.LngLatBounds();
    for (const [, n] of noktalar) s.extend(n);
    h.fitBounds(s, { padding: 30, maxZoom: 14, duration: 0 });
  }
  return h;
}
function haritaBolumu() {
  const kap = $("#harita-alan");
  const konumlu = veri.eserler.filter((e) => e.konum?.lat);
  $("#harita-ozet").textContent = `Konumu kayıtlı ${konumlu.length} eser haritada. Bir işarete dokun, eserin sayfasına geç.`;
  const say = new Map();
  for (const e of konumlu) say.set(e.tur, (say.get(e.tur) ?? 0) + 1);
  $("#harita-lejant").replaceChildren(...[...say].sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([t, n]) => el("li", {}, el("i", { stil: `background:${turRengi(t)}`, "aria-hidden": "true" }), el("span", { metin: turAdi(t) }), el("small", { metin: String(n) }))));
  const gozcu = new IntersectionObserver((g) => {
    if (!g.some((x) => x.isIntersecting)) return;
    gozcu.disconnect();
    haritaKur(kap, konumlu).catch(() => kap.replaceChildren(el("p", { sinif: "bos", metin: "Harita yüklenemedi." })));
  }, { rootMargin: "300px" });
  gozcu.observe(kap);
}

// ---------- 6. Dalışlar ----------
function dalislarCiz() {
  const ul = $("#dalis-seridi");
  if (!veri.dalislar.length) { $("#dalislar").hidden = true; return; }
  const dalisModulu = veri.moduller.find((m) => m.id === "vakif-dalislari");
  ul.replaceChildren(...veri.dalislar.map((d) => {
    const e = eserBul(d.eser);
    const kareler = [...new Set((d.kareler ?? []).map((k) => k.g))];
    const kapak = kareler.find((g) => /^[a-z]1$/.test(g)) ?? kareler[6] ?? kareler[0];
    const sira = ["6", "12", "18"].map((z) => kareler.find((g) => g.endsWith(z) && g.length <= 3)).filter(Boolean);
    const kart = el("li", { sinif: "dalis-kart" },
      el("a", { href: dalisModulu ? modulAdresi(dalisModulu.id) : eserAdresi(d.eser) },
        foto(`/medya/dalis/${d.eser}/${kapak}.jpg`, "", "2 / 3", "dk-foto"),
        el("span", { sinif: "dk-seri", "aria-hidden": "true" }, sira.map((g) => el("img", { src: `/medya/dalis/${d.eser}/${g}.jpg`, alt: "", loading: "lazy" }))),
        el("span", { sinif: "dk-yazi" },
          el("strong", { metin: e?.ad ?? d.eser }),
          el("span", { metin: d.ozet ?? "" }),
          el("span", { sinif: "dk-ac" }, "Dalışa başla", el("span", { "aria-hidden": "true", metin: " →" })))));
    return kart;
  }));
}

// ---------- 7. Günün eseri ----------
function gununEseriCiz() {
  const g = veri.vitrin?.gununEseri;
  if (!g) { $("#gunun-eseri").hidden = true; return; }
  $("#gunun-baslik").textContent = g.ad;
  $("#ge-kunye").textContent = kunye(g);
  $("#ge-ozet").textContent = g.ozet ?? "";
  $("#ge-bag").href = eserAdresi(g.id);
  const f = el("img", { src: g.foto, alt: g.ad, decoding: "async" });
  $("#ge-foto").replaceChildren(f);
}

// ---------- Eser sayfası ----------
function eserSayfasi(id) {
  const e = eserBul(id);
  const s = $("#eser-sayfa");
  if (!e) { s.replaceChildren(el("div", { sinif: "es-yok" }, el("h1", { id: "es-ad", metin: "Eser bulunamadı" }), el("a", { sinif: "dugme", href: "/#eserler", metin: "Eserlere dön" }))); return; }
  document.title = `${e.ad} · Lonca`;
  const fotolar = e.fotograflar ?? [];
  const buyuk = el("img", { src: fotolar[0] ?? "", alt: e.ad, decoding: "async" });
  const galeri = fotolar.length
    ? el("div", { sinif: "es-galeri" },
      el("div", { sinif: "es-buyuk" }, buyuk),
      fotolar.length > 1 ? el("div", { sinif: "es-kucukler", role: "group", "aria-label": "Fotoğraflar" }, fotolar.map((f, i) => el("button", {
        type: "button", "aria-label": `Fotoğraf ${i + 1}`, "aria-pressed": String(i === 0),
        onclick: (ev) => { buyuk.src = f; ev.currentTarget.parentElement.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === ev.currentTarget))); },
      }, el("img", { src: f, alt: "", loading: "lazy" })))) : null)
    : el("div", { sinif: "es-galeri" }, el("div", { sinif: "cini es-cini", stil: `background-image:${ciniArkaPlan(e.id)}`, "aria-hidden": "true" }));
  const dil = dilAl();
  const tarihce = (dil === "en" && e.tarihce?.en) || e.tarihce?.tr || "";
  const dalis = veri.dalislar.find((d) => d.eser === e.id);
  const dalisModulu = veri.moduller.find((m) => m.id === "vakif-dalislari");
  const baglar = veri.iliskiler.filter((i) => i.a === e.id || i.b === e.id).map((i) => ({ ...i, diger: eserBul(i.a === e.id ? i.b : i.a) })).filter((i) => i.diger);
  const benzer = veri.eserler.filter((x) => x.id !== e.id && x.tur === e.tur && x.fotograflar?.length).slice(0, 8);
  const satir = (ad, deger) => (deger ? [el("dt", { metin: ad }), el("dd", { metin: String(deger) })] : []);
  const haritaKap = e.konum?.lat ? el("div", { sinif: "es-harita", role: "region", "aria-label": "Eserin konumu" }) : null;

  // replaceChildren null'u "null" metni olarak yazar: boş bölümler süzülür
  s.replaceChildren(...[
    el("nav", { sinif: "es-yol", "aria-label": "Konum" }, el("a", { href: "/#eserler" }, el("span", { "aria-hidden": "true", metin: "← " }), "Eserler"), el("span", { "aria-hidden": "true", metin: " / " }), el("span", { metin: turAdi(e.tur) })),
    el("header", { sinif: "es-baslik" },
      el("p", { sinif: "bolum-ust-yazi", metin: kunye(e) }),
      el("h1", { id: "es-ad", metin: e.ad }),
      e.ad_en && e.ad_en !== e.ad ? el("p", { sinif: "es-en", lang: "en", metin: e.ad_en }) : null),
    el("div", { sinif: "es-duzen" },
      galeri,
      el("aside", { sinif: "es-yan" },
        el("dl", { sinif: "es-kunye" }, satir("Tür", turAdi(e.tur)), satir("Yüzyıl", yuzyilYazi(e.yuzyil)), satir("İl", e.il), satir("İlçe", e.ilce), satir("Adres", e.adres), satir("Kaynak", e.kaynak)),
        el("p", { sinif: "es-dogrulama" }, eserRozeti(e)),
        el("div", { sinif: "es-eylemler" },
          dalis && dalisModulu ? el("a", { sinif: "dugme", href: modulAdresi(dalisModulu.id) }, "Dalışını izle") : null,
          el("button", { type: "button", sinif: "dugme cizgili", onclick: async (ev) => {
            const b = ev.currentTarget;
            try { await navigator.clipboard.writeText(location.href); b.textContent = "Bağlantı kopyalandı"; } catch { b.textContent = "Kopyalanamadı"; }
            setTimeout(() => { b.textContent = "Bağlantıyı kopyala"; }, 2200);
          } }, "Bağlantıyı kopyala")),
        haritaKap)),
    tarihce ? el("section", { sinif: "es-tarihce", "aria-labelledby": "es-tarihce-baslik" },
      el("h2", { id: "es-tarihce-baslik", metin: "Tarihçe" }),
      el("div", { sinif: "es-metin" }, tarihce.split(/\n+/).filter(Boolean).map((p) => el("p", { metin: p })))) : null,
    baglar.length ? el("section", { sinif: "es-baglar", "aria-labelledby": "es-baglar-baslik" },
      el("h2", { id: "es-baglar-baslik", metin: "Tarihsel bağlar" }),
      el("ul", {}, baglar.map((b) => el("li", {},
        el("a", { href: eserAdresi(b.diger.id) },
          b.diger.fotograflar?.[0] ? el("img", { src: b.diger.fotograflar[0], alt: "", loading: "lazy" }) : el("span", { sinif: "cini", stil: `background-image:${ciniArkaPlan(b.diger.id)}` }),
          el("span", {}, el("strong", { metin: b.diger.ad }), el("span", { metin: b.baslik ?? "" }), b.kaynak ? el("small", { metin: `Kaynak: ${b.kaynak}` }) : null)))))) : null,
    benzer.length ? el("section", { sinif: "es-benzer", "aria-labelledby": "es-benzer-baslik" },
      el("h2", { id: "es-benzer-baslik", metin: `Diğer ${turAdi(e.tur).toLocaleLowerCase("tr")} eserleri` }),
      el("ul", { sinif: "eser-satiri" }, benzer.map(eserTasi))) : null,
  ].filter(Boolean));
  if (haritaKap) haritaKur(haritaKap, [e], { yakinlik: 16 }).catch((h) => { console.warn("Harita açılamadı:", h.message); haritaKap.remove(); });
}

// ---------- Yönlendirme ----------
function yonlendir() {
  const es = /^#\/eser\/([a-z0-9-]{1,80})$/.exec(location.hash);
  const ana = $("#ana-sayfa"), sayfa = $("#eser-sayfa");
  if (es) {
    ana.hidden = true; sayfa.hidden = false;
    eserSayfasi(decodeURIComponent(es[1]));
    scrollTo({ top: 0 });
    sayfa.querySelector("h1")?.focus?.();
    return;
  }
  document.title = "Lonca · Vakıf eserleri";
  const geriDonus = !sayfa.hidden;
  sayfa.hidden = true; ana.hidden = false;
  const hedef = location.hash.length > 1 && document.getElementById(location.hash.slice(1));
  if (hedef) hedef.scrollIntoView({ behavior: geriDonus || hareketAz() ? "auto" : "smooth" });
  else if (geriDonus) scrollTo({ top: 0 });
}
addEventListener("hashchange", yonlendir);

// Kaydırdıkça üst gezinmede bulunulan bölüm işaretlenir.
const bolumGozcu = new IntersectionObserver((girdiler) => {
  for (const g of girdiler) {
    if (!g.isIntersecting) continue;
    document.querySelectorAll("#ust-gezinme a").forEach((a) => a.toggleAttribute("aria-current", a.hash === `#${g.target.id}`));
  }
}, { rootMargin: "-45% 0px -50% 0px" });
for (const id of ["moduller", "eserler", "harita", "dalislar", "gunun-eseri"]) bolumGozcu.observe(document.getElementById(id));

// ---------- Arama ----------
const aramaKutusu = $("#arama");
const arama = perde(aramaKutusu, null, { acilinca: () => { $("#arama-metin").focus(); $("#arama-metin").select(); } });
$("#ara-ac").addEventListener("click", () => arama.ac());
$("#sayilar-ara").addEventListener("click", () => arama.ac());
$("#arama-kapat").addEventListener("click", () => arama.kapat());
$("#arama-sonuc").addEventListener("click", (e) => { if (e.target.closest("a")) arama.kapat(); });
addEventListener("keydown", (e) => {
  if (e.key === "/" && !e.target.closest("input, textarea, select") && aramaKutusu.hidden) { e.preventDefault(); arama.ac(); }
});
$("#arama-metin").addEventListener("input", (e) => {
  const q = e.target.value.trim();
  const sonuc = q ? eserAra(veri.eserler, q, { limit: 20 }) : [];
  $("#arama-durum").textContent = q ? (sonuc.length ? `${sonuc.length} sonuç` : "Sonuç yok") : "";
  $("#arama-sonuc").replaceChildren(...sonuc.map((s) => el("li", {}, el("a", { href: eserAdresi(s.id) },
    s.foto ? el("img", { src: s.foto, alt: "", loading: "lazy" }) : el("span", { sinif: "cini", stil: `background-image:${ciniArkaPlan(s.id)}` }),
    el("span", {}, el("strong", { metin: s.ad }), el("small", { metin: kunye(s) }))))));
});

// ---------- Başlat ----------
const ciniDesen = $("#studio-desen");
ciniDesen.classList.add("cini");
ciniDesen.style.backgroundImage = ciniArkaPlan("lonca-studio", "firuze");

await yukleniyor;
if (!veri.moduller.length && !veri.eserler.length) {
  $("#vitrin-sahneler").replaceChildren(el("p", { sinif: "bos yukleme-hatasi", metin: "İçerik yüklenemedi. Bağlantını kontrol edip sayfayı yenile." }));
}
veri.iller = [...new Set(veri.eserler.map((e) => e.il).filter(Boolean))].sort((x, y) => x.localeCompare(y, "tr"));
cokIlli = veri.iller.length > 1;
$("#eserler-ozet").textContent = veri.iller.length > 1
  ? `Camiler, türbeler, hanlar, hamamlar… ${veri.iller.length} ildeki kayıtlı vakıf eserleri.`
  : veri.iller.length === 1 ? `Camiler, türbeler, hanlar, hamamlar… ${veri.iller[0]} ilindeki kayıtlı vakıf eserleri.` : $("#eserler-ozet").textContent;
vitrin = vitrinKur();
sayilarCiz();
modullerCiz();
suzgecCiz();
duvarCiz();
haritaBolumu();
dalislarCiz();
gununEseriCiz();
yonlendir();
dilDegisince(() => { if (!$("#eser-sayfa").hidden) yonlendir(); });
