// Arayüz dili: Türkçe (varsayılan) ve İngilizce. Uygulama, web ve Studio aynı modülü kullanır.
//
// Yöntem: arayüzün kaynak dili Türkçedir ve kodda öyle kalır. İngilizce sözlük (ceviri-en.js) Türkçe metni anahtar
// alır. Bu modül sayfadaki metin düğümlerini ve erişilebilirlik özniteliklerini (aria-label, title, placeholder, alt…)
// MutationObserver ile izler: sözlükte karşılığı olan metni İngilizcesiyle değiştirir, asıl Türkçeyi saklar, dil Türkçeye
// dönünce geri yazar. Böylece ekran kodları (app.js, studio.js…) olduğu gibi kalır; sonradan çizilen metinler de anında
// çevrilir. Eser içerikleri (adlar, tarihçeler) sözlükte olmadığı için Türkçe kalır.
//
// Seçim localStorage'da "lonca.dil" anahtarında durur; aynı kökendeki diğer sekmeler ve önizleme çerçeveleri
// "storage" olayıyla sayfayı yenilemeden aynı dile geçer.
import { EN } from "/ortak/ceviri-en.js";

const ANAHTAR = "lonca.dil";
export const DILLER = { tr: { ad: "Türkçe", kisa: "TR" }, en: { ad: "English", kisa: "EN" } };
const OZNITELIKLER = ["aria-label", "title", "placeholder", "alt", "aria-valuetext", "aria-roledescription"];
// Çevrilmeyecek yerler: translate="no" işaretli öğeler (öznitelikleri de); metni ise kod ve düzenlenebilir alanlar.
const ATLA = '[translate="no"]';
const ATLA_METIN = 'script, style, textarea, pre, code, [translate="no"], [contenteditable=""], [contenteditable="true"]';
const HARF = /[A-Za-zÇĞİÖŞÜçğıöşü]/;

export function dilOku() {
  try { return localStorage.getItem(ANAHTAR) === "en" ? "en" : "tr"; } catch { return "tr"; }
}
let dil = dilOku();
export const dilAl = () => dil;

// ---------- Sözlük ----------
// Anahtarda {0}, {1}… yer tutucu olabilir (ör. "{0} eser"); değer metin ya da yakalananları alan bir işlevdir.
const bosluk = (s) => s.replace(/\s+/g, " ").trim();
const kacir = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const tam = new Map();
const desenler = [];
for (const [k, v] of Object.entries(EN)) {
  if (/\{\d\}/.test(k)) {
    const kaynak = bosluk(k).split(/(\{\d\})/).map((p) => (/^\{\d\}$/.test(p) ? "(.+?)" : kacir(p))).join("");
    desenler.push({ re: new RegExp(`^${kaynak}$`, "s"), v, nokta: k.includes(" · ") });
  } else tam.set(bosluk(k), v);
}
// Daha belirgin (sabit metni uzun) desen önce denenir: "Seviye {0} için {1} puan", "Seviye {0}"dan önce.
desenler.sort((a, b) => b.re.source.replace(/\(\.\+\?\)/g, "").length - a.re.source.replace(/\(\.\+\?\)/g, "").length);

// Desenin yakaladığı parça: sözlükte varsa çevrilir; "Yüzyıl, Adres" gibi virgüllü listeler öğe öğe.
function parcaCevir(a) {
  const c = tam.get(a) ?? cevirEn(a);
  if (c != null) return c;
  return a.includes(", ") ? a.split(", ").map((x) => tam.get(x) ?? x).join(", ") : a;
}

