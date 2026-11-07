// Uygulamanın tek haritası: MapLibre GL + OpenFreeMap vektör altlığı (anahtar gerekmez), 3B binalarla.
// Keşfet sekmesi, eser sayfası, modül haritaları ve web sitesi hep bu dosyadaki haritaAc'ı kullanır; böylece
// her yerde aynı görünüm, aynı tema geçişi ve aynı dokunma kuralı olur.
//  - Tam ekran harita (Keşfet): tek parmak kaydırır, iki parmak yakınlaştırır, döndürür ve eğer.
//  - Sayfa içindeki haritalar (gomulu: true): tek parmak sayfayı kaydırır, iki parmak haritayı gezdirir; tek parmakla
//    dokununca kısa bir ipucu çıkar. Masaüstünde fareyle sürükleme çalışır, tekerlekle yakınlaştırma Ctrl/⌘ ister.
import { baglaninca } from "/ortak/animasyon.js";

export const koyuTemaMi = () => document.documentElement.dataset.tema === "koyu" || document.documentElement.classList.contains("kontrast");
const hareketAz = () => document.documentElement.classList.contains("hareket-az") || matchMedia("(prefers-reduced-motion: reduce)").matches;

const STIL = { acik: "https://tiles.openfreemap.org/styles/liberty", koyu: "https://tiles.openfreemap.org/styles/dark" };

let maplibreYukleniyor = null;
export function maplibreYukle() {
  maplibreYukleniyor ??= new Promise((coz, reddet) => {
    const css = Object.assign(document.createElement("link"), { rel: "stylesheet", href: "/vendor/maplibre/maplibre-gl.css" });
    const js = Object.assign(document.createElement("script"), { src: "/vendor/maplibre/maplibre-gl.js" });
    js.onload = () => (window.maplibregl ? coz(window.maplibregl) : reddet(new Error("MapLibre yüklenmedi")));
    js.onerror = () => { maplibreYukleniyor = null; reddet(new Error("Harita kütüphanesi yüklenemedi")); };
    document.head.append(css, js);
  });
  return maplibreYukleniyor;
}
export function webglVar() {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; }
}

// Koyu stilde 3B bina katmanı yok: aynı bina verisinden ekleriz. Açık stilde (liberty) var; rengini sıcaklaştırırız.
function binalariKur(harita, koyu) {
  if (!harita.getSource("openmaptiles")) return;
  if (!harita.getLayer("building-3d")) {
    const ilkYazi = harita.getStyle().layers.find((l) => l.type === "symbol")?.id;
    harita.addLayer({
      id: "building-3d", type: "fill-extrusion", source: "openmaptiles", "source-layer": "building", minzoom: 14,
      filter: ["!", ["has", "hide_3d"]],
      paint: { "fill-extrusion-base": ["get", "render_min_height"], "fill-extrusion-height": ["get", "render_height"], "fill-extrusion-color": "#2a2a26", "fill-extrusion-opacity": 0.9 },
    }, ilkYazi);
  }
  harita.setPaintProperty("building-3d", "fill-extrusion-color", koyu ? "#34332d" : "#e7dfcf");
  harita.setPaintProperty("building-3d", "fill-extrusion-opacity", koyu ? 0.9 : 0.85);
}

