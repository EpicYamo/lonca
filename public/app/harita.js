import { baglaninca } from "/ortak/animasyon.js";
import { ayarlariGetir } from "/ortak/ayarlar.js";

let googleOturumu = null;
export async function karoKatmani(L) {
  const { harita } = await ayarlariGetir();
  if (harita?.saglayici === "google" && harita.anahtar) {
    try {
      googleOturumu ??= fetch(`https://tile.googleapis.com/v1/createSession?key=${encodeURIComponent(harita.anahtar)}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ mapType: "roadmap", language: "tr-TR", region: "TR", scale: "scaleFactor2x" }),
      }).then((y) => (y.ok ? y.json() : Promise.reject(new Error(`Google oturumu: ${y.status}`))));
      const { session } = await googleOturumu;
      return L.tileLayer(`https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session=${session}&key=${encodeURIComponent(harita.anahtar)}`, {
        maxZoom: 21, tileSize: 256, attribution: "Harita verileri ©2026 Google",
      });
    } catch (h) {
      console.warn("Google haritası açılamadı, OpenStreetMap'e geçiliyor:", h.message);
      googleOturumu = null;
    }
  }
  const osm = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> katkıcıları',
  });
  osm._koyu = true;
  return osm;
}

let leafletYukleniyor = null;
export function leafletYukle() {
  leafletYukleniyor ??= new Promise((coz, reddet) => {
    const css = Object.assign(document.createElement("link"), { rel: "stylesheet", href: "/vendor/leaflet/leaflet.css" });
    const js = Object.assign(document.createElement("script"), { src: "/vendor/leaflet/leaflet.js" });
    js.onload = () => coz(window.L);
    js.onerror = () => reddet(new Error("Harita kütüphanesi yüklenemedi"));
    document.head.append(css, js);
  });
  return leafletYukleniyor;
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
  aile: "Hanedan / aile", ticaret: "Ticaret ağı", metin: "Metinde anılıyor", komsu: "Tarihî komşuluk", tipoloji: "Mimari gelenek",
};
export const bagTuruAdi = (tur) => BAG_ADI[tur] ?? "Tarihsel bağ";

const konumlu = (liste) => (Array.isArray(liste) ? liste : []).slice(0, 200)
  .filter((e) => Number.isFinite(Number(e?.konum?.lat)) && Number.isFinite(Number(e?.konum?.lng)));

export async function haritaKur(kutu, { eserler, rota = false, secili = null, baglantilar = [], hayaletBaglantilar = [], sis = null, etiketler = [], odak = null, onSec }) {
  const L = await leafletYukle();
  await baglaninca(kutu);
  kutu.style.position = "relative";
  const harita = L.map(kutu, { zoomControl: true, attributionControl: true, scrollWheelZoom: false, zoomAnimation: false });
  const karo = await karoKatmani(L);
  if (karo._koyu) kutu.classList.add("harita-koyu-tema");
  karo.addTo(harita);
  const BAG_PANE = "baglanti-pane";
  harita.createPane(BAG_PANE);
  const bagPane = harita.getPane(BAG_PANE);
  bagPane.style.zIndex = "655";
  bagPane.style.pointerEvents = "none";
  const ETIKET_PANE = "sehir-etiket-pane";
  harita.createPane(ETIKET_PANE);
  const etiketPane = harita.getPane(ETIKET_PANE);
  etiketPane.style.zIndex = "660";
  etiketPane.style.pointerEvents = "none";

  const vinyet = document.createElement("div");
  vinyet.className = "harita-vinyet";
  kutu.append(vinyet);

  const cizgiKatmani = L.layerGroup().addTo(harita);
  const etiketKatmani = L.layerGroup().addTo(harita);
  const izgaraKatmani = L.layerGroup().addTo(harita);
  const katman = L.layerGroup().addTo(harita);
  let isaretler = [], cizgiler = [], liste = [], imzaOnceki = "", seciliId = secili, yerlesti = false;
  let bagListesi = Array.isArray(baglantilar) ? baglantilar : [];
  let hayaletListesi = Array.isArray(hayaletBaglantilar) ? hayaletBaglantilar : [];
  let etiketListesi = Array.isArray(etiketler) ? etiketler : [];
  let sisDurum = sis;
  let sonVeri = { eserler, rota, baglantilar: bagListesi, hayaletBaglantilar: hayaletListesi, etiketler: etiketListesi };
  let sonOdak = null;
  let sisKap = null, sisSvg = null, sisGradId = null;

  const NS = "http://www.w3.org/2000/svg";

  function sisKur() {
    if (sisKap) return;
    sisKap = document.createElement("div");
    sisKap.className = "harita-sis";
    sisKap.style.cssText = "position:absolute;inset:0;pointer-events:none;z-index:650;";
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
    kutu.append(sisKap);
    sisSvg._maskeKare = maskeKare;
    sisSvg._delikler = delikler;
    sisSvg._koyu = koyu;
    harita.on("move zoom resize", sisCiz);
    sisCiz();
  }

  function sisCiz() {
    if (!sisKap || !sisSvg) return;
    sisKap.hidden = !sisDurum;
    if (!sisDurum) return;
    const boyut = harita.getSize();
    sisSvg.setAttribute("viewBox", `0 0 ${boyut.x} ${boyut.y}`);
    for (const kare of [sisSvg._maskeKare, sisSvg._koyu]) {
      kare.setAttribute("width", boyut.x);
      kare.setAttribute("height", boyut.y);
    }
    sisSvg._delikler.replaceChildren();
    const alanlar = Array.isArray(sisDurum.acik) ? sisDurum.acik : [];
    for (const alan of alanlar) {
      const lat = Number(alan?.lat), lng = Number(alan?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const p = harita.latLngToContainerPoint([lat, lng]);
      const mpp = 156543.03392 * Math.cos((lat * Math.PI) / 180) / 2 ** harita.getZoom();
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
    etiketKatmani.clearLayers();
    const gizli = harita.getZoom() >= 9;
    kutu.classList.toggle("etiket-gizle", gizli);
    if (gizli) return;
    const kacis = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const yerlesen = [];
    const noktalar = [];
    for (const e of etiketListesi) {
      if (!Number.isFinite(Number(e?.lat)) || !Number.isFinite(Number(e?.lng))) continue;
      noktalar.push(e);
    }
    noktalar.sort((a, b) => Number(!!b.acik) - Number(!!a.acik));
    for (const e of noktalar) {
      const lat = Number(e.lat), lng = Number(e.lng);
      const nokta = L.divIcon({
        className: "harita-sehir-nokta-kap",
        html: `<span class="harita-sehir-nokta ${e.acik ? "acik" : "sisli"}"></span>`,
        iconSize: [10, 10], iconAnchor: [5, 5],
      });
      L.marker([lat, lng], { icon: nokta, interactive: false, keyboard: false, pane: ETIKET_PANE }).addTo(etiketKatmani);
      const p = harita.latLngToContainerPoint([lat, lng]);
      const genislik = Math.max(54, String(e.metin ?? "").length * 7.4 + 10);
      const kutuAlan = { x: p.x - genislik / 2, y: p.y - 22, w: genislik, h: 30 };
      const cakisma = yerlesen.some((r) => !(kutuAlan.x + kutuAlan.w < r.x || r.x + r.w < kutuAlan.x || kutuAlan.y + kutuAlan.h < r.y || r.y + r.h < kutuAlan.y));
      if (cakisma) continue;
      yerlesen.push(kutuAlan);
      const icon = L.divIcon({
        className: "harita-etiket-kap",
        html: `<span class="harita-etiket"><b>${kacis(e.metin)}</b>${e.alt ? `<small>${kacis(e.alt)}</small>` : ""}</span>`,
        iconSize: [1, 1], iconAnchor: [0, 0],
      });
      L.marker([lat, lng], { icon, interactive: false, keyboard: false, pane: ETIKET_PANE }).addTo(etiketKatmani);
    }
  }

  function izgaraCiz() {
    izgaraKatmani.clearLayers();
    if (harita.getZoom() > 7) return;
    const stil = { color: "#5eead4", weight: 0.7, opacity: 0.12, dashArray: "2 8", interactive: false };
    for (let lat = 34; lat <= 44; lat += 2) {
      L.polyline([[lat, 24], [lat, 46]], stil).addTo(izgaraKatmani);
    }
    for (let lng = 24; lng <= 46; lng += 2) {
      L.polyline([[34, lng], [44, lng]], stil).addTo(izgaraKatmani);
    }
  }

  function odakUygula(o, zorla = false) {
    if (!o || !Number.isFinite(Number(o.lat)) || !Number.isFinite(Number(o.lng))) return;
    const zoom = Number.isFinite(Number(o.zoom)) ? Number(o.zoom) : harita.getZoom();
    if (!zorla && sonOdak && sonOdak.lat === Number(o.lat) && sonOdak.lng === Number(o.lng) && sonOdak.zoom === zoom) return;
    harita.setView([Number(o.lat), Number(o.lng)], zoom, { animate: false });
    sonOdak = { lat: Number(o.lat), lng: Number(o.lng), zoom };
  }

  function egriNoktalar(a, b) {
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (d < 0.015) return [a, b];
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    const nx = -(b[1] - a[1]), ny = b[0] - a[0];
    const norm = Math.hypot(nx, ny) || 1;
    const egim = Math.min(0.9, d * 0.09) / norm;
    const cx = mx + nx * egim, cy = my + ny * egim;
    return Array.from({ length: 26 }, (_, i) => {
      const t = i / 25;
      return [
        (1 - t) ** 2 * a[0] + 2 * (1 - t) * t * cx + t ** 2 * b[0],
        (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * cy + t ** 2 * b[1],
      ];
    });
  }

  function bagSec(id) {
    seciliId = id ?? null;
    for (const cizgi of cizgiler) {
      const bag = cizgi._bag ?? {};
      const aktif = !seciliId || bag.a === seciliId || bag.b === seciliId;
      cizgi.setStyle({
        opacity: seciliId ? (aktif ? 1 : 0.08) : 0.9,
        weight: seciliId && aktif ? 5.5 : 3.5,
      });
      cizgi._hat?.setStyle({ opacity: seciliId ? (aktif ? 0.22 : 0.02) : 0.16 });
    }
  }

  function ciz({ eserler: yeni, rota: r, baglantilar: yeniBaglar, hayaletBaglantilar: yeniHayalet, etiketler: yeniEtiketler }) {
    liste = konumlu(yeni);
    if (Array.isArray(yeniBaglar)) bagListesi = yeniBaglar;
    if (Array.isArray(yeniHayalet)) hayaletListesi = yeniHayalet;
    if (Array.isArray(yeniEtiketler)) etiketListesi = yeniEtiketler;
    const imza = liste.map((e) => e.id).join("|") + (r ? "#r" : "") + "#"
      + bagListesi.map((b) => `${b.a}-${b.b}-${b.tur ?? ""}`).join(",") + "#"
      + hayaletListesi.map((b) => `${b.a?.lat}-${b.a?.lng}-${b.b?.lat}-${b.b?.lng}`).join(",") + "#"
      + etiketListesi.map((e) => `${e.metin}-${e.alt ?? ""}`).join(",");
    if (imza === imzaOnceki) return;
    imzaOnceki = imza;
    cizgiKatmani.clearLayers();
    katman.clearLayers();
    cizgiler = [];
    const noktalar = liste.map((e) => [Number(e.konum.lat), Number(e.konum.lng)]);
    const indeks = new Map(liste.map((e, i) => [e.id, i]));

    if (!yerlesti) {
      if (odak) odakUygula(odak, true);
      else if (noktalar.length) harita.fitBounds(L.latLngBounds(noktalar), { padding: [36, 36], maxZoom: 17 });
      else harita.setView([39, 35], 5);
      yerlesti = true;
    }

    const noktaPx = liste.map((e, i) => harita.latLngToContainerPoint(noktalar[i]));
    const kullanildi = new Set();
    const gruplar = [];
    for (let i = 0; i < liste.length; i++) {
      if (kullanildi.has(i)) continue;
      const grup = [i];
      kullanildi.add(i);
      for (let j = i + 1; j < liste.length; j++) {
        if (kullanildi.has(j)) continue;
        if (noktaPx[i].distanceTo(noktaPx[j]) <= 30) {
          grup.push(j);
          kullanildi.add(j);
        }
      }
      gruplar.push(grup);
    }

    const gosterim = new Array(noktalar.length);
    for (const grup of gruplar) {
      if (grup.length === 1) {
        gosterim[grup[0]] = noktalar[grup[0]];
      } else {
        const orta = grup.reduce((acc, i) => ({ lat: acc.lat + Number(liste[i].konum.lat) / grup.length, lng: acc.lng + Number(liste[i].konum.lng) / grup.length }), { lat: 0, lng: 0 });
        for (const i of grup) gosterim[i] = [orta.lat, orta.lng];
      }
    }

    if (r && noktalar.length > 1) {
      L.polyline(noktalar, { color: "#1f3a93", weight: 4, opacity: 0.75, dashArray: "2 10", lineCap: "round", className: "rota-cizgi" }).addTo(cizgiKatmani);
    }

    for (const bag of hayaletListesi) {
      if (!bag?.a || !bag?.b) continue;
      L.polyline(egriNoktalar([Number(bag.a.lat), Number(bag.a.lng)], [Number(bag.b.lat), Number(bag.b.lng)]), {
        color: "#5eead4", weight: 1.6, opacity: 0.30,
        dashArray: "2 10", interactive: false, pane: BAG_PANE, className: "hayalet-cizgi",
      }).addTo(cizgiKatmani);
    }

    for (const bag of bagListesi) {
      const ia = indeks.get(bag.a), ib = indeks.get(bag.b);
      if (ia == null || ib == null) continue;
      const a = gosterim[ia], b = gosterim[ib];
      if (a[0] === b[0] && a[1] === b[1]) continue;
      const hat = egriNoktalar(a, b);
      const hatCizgi = L.polyline(hat, { color: "#ffffff", weight: 10, opacity: 0.12, interactive: false, lineCap: "round", pane: BAG_PANE }).addTo(cizgiKatmani);
      const cizgi = L.polyline(hat, {
        color: BAG_RENK[bag.tur] ?? BAG_RENK.komsu,
        weight: 3.2,
        opacity: 0.9,
        dashArray: bag.tur === "komsu" || bag.tur === "metin" ? "6 8" : null,
        interactive: false,
        pane: BAG_PANE,
        className: "bag-cizgi",
      }).addTo(cizgiKatmani);
      cizgi._bag = bag;
      cizgi._hat = hatCizgi;
      cizgiler.push(cizgi);
    }

    isaretler = [];
    for (const grup of gruplar) {
      if (grup.length === 1) {
        const i = grup[0];
        const renk = PIN_RENGI[liste[i].tur] ?? "#5eead4";
        const icon = L.divIcon({
          className: "pin-kap",
          html: `<span class="pin-nokta" style="--pin:${renk};--i:${Math.min(i, 12)}"><i></i></span>`,
          iconSize: [18, 18], iconAnchor: [9, 9],
        });
        const m = L.marker(noktalar[i], { icon, title: String(liste[i].ad ?? ""), alt: String(liste[i].ad ?? ""), keyboard: true, riseOnHover: true }).addTo(katman);
        m._ids = [liste[i].id];
        m.on("click", () => { secimGoster(i); onSec?.(liste[i], i); });
        isaretler.push(m);
        continue;
      }
      const orta = grup.reduce((acc, i) => ({ lat: acc.lat + Number(liste[i].konum.lat) / grup.length, lng: acc.lng + Number(liste[i].konum.lng) / grup.length }), { lat: 0, lng: 0 });
      const renk = PIN_RENGI[liste[grup[0]].tur] ?? "#5eead4";
      const icon = L.divIcon({
        className: "pin-kap",
        html: `<span class="pin-kume" style="--pin:${renk}"><b>${grup.length}</b></span>`,
        iconSize: [36, 36], iconAnchor: [18, 18],
      });
      const m = L.marker([orta.lat, orta.lng], { icon, title: `${grup.length} eser`, alt: `${grup.length} eser`, keyboard: true, riseOnHover: true }).addTo(katman);
      m._ids = grup.map((i) => liste[i].id);
      m.on("click", () => harita.setView([orta.lat, orta.lng], Math.min(harita.getZoom() + 2, 19), { animate: true }));
      isaretler.push(m);
    }

    etiketCiz();
    izgaraCiz();
    sonVeri = { eserler: yeni, rota: r, baglantilar: bagListesi, hayaletBaglantilar: hayaletListesi, etiketler: etiketListesi };
    const i = seciliId ? liste.findIndex((e) => e.id === seciliId) : -1;
    if (i >= 0) secimGoster(i, false);
    else bagSec(seciliId);
  }

  function secimGoster(i, ortala = true) {
    const id = liste[i]?.id;
    isaretler.forEach((m) => m.getElement()?.classList.toggle("secili", !!id && m._ids?.includes(id)));
    bagSec(id);
    if (ortala && liste[i]) harita.setView([Number(liste[i].konum.lat), Number(liste[i].konum.lng)], Math.max(harita.getZoom(), 16), { animate: true });
  }

  ciz({ eserler, rota });
  if (sisDurum) sisKur();
  const yenidenCiz = () => {
    imzaOnceki = "";
    ciz({ eserler: sonVeri.eserler, rota: sonVeri.rota, baglantilar: sonVeri.baglantilar, hayaletBaglantilar: sonVeri.hayaletBaglantilar, etiketler: sonVeri.etiketler });
    const i = seciliId ? liste.findIndex((e) => e.id === seciliId) : -1;
    if (i >= 0) secimGoster(i, false);
  };
  harita.on("zoomend", yenidenCiz);
  setTimeout(() => { harita.invalidateSize(); yenidenCiz(); }, 60);
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
      harita.off("move zoom resize", sisCiz);
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