function cevirEn(s) {
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s);
  const govde = bosluk(m[2]);
  if (!govde || !HARF.test(govde)) return null;
  let c = tam.get(govde);
  if (c === undefined && govde.length < 600) {
    // " · " içeren satırda yalnızca kendisi de " · " içeren desenler denenir; yoksa parça parça çevrilir (aşağıda).
    const noktali = govde.includes(" · ");
    for (const d of desenler) {
      if (noktali && !d.nokta) continue;
      const x = d.re.exec(govde);
      if (!x) continue;
      const p = x.slice(1).map(parcaCevir);
      c = typeof d.v === "function" ? d.v(...p) : d.v.replace(/\{(\d)\}/g, (_, i) => p[i] ?? "");
      break;
    }
  }
  // "Cami · 15. yüzyıl · Osmangazi" gibi birleşik satırlar: parçalar ayrı ayrı çevrilir.
  if (c === undefined && govde.includes(" · ")) {
    const parcalar = govde.split(" · ");
    const cevrilen = parcalar.map((p) => cevirEn(p) ?? p);
    if (cevrilen.some((p, i) => p !== parcalar[i])) c = cevrilen.join(" · ");
  }
  return c === undefined ? null : m[1] + c + m[3];
}

// Kod içinden çeviri (alert, sesli okuma, belge başlığı…): Türkçede metni olduğu gibi döndürür.
export function t(metin) {
  if (dil === "tr" || metin == null) return metin;
  return cevirEn(String(metin)) ?? String(metin);
}

// ---------- DOM ----------
const metinKaydi = new WeakMap(); // Text → { asil, yazilan }
const ozKaydi = new WeakMap(); // Element → Map(öznitelik → { asil, yazilan })
const atlanir = (el) => !el || !!el.closest?.(ATLA);

function metinCevir(n) {
  if (!n.parentElement || n.parentElement.closest(ATLA_METIN)) return;
  const k = metinKaydi.get(n);
  const asil = k && n.data === k.yazilan ? k.asil : n.data;
  const hedef = dil === "en" ? (cevirEn(asil) ?? asil) : asil;
  if (hedef !== asil || k) metinKaydi.set(n, { asil, yazilan: hedef });
  if (n.data !== hedef) n.data = hedef;
}

function oznitelikCevir(el, ad) {
  const deger = el.getAttribute(ad);
  let kayit = ozKaydi.get(el);
  const k = kayit?.get(ad);
  if (deger == null) { kayit?.delete(ad); return; }
  const asil = k && deger === k.yazilan ? k.asil : deger;
  const hedef = dil === "en" ? (cevirEn(asil) ?? asil) : asil;
  if (hedef !== asil || k) { if (!kayit) ozKaydi.set(el, (kayit = new Map())); kayit.set(ad, { asil, yazilan: hedef }); }
  if (deger !== hedef) el.setAttribute(ad, hedef);
}

function ogeCevir(el) {
  if (atlanir(el)) return;
  for (const ad of OZNITELIKLER) if (el.hasAttribute(ad)) oznitelikCevir(el, ad);
}

function agacCevir(kok) {
  if (kok.nodeType === Node.TEXT_NODE) return metinCevir(kok);
  if (kok.nodeType !== Node.ELEMENT_NODE) return;
  if (atlanir(kok)) return;
  ogeCevir(kok);
  const yuruyucu = document.createTreeWalker(kok, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.nodeType === Node.ELEMENT_NODE && n.matches(ATLA) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let n = yuruyucu.nextNode(); n; n = yuruyucu.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) metinCevir(n); else ogeCevir(n);
  }
}

const gozcu = new MutationObserver((kayitlar) => {
  for (const k of kayitlar) {
    if (k.type === "childList") for (const n of k.addedNodes) agacCevir(n);
    else if (k.type === "characterData") metinCevir(k.target);
    else if (k.type === "attributes") { if (!atlanir(k.target)) oznitelikCevir(k.target, k.attributeName); }
  }
});

function uygula() {
  document.documentElement.lang = dil;
  agacCevir(document.documentElement);
  for (const f of dinleyiciler) { try { f(dil); } catch {} }
  dispatchEvent(new CustomEvent("lonca:dil", { detail: dil }));
}