// Ortak harita. tema: "otomatik" (uygulamanın temasını izler) ya da "koyu" (her temada koyu; modül atlasları).
// katmanlar(harita): stil her yüklendiğinde (ilk açılış ve tema değişimi) kendi kaynak ve katmanlarını yeniden ekler.
// Döner: hazır (load olmuş) maplibregl.Map. Kütüphane ya da stil açılamazsa hata fırlatır.
export async function haritaAc(kutu, { tema = "otomatik", gomulu = true, merkez = [29.065, 40.1845], zoom = 13, pitch = 0, bearing = 0, katmanlar, pusula = true } = {}) {
  if (!webglVar()) throw new Error("Bu cihaz haritayı çizemiyor (WebGL yok)");
  const ml = await maplibreYukle();
  await baglaninca(kutu);
  const koyuMu = () => tema === "koyu" || koyuTemaMi();
  let koyu = koyuMu();
  const harita = new ml.Map({
    container: kutu, style: koyu ? STIL.koyu : STIL.acik,
    center: merkez, zoom, pitch, bearing, maxPitch: 70,
    attributionControl: { compact: true }, dragRotate: true, touchPitch: true,
    cooperativeGestures: gomulu && matchMedia("(pointer: coarse)").matches,
    scrollZoom: !gomulu, fadeDuration: hareketAz() ? 0 : 250,
    locale: {
      "CooperativeGesturesHandler.MobileHelpText": "Haritayı iki parmakla kaydır",
      "CooperativeGesturesHandler.WindowsHelpText": "Yakınlaştırmak için Ctrl tuşuyla kaydır",
      "CooperativeGesturesHandler.MacHelpText": "Yakınlaştırmak için ⌘ tuşuyla kaydır",
      "NavigationControl.ResetBearing": "Kuzeye döndür", "NavigationControl.ZoomIn": "Yakınlaştır", "NavigationControl.ZoomOut": "Uzaklaştır",
      "AttributionControl.ToggleAttribution": "Harita kaynakları",
    },
  });
  if (pusula) harita.addControl(new ml.NavigationControl({ showZoom: gomulu, visualizePitch: true }), "bottom-right");
  harita.on("style.load", () => { binalariKur(harita, koyu); katmanlar?.(harita); });
  // Tema değişince stil yerinde değişir; DOM işaretleri korunur, katmanlar style.load'da yeniden eklenir.
  if (tema === "otomatik") {
    const izle = new MutationObserver(() => {
      if (koyuMu() === koyu) return;
      koyu = koyuMu();
      harita.setStyle(koyu ? STIL.koyu : STIL.acik);
    });
    izle.observe(document.documentElement, { attributes: true, attributeFilter: ["data-tema", "class"] });
    harita.on("remove", () => izle.disconnect());
  }
  await new Promise((coz, reddet) => {
    const zaman = setTimeout(() => reddet(new Error("Harita zamanında açılamadı")), 10000);
    harita.once("load", () => { clearTimeout(zaman); coz(); });
    // Tek bir karonun gelmemesi haritayı düşürmez; yalnızca stilin kendisi yüklenemezse hata olur.
    const hata = (o) => { if (!o.sourceId && !o.tile && !harita.isStyleLoaded()) { clearTimeout(zaman); harita.off("error", hata); reddet(o.error ?? new Error("Harita açılamadı")); } };
    harita.on("error", hata);
  }).catch((h) => { harita.remove(); throw h; });
  return harita;
}

// Metre yarıçaplı daireyi (yaklaşık konum halkası) GeoJSON çokgenine çevirir.
export function daireCokgen(lng, lat, metre, adim = 64) {
  const kat = metre / 6378137;
  const halka = Array.from({ length: adim + 1 }, (_, i) => {
    const a = (i / adim) * Math.PI * 2;
    return [lng + (kat * Math.cos(a) * 180) / Math.PI / Math.cos((lat * Math.PI) / 180), lat + (kat * Math.sin(a) * 180) / Math.PI];
  });
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [halka] } };
}

// DOM öğesini haritaya işaret olarak koyar (MapLibre Marker). Klavye ile seçilebilir olsun istenirse ad verilir.
export function isaretKoy(harita, [lng, lat], oge, { ad, onSec } = {}) {
  if (ad) {
    oge.tabIndex = 0;
    oge.setAttribute("role", "button");
    oge.setAttribute("aria-label", ad);
    oge.title = ad;
  }
  if (onSec) {
    oge.addEventListener("click", (o) => { o.stopPropagation(); onSec(); });
    if (ad) oge.addEventListener("keydown", (o) => { if (o.key === "Enter" || o.key === " ") { o.preventDefault(); onSec(); } });
  }
  return new window.maplibregl.Marker({ element: oge, anchor: "center" }).setLngLat([lng, lat]).addTo(harita);
}

export const PIN_RENGI = {
  cami: "#1f3a93", mescit: "#1f3a93", han: "#c0352b", carsi: "#c0352b", hamam: "#157f7d", cesme: "#157f7d", kopru: "#157f7d",
  medrese: "#2e7d4f", kutuphane: "#2e7d4f", turbe: "#5b2a6e", hazire: "#5b2a6e", tekke: "#5b2a6e", kulliye: "#8a6420", imaret: "#8a6420",
};