const dinleyiciler = new Set();
// Dil değişince çağrılır (ör. sesli okuma, profil ekranındaki seçici).
export function dilDegisince(f) { dinleyiciler.add(f); return () => dinleyiciler.delete(f); }

export function dilAyarla(yeni) {
  yeni = yeni === "en" ? "en" : "tr";
  try { localStorage.setItem(ANAHTAR, yeni); } catch {}
  if (yeni === dil) return;
  dil = yeni;
  uygula();
}

// Başka sekmede ya da Studio'nun önizleme çerçevesinde dil değişirse bu sayfa da yenilemeden geçer.
addEventListener("storage", (e) => {
  if (e.key !== ANAHTAR && e.key !== null) return;
  const yeni = dilOku();
  if (yeni !== dil) { dil = yeni; uygula(); }
});

// alert/confirm/prompt metinleri de çevrilsin.
for (const ad of ["alert", "confirm", "prompt"]) {
  const asil = window[ad];
  if (typeof asil === "function") window[ad] = (mesaj, ...geri) => asil.call(window, t(mesaj), ...geri);
}

// ---------- Seçiciler ----------
// Üst çubuk düğmesi (data-dil-dugmesi taşıyan <button>'lar açılışta kendiliğinden kurulur): geçilecek dilin kısaltmasını gösterir (TR sayfada "EN"); etiketi o dilde yazılır.
export function dilDugmesiKur(d) {
  if (!d) return;
  d.setAttribute("translate", "no");
  const ciz = () => {
    const hedef = dil === "tr" ? "en" : "tr";
    // Erişilebilir ad görünen kısaltmayla başlar (sesli komutla "EN"e dokun diyebilmek için).
    const etiket = hedef === "en" ? "EN, switch language to English" : "TR, dili Türkçe yap";
    const yazi = document.createElement("span");
    yazi.className = "dil-kisa";
    yazi.textContent = DILLER[hedef].kisa;
    d.replaceChildren(yazi);
    d.lang = hedef;
    d.setAttribute("aria-label", etiket);
    d.title = etiket;
  };
  d.addEventListener("click", () => dilAyarla(dil === "tr" ? "en" : "tr"));
  dilDegisince(ciz);
  ciz();
}

// Profil/ayarlar için iki seçenekli radyo grubu (her dil kendi adıyla).
export function dilSecimi({ sinif = "bolumlu", etiketId } = {}) {
  const grup = document.createElement("div");
  grup.className = sinif;
  grup.setAttribute("role", "radiogroup");
  grup.setAttribute("translate", "no");
  if (etiketId) grup.setAttribute("aria-labelledby", etiketId); else grup.setAttribute("aria-label", "Dil / Language");
  const ad = `dil-${Math.random().toString(36).slice(2, 8)}`;
  const girdiler = Object.entries(DILLER).map(([kod, d]) => {
    const g = document.createElement("input");
    g.type = "radio"; g.name = ad; g.value = kod; g.checked = kod === dil;
    g.addEventListener("change", () => { if (g.checked) dilAyarla(kod); });
    const yazi = document.createElement("span");
    yazi.textContent = d.ad; yazi.lang = kod;
    const l = document.createElement("label");
    l.append(g, yazi);
    grup.append(l);
    return g;
  });
  const esle = () => { for (const g of girdiler) g.checked = g.value === dil; };
  const birak = dilDegisince(() => { if (!grup.isConnected) return birak(); esle(); });
  return grup;
}

// Açılışta: dilin henüz çevrilmemiş metinleri göstermemesi için sayfa başlığındaki küçük betik
// html'e "dil-bekle" ekler (bkz. index.html); ilk çeviriden sonra kaldırılır.
gozcu.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: OZNITELIKLER });
uygula();
for (const d of document.querySelectorAll("[data-dil-dugmesi]")) dilDugmesiKur(d);
document.documentElement.classList.remove("dil-bekle");