export const BAG_RENK = {
  kulliye: "#ffd25e", bani: "#c084fc", mimar: "#60a5fa", vakif: "#4ade80",
  aile: "#fb923c", ticaret: "#f472b6", metin: "#2dd4bf", komsu: "#94a3b8", tipoloji: "#a3a3a3",
};
const BAG_ADI = {
  kulliye: "Aynı külliye", bani: "Aynı bani", mimar: "Aynı mimar", vakif: "Vakıf bağı",
  aile: "Hanedan / aile", ticaret: "Ticaret ağı", metin: "Envanterde birlikte anılıyor", komsu: "Tarihî komşuluk", tipoloji: "Mimari benzerlik",
};
export const bagTuruAdi = (tur) => BAG_ADI[tur] ?? "Tarihsel bağ";

const konumlu = (liste) => (Array.isArray(liste) ? liste : []).slice(0, 200)
  .filter((e) => Number.isFinite(Number(e?.konum?.lat)) && Number.isFinite(Number(e?.konum?.lng)));

// Modüller yakınlaştırmayı eski (256 piksellik karo) ölçekle verir; MapLibre'nin ölçeği bir basamak küçüktür.
const modulZoom = (z) => Number(z) - 1;
const egriNoktalar = (a, b) => {
  // a, b: [lng, lat]. Bağlar hafif kavisli çizilir.
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (d < 0.015) return [a, b];
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  const nx = b[1] - a[1], ny = -(b[0] - a[0]);
  const norm = Math.hypot(nx, ny) || 1;
  const egim = Math.min(0.9, d * 0.09) / norm;
  const cx = mx + nx * egim, cy = my + ny * egim;
  return Array.from({ length: 26 }, (_, i) => {
    const t = i / 25;
    return [(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * cx + t ** 2 * b[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * cy + t ** 2 * b[1]];
  });
};
const cizgi = (koordinatlar, ozellik) => ({ type: "Feature", properties: ozellik, geometry: { type: "LineString", coordinates: koordinatlar } });
const BOS = { type: "FeatureCollection", features: [] };

// Modül haritası (sahne.js "harita" düğümü ve ekranlar.js haritaGoster). Gece atlası görünümü: her temada koyu altlık.
export async function haritaKur(kutu, { eserler, rota = false, secili = null, baglantilar = [], hayaletBaglantilar = [], sis = null, etiketler = [], odak = null, onSec, onBagSec }) {
  kutu.style.position = "relative";
  kutu.style.background = "#0e0e0e";
  let veriKatmani = BOS, bagKatmani = BOS, izgara = BOS;
  const katmanlar = (h) => {
    h.addSource("lonca-cizgi", { type: "geojson", data: veriKatmani });
    h.addSource("lonca-bag", { type: "geojson", data: bagKatmani });
    h.addSource("lonca-izgara", { type: "geojson", data: izgara });
    h.addLayer({ id: "lonca-izgara", type: "line", source: "lonca-izgara", maxzoom: 7, paint: { "line-color": "#5eead4", "line-width": 0.7, "line-opacity": 0.12, "line-dasharray": [2, 8] } });
    h.addLayer({ id: "lonca-hayalet", type: "line", source: "lonca-cizgi", filter: ["==", ["get", "tur"], "hayalet"], paint: { "line-color": "#5eead4", "line-width": 1.6, "line-opacity": 0.3, "line-dasharray": [1, 6] } });
    h.addLayer({ id: "lonca-rota", type: "line", source: "lonca-cizgi", filter: ["==", ["get", "tur"], "rota"], layout: { "line-cap": "round" }, paint: { "line-color": "#7aa2ff", "line-width": 4, "line-opacity": 0.8, "line-dasharray": [0.5, 2.5] } });
    h.addLayer({ id: "lonca-bag-hat", type: "line", source: "lonca-bag", layout: { "line-cap": "round" }, paint: { "line-color": "#ffffff", "line-width": 10, "line-opacity": ["get", "hatOpaklik"] } });
    h.addLayer({ id: "lonca-bag", type: "line", source: "lonca-bag", filter: ["!=", ["get", "kesik"], true], layout: { "line-cap": "round" }, paint: { "line-color": ["get", "renk"], "line-width": ["get", "kalinlik"], "line-opacity": ["get", "opaklik"] } });
    h.addLayer({ id: "lonca-bag-kesik", type: "line", source: "lonca-bag", filter: ["==", ["get", "kesik"], true], paint: { "line-color": ["get", "renk"], "line-width": ["get", "kalinlik"], "line-opacity": ["get", "opaklik"], "line-dasharray": [2, 2.6] } });
  };
  const ilk = (() => {
    const l = konumlu(eserler);
    if (odak && Number.isFinite(Number(odak.lat)) && Number.isFinite(Number(odak.lng))) return { merkez: [Number(odak.lng), Number(odak.lat)], zoom: Number.isFinite(Number(odak.zoom)) ? modulZoom(odak.zoom) : 12 };
    if (l.length === 1) return { merkez: [Number(l[0].konum.lng), Number(l[0].konum.lat)], zoom: 15 };
    return { merkez: [35, 39], zoom: 4 };
  })();
  const harita = await haritaAc(kutu, { tema: "koyu", gomulu: true, merkez: ilk.merkez, zoom: ilk.zoom, katmanlar });
  const ml = window.maplibregl;

  const vinyet = document.createElement("div");
  vinyet.className = "harita-vinyet";
  kutu.append(vinyet);

  let isaretler = [], etiketIsaretleri = [], bagListesiCizilen = [], liste = [], imzaOnceki = "", seciliId = secili, yerlesti = false;
  let bagListesi = Array.isArray(baglantilar) ? baglantilar : [];
  let hayaletListesi = Array.isArray(hayaletBaglantilar) ? hayaletBaglantilar : [];
  let etiketListesi = Array.isArray(etiketler) ? etiketler : [];
  let sisDurum = sis;
  let sonVeri = { eserler, rota, baglantilar: bagListesi, hayaletBaglantilar: hayaletListesi, etiketler: etiketListesi };
  let sonOdak = null;
  let sisKap = null, sisSvg = null, sisGradId = null;
  const kaynakYaz = (ad, veri) => harita.getSource(ad)?.setData(veri);

  const NS = "http://www.w3.org/2000/svg";

  function sisKur() {
    if (sisKap) return;
    sisKap = document.createElement("div");
    sisKap.className = "harita-sis";
    sisKap.style.cssText = "position:absolute;inset:0;pointer-events:none;z-index:1;";
    sisSvg = document.createElementNS(NS, "svg");
    sisSvg.setAttribute("width", "100%");
    sisSvg.setAttribute("height", "100%");
    sisSvg.style.cssText = "display:block;width:100%;height:100%;";
    const defs = document.createElementNS(NS, "defs");
    sisGradId = `sis-${Math.random().toString(36).slice(2)}`;
    const grad = document.createElementNS(NS, "radialGradient");
    grad.setAttribute("id", sisGradId);
    for (const [offset, renk] of [["48%", "#000"], ["82%", "#000"], ["100%", "#fff"]]) {
      const stop = document.createElementNS(NS, "stop");
      stop.setAttribute("offset", offset);
      stop.setAttribute("stop-color", renk);
      grad.append(stop);
    }
    defs.append(grad);
    const maske = document.createElementNS(NS, "mask");
    maske.setAttribute("id", `${sisGradId}-maske`);
    maske.setAttribute("maskUnits", "userSpaceOnUse");
    const maskeKare = document.createElementNS(NS, "rect");
    maskeKare.setAttribute("fill", "#fff");
    maske.append(maskeKare);
    const delikler = document.createElementNS(NS, "g");
    maske.append(delikler);
    defs.append(maske);
    sisSvg.append(defs);
    const koyu = document.createElementNS(NS, "rect");
    koyu.setAttribute("fill", "#08101f");
    koyu.setAttribute("opacity", String(sis?.opaklik ?? 0.9));
    koyu.setAttribute("mask", `url(#${sisGradId}-maske)`);
    sisSvg.append(koyu);
    sisKap.append(sisSvg);
    // Sis eser işaretlerinin üstünde, şehir adlarının ve harita düğmelerinin altında durur (z-index: app.css).
    kutu.append(sisKap);
    sisSvg._maskeKare = maskeKare;
    sisSvg._delikler = delikler;
    sisSvg._koyu = koyu;
    harita.on("move", sisCiz);
    harita.on("resize", sisCiz);
    sisCiz();
  }

  function sisCiz() {
    if (!sisKap || !sisSvg) return;
    sisKap.hidden = !sisDurum;
    if (!sisDurum) return;
    const { clientWidth: g, clientHeight: y } = harita.getContainer();
    sisSvg.setAttribute("viewBox", `0 0 ${g} ${y}`);
    for (const kare of [sisSvg._maskeKare, sisSvg._koyu]) {
      kare.setAttribute("width", g);
      kare.setAttribute("height", y);
    }
    sisSvg._delikler.replaceChildren();
    const alanlar = Array.isArray(sisDurum.acik) ? sisDurum.acik : [];
    for (const alan of alanlar) {
      const lat = Number(alan?.lat), lng = Number(alan?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const p = harita.project([lng, lat]);
      const mpp = 78271.51696 * Math.cos((lat * Math.PI) / 180) / 2 ** harita.getZoom();
      const r = Math.max(Number(sisDurum.minPiksel) || 24, (Number(alan.yaricap) || 600) / mpp);
      const daire = document.createElementNS(NS, "circle");
      daire.setAttribute("cx", p.x);
      daire.setAttribute("cy", p.y);
      daire.setAttribute("r", r);
      daire.setAttribute("fill", `url(#${sisGradId})`);
      sisSvg._delikler.append(daire);
    }
  }

  function etiketCiz() {
    for (const m of etiketIsaretleri) m.remove();
    etiketIsaretleri = [];
    if (harita.getZoom() >= 8) return;
    const kacis = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const yerlesen = [];
    const noktalar = etiketListesi.filter((e) => Number.isFinite(Number(e?.lat)) && Number.isFinite(Number(e?.lng)));
    noktalar.sort((a, b) => Number(!!b.acik) - Number(!!a.acik));
    for (const e of noktalar) {
      const lng = Number(e.lng), lat = Number(e.lat);
      const nokta = document.createElement("div");
      nokta.className = "harita-sehir-nokta-kap";
      nokta.innerHTML = `<span class="harita-sehir-nokta ${e.acik ? "acik" : "sisli"}"></span>`;
      nokta.setAttribute("aria-hidden", "true");
      etiketIsaretleri.push(new ml.Marker({ element: nokta }).setLngLat([lng, lat]).addTo(harita));
      const p = harita.project([lng, lat]);
      const genislik = Math.max(54, String(e.metin ?? "").length * 7.4 + 10);
      const kutuAlan = { x: p.x - genislik / 2, y: p.y - 22, w: genislik, h: 30 };
      const cakisma = yerlesen.some((r) => !(kutuAlan.x + kutuAlan.w < r.x || r.x + r.w < kutuAlan.x || kutuAlan.y + kutuAlan.h < r.y || r.y + r.h < kutuAlan.y));
      if (cakisma) continue;
      yerlesen.push(kutuAlan);
      const etiket = document.createElement("div");
      etiket.className = "harita-etiket-kap";
      etiket.setAttribute("aria-hidden", "true");
      etiket.innerHTML = `<span class="harita-etiket"><b>${kacis(e.metin)}</b>${e.alt ? `<small>${kacis(e.alt)}</small>` : ""}</span>`;
      etiketIsaretleri.push(new ml.Marker({ element: etiket, anchor: "center" }).setLngLat([lng, lat]).addTo(harita));
    }
  }

  function izgaraKur() {
    const f = [];
    for (let lat = 34; lat <= 44; lat += 2) f.push(cizgi([[24, lat], [46, lat]], {}));
    for (let lng = 24; lng <= 46; lng += 2) f.push(cizgi([[lng, 34], [lng, 44]], {}));
    izgara = { type: "FeatureCollection", features: f };
    kaynakYaz("lonca-izgara", izgara);
  }

  function odakUygula(o, zorla = false) {
    if (!o || !Number.isFinite(Number(o.lat)) || !Number.isFinite(Number(o.lng))) return;
    const zoom = Number.isFinite(Number(o.zoom)) ? modulZoom(o.zoom) : harita.getZoom();
    if (!zorla && sonOdak && sonOdak.lat === Number(o.lat) && sonOdak.lng === Number(o.lng) && sonOdak.zoom === zoom) return;
    harita.jumpTo({ center: [Number(o.lng), Number(o.lat)], zoom });
    sonOdak = { lat: Number(o.lat), lng: Number(o.lng), zoom };
  }

  // Bağların görünümü seçili esere göre: seçiliyle ilgili bağlar öne çıkar, ötekiler soluklaşır.
  function bagSec(id) {
    seciliId = id ?? null;
    bagKatmani = {
      type: "FeatureCollection",
      features: bagListesiCizilen.map(({ bag, hat }, i) => {
        const aktif = !seciliId || bag.a === seciliId || bag.b === seciliId;
        const tiklanir = !!(bag.id && onBagSec);
        return cizgi(hat, {
          i, renk: BAG_RENK[bag.tur] ?? BAG_RENK.komsu, kesik: bag.tur === "komsu" || bag.tur === "metin",
          opaklik: seciliId ? (aktif ? 1 : 0.08) : 0.85,
          kalinlik: seciliId && aktif ? 5.5 : tiklanir ? 5 : 3.2,
          hatOpaklik: seciliId ? (aktif ? 0.22 : 0.02) : 0.14,
        });
      }),
    };
    kaynakYaz("lonca-bag", bagKatmani);
  }

  function ciz({ eserler: yeni, rota: r, baglantilar: yeniBaglar, hayaletBaglantilar: yeniHayalet, etiketler: yeniEtiketler }) {
    liste = konumlu(yeni);
    if (Array.isArray(yeniBaglar)) bagListesi = yeniBaglar;
    if (Array.isArray(yeniHayalet)) hayaletListesi = yeniHayalet;
    if (Array.isArray(yeniEtiketler)) etiketListesi = yeniEtiketler;
    const imza = liste.map((e) => e.id).join("|") + (r ? "#r" : "") + "#"
      + bagListesi.map((b) => `${b.id ?? ""}-${b.a}-${b.b}-${b.tur ?? ""}-${b.baslik ?? b.etiket ?? ""}`).join(",") + "#"
      + hayaletListesi.map((b) => `${b.a?.lat}-${b.a?.lng}-${b.b?.lat}-${b.b?.lng}`).join(",") + "#"
      + etiketListesi.map((e) => `${e.metin}-${e.alt ?? ""}`).join(",");
    if (imza === imzaOnceki) return;
    imzaOnceki = imza;
    for (const m of isaretler) m.remove();
    isaretler = [];
    const noktalar = liste.map((e) => [Number(e.konum.lng), Number(e.konum.lat)]);
    const indeks = new Map(liste.map((e, i) => [e.id, i]));

    if (!yerlesti) {
      if (odak) odakUygula(odak, true);
      else if (noktalar.length > 1) {
        const s = new ml.LngLatBounds();
        for (const n of noktalar) s.extend(n);
        harita.fitBounds(s, { padding: 36, maxZoom: 16, duration: 0 });
      }
      yerlesti = true;
    }

    // Ekranda 30 pikselden yakın eserler tek küme işaretinde toplanır.
    const noktaPx = noktalar.map((n) => harita.project(n));
    const kullanildi = new Set();
    const gruplar = [];
    for (let i = 0; i < liste.length; i++) {
      if (kullanildi.has(i)) continue;
      const grup = [i];
      kullanildi.add(i);
      for (let j = i + 1; j < liste.length; j++) {
        if (kullanildi.has(j)) continue;
        if (Math.hypot(noktaPx[i].x - noktaPx[j].x, noktaPx[i].y - noktaPx[j].y) <= 30) {
          grup.push(j);
          kullanildi.add(j);
        }
      }
      gruplar.push(grup);
    }

    const gosterim = new Array(noktalar.length);
    const ortasi = (grup) => [grup.reduce((t, i) => t + noktalar[i][0], 0) / grup.length, grup.reduce((t, i) => t + noktalar[i][1], 0) / grup.length];
    for (const grup of gruplar) {
      const o = grup.length === 1 ? noktalar[grup[0]] : ortasi(grup);
      for (const i of grup) gosterim[i] = o;
    }

    const cizgiler = [];
    if (r && noktalar.length > 1) cizgiler.push(cizgi(noktalar, { tur: "rota" }));
    for (const bag of hayaletListesi) {
      if (!bag?.a || !bag?.b) continue;
      cizgiler.push(cizgi(egriNoktalar([Number(bag.a.lng), Number(bag.a.lat)], [Number(bag.b.lng), Number(bag.b.lat)]), { tur: "hayalet" }));
    }
    veriKatmani = { type: "FeatureCollection", features: cizgiler };
    kaynakYaz("lonca-cizgi", veriKatmani);

    bagListesiCizilen = [];
    for (const bag of bagListesi) {
      const ia = indeks.get(bag.a), ib = indeks.get(bag.b);
      if (ia == null || ib == null) continue;
      const a = gosterim[ia], b = gosterim[ib];
      if (a[0] === b[0] && a[1] === b[1]) continue;
      bagListesiCizilen.push({ bag, hat: egriNoktalar(a, b) });
    }

    for (const grup of gruplar) {
      const oge = document.createElement("div");
      oge.className = "pin-kap";
      if (grup.length === 1) {
        const i = grup[0];
        oge.innerHTML = `<span class="pin-nokta" style="--pin:${PIN_RENGI[liste[i].tur] ?? "#5eead4"};--i:${Math.min(i, 12)}"><i></i></span>`;
        const m = isaretKoy(harita, noktalar[i], oge, { ad: String(liste[i].ad ?? ""), onSec: () => { secimGoster(i); onSec?.(liste[i], i); } });
        m._ids = [liste[i].id];
        isaretler.push(m);
        continue;
      }
      const orta = ortasi(grup);
      oge.innerHTML = `<span class="pin-kume" style="--pin:${PIN_RENGI[liste[grup[0]].tur] ?? "#5eead4"}"><b>${grup.length}</b></span>`;
      const m = isaretKoy(harita, orta, oge, { ad: `${grup.length} eser`, onSec: () => harita.easeTo({ center: orta, zoom: Math.min(harita.getZoom() + 2, 18), duration: hareketAz() ? 0 : 500 }) });
      m._ids = grup.map((i) => liste[i].id);
      isaretler.push(m);
    }

    etiketCiz();
    sonVeri = { eserler: yeni, rota: r, baglantilar: bagListesi, hayaletBaglantilar: hayaletListesi, etiketler: etiketListesi };
    const i = seciliId ? liste.findIndex((e) => e.id === seciliId) : -1;
    if (i >= 0) secimGoster(i, false);
    else bagSec(seciliId);
  }

  function secimGoster(i, ortala = true) {
    const id = liste[i]?.id;
    isaretler.forEach((m) => m.getElement().classList.toggle("secili", !!id && m._ids?.includes(id)));
    bagSec(id);
    if (ortala && liste[i]) harita.easeTo({ center: [Number(liste[i].konum.lng), Number(liste[i].konum.lat)], zoom: Math.max(harita.getZoom(), 15), duration: hareketAz() ? 0 : 500 });
  }

  // Tıklanabilir bağlar: dokununca modüle bildirilir, üstüne gelince başlığı görünür.
  if (onBagSec) {
    const ipucu = new ml.Popup({ closeButton: false, closeOnClick: false, className: "bag-ipucu", offset: 10 });
    const bagBul = (o) => bagListesiCizilen[o.features?.[0]?.properties?.i]?.bag;
    for (const k of ["lonca-bag", "lonca-bag-kesik"]) {
      harita.on("click", k, (o) => { const bag = bagBul(o); if (bag?.id) onBagSec(bag); });
      harita.on("mousemove", k, (o) => {
        const bag = bagBul(o);
        if (!bag?.id) return;
        harita.getCanvas().style.cursor = "pointer";
        ipucu.setLngLat(o.lngLat).setText(String(bag.baslik || bag.etiket || "Tarihsel bağ")).addTo(harita);
      });
      harita.on("mouseleave", k, () => { harita.getCanvas().style.cursor = ""; ipucu.remove(); });
    }
  }

  izgaraKur();
  ciz({ eserler, rota });
  if (sisDurum) sisKur();
  const yenidenCiz = () => {
    imzaOnceki = "";
    ciz({ eserler: sonVeri.eserler, rota: sonVeri.rota, baglantilar: sonVeri.baglantilar, hayaletBaglantilar: sonVeri.hayaletBaglantilar, etiketler: sonVeri.etiketler });
  };
  harita.on("zoomend", yenidenCiz);
  setTimeout(() => { harita.resize(); yenidenCiz(); }, 60);
  const api = {
    get eserler() { return liste; },
    sec(i, ortala = true) {
      secimGoster(i, ortala);
    },
    guncelle(o = {}) {
      if (o.sis !== undefined) {
        sisDurum = o.sis;
        if (sisDurum) sisKur();
        sisCiz();
      }
      if (o.eserler || o.rota !== undefined || o.baglantilar || o.hayaletBaglantilar || o.etiketler) {
        ciz({ eserler: o.eserler ?? liste, rota: o.rota ?? false, baglantilar: o.baglantilar ?? bagListesi, hayaletBaglantilar: o.hayaletBaglantilar ?? hayaletListesi, etiketler: o.etiketler ?? etiketListesi });
      }
      if (o.odak) odakUygula(o.odak);
      if (o.secili !== undefined) {
        const i = liste.findIndex((e) => e.id === o.secili);
        if (i >= 0) secimGoster(i, false);
        else bagSec(null);
      }
    },
    yokEt() {
      harita.off("zoomend", yenidenCiz);
      sisKap?.remove();
      harita.stop();
      harita.remove();
    },
  };
  if (secili) { const i = liste.findIndex((e) => e.id === secili); if (i >= 0) secimGoster(i, false); }
  return api;
}

export async function haritaGoster(eserler, secenek, { el, sahneyeKoy, seslendir, gorsel, cipler, yerBilgisi, dugme, turAdi }) {
  const gecerli = konumlu(eserler);
  const baslik = String(secenek.baslik || "Eser haritası");
  const rota = !!secenek.rota;
  const baglantilar = Array.isArray(secenek.baglantilar) ? secenek.baglantilar : [];
  const sis = secenek.sis ?? null;
  const etiketler = Array.isArray(secenek.etiketler) ? secenek.etiketler : [];
  const hayaletBaglantilar = Array.isArray(secenek.hayaletBaglantilar) ? secenek.hayaletBaglantilar : [];
  const odak = secenek.odak ?? null;

  const kutu = el("div", { className: "harita", role: "region", ariaLabel: `${baslik}: ${gecerli.length} eser` });
  const sayfa = el("div", { className: "harita-sayfa", hidden: true });
  const listeKap = el(rota ? "ol" : "ul", { className: "harita-liste" });
  const kapat = dugme("Haritayı kapat", "dugme ikincil");
  sahneyeKoy(
    el("h2", { className: "ekran-baslik", textContent: baslik }),
    el("p", { className: "ekran-alt", textContent: rota ? `${gecerli.length} duraklı rota` : `${gecerli.length} eser` }),
    kutu, sayfa,
    el("h3", { className: "liste-baslik", textContent: rota ? "Duraklar" : "Haritadaki eserler" }),
    listeKap, kapat);

  // eslint-disable-next-line no-async-promise-executor -- harita kurulumu beklenirken kapat düğmesi de çözebilmeli
  return new Promise(async (coz) => {
    let harita = null, bitti = false;
    const bitir = (sonuc) => { bitti = true; harita?.yokEt(); coz(sonuc); };
    kapat.addEventListener("click", () => bitir(null), { once: true });
    if (!gecerli.length) {
      kutu.replaceChildren(el("p", { className: "bos", textContent: "Haritada gösterilecek konumlu eser yok." }));
      return;
    }

    function bilgiKarti(eser) {
      const ac = dugme("Detayları gör", "dugme");
      ac.addEventListener("click", () => bitir(eser), { once: true });
      sayfa.hidden = false;
      sayfa.replaceChildren(
        gorsel(eser, "sayfa-gorsel"),
        el("div", { className: "sayfa-govde" }, cipler(eser), el("h3", { className: "sayfa-ad", textContent: String(eser.ad ?? "") }), yerBilgisi(eser), ac));
      sayfa.scrollIntoView({ behavior: "smooth", block: "nearest" });
      seslendir(`${eser.ad}. ${turAdi(eser.tur)}.`);
    }

    harita = await haritaKur(kutu, { eserler: gecerli, rota, baglantilar, hayaletBaglantilar, sis, etiketler, odak, onSec: (eser) => bilgiKarti(eser) });
    if (bitti) { harita.yokEt(); return; }

    listeKap.append(...gecerli.map((eser, i) => {
      const d = el("button", { className: "liste-ogesi" },
        el("span", { className: "liste-nokta", ariaHidden: "true", textContent: rota ? String(i + 1) : "" }),
        el("span", { textContent: String(eser.ad ?? "") }),
        el("span", { className: "liste-tur", textContent: turAdi(eser.tur) }));
      d.querySelector(".liste-nokta").style.setProperty("--pin", PIN_RENGI[eser.tur] ?? "#1f3a93");
      d.addEventListener("click", () => { kutu.scrollIntoView({ behavior: "smooth", block: "center" }); harita.sec(i); bilgiKarti(eser); });
      return el("li", {}, d);
    }));
    seslendir(`${baslik}. Haritada ${gecerli.length} eser var. Altta liste olarak da seçebilirsin.`);
  });
}
