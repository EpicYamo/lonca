import { baglaninca } from "/ortak/animasyon.js";
import { ayarlariGetir } from "/ortak/ayarlar.js";

let googleOturumu = null;
async function karoKatmani(L) {
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
  return L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> katkıcıları',
  });
}

let leafletYukleniyor = null;
function leafletYukle() {
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

const PIN_HARF = { cami: "C", mescit: "M", han: "H", carsi: "Ç", hamam: "Hm", cesme: "Ç", kopru: "K", medrese: "Md", kutuphane: "K", turbe: "T", hazire: "Hz", tekke: "Tk", kulliye: "Kl", imaret: "İ" };

const konumlu = (liste) => (Array.isArray(liste) ? liste : []).slice(0, 200)
  .filter((e) => Number.isFinite(Number(e?.konum?.lat)) && Number.isFinite(Number(e?.konum?.lng)));

export async function haritaKur(kutu, { eserler, rota = false, secili = null, onSec }) {
  const L = await leafletYukle();
  await baglaninca(kutu); 
  const harita = L.map(kutu, { zoomControl: true, attributionControl: true, scrollWheelZoom: false });
  (await karoKatmani(L)).addTo(harita);

  const katman = L.layerGroup().addTo(harita);
  let isaretler = [], liste = [], imzaOnceki = "";

  function ciz({ eserler: yeni, rota: r }) {
    liste = konumlu(yeni);
    const imza = liste.map((e) => e.id).join("|") + (r ? "#r" : "");
    if (imza === imzaOnceki) return;
    imzaOnceki = imza;
    katman.clearLayers();
    const noktalar = liste.map((e) => [Number(e.konum.lat), Number(e.konum.lng)]);
    if (r && noktalar.length > 1) {
      L.polyline(noktalar, { color: "#1f3a93", weight: 4, opacity: 0.75, dashArray: "2 10", lineCap: "round", className: "rota-cizgi" }).addTo(katman);
    }
    isaretler = liste.map((eser, i) => {
      const icon = L.divIcon({
        className: "pin-kap",
        html: `<span class="pin" style="--pin:${PIN_RENGI[eser.tur] ?? "#1f3a93"};--i:${Math.min(i, 12)}"><b data-harf="${PIN_HARF[eser.tur] ?? "•"}">${r ? i + 1 : ""}</b></span>`,
        iconSize: [34, 42], iconAnchor: [17, 40],
      });
      const m = L.marker(noktalar[i], { icon, title: String(eser.ad ?? ""), alt: String(eser.ad ?? ""), keyboard: true }).addTo(katman);
      m.on("click", () => { secimGoster(i); onSec?.(eser, i); });
      return m;
    });
    if (noktalar.length) harita.fitBounds(L.latLngBounds(noktalar), { padding: [36, 36], maxZoom: 16 });
  }

  function secimGoster(i) {
    isaretler.forEach((m, j) => m.getElement()?.classList.toggle("secili", j === i));
  }

  ciz({ eserler, rota });
  setTimeout(() => harita.invalidateSize(), 60);
  const api = {
    get eserler() { return liste; },
    sec(i, ortala = true) {
      secimGoster(i);
      if (ortala && liste[i]) harita.setView([Number(liste[i].konum.lat), Number(liste[i].konum.lng)], Math.max(harita.getZoom(), 16), { animate: true });
    },
    guncelle(o) {
      ciz({ eserler: o.eserler ?? liste, rota: o.rota });
      if (o.secili) { const i = liste.findIndex((e) => e.id === o.secili); if (i >= 0) api.sec(i); }
    },
    yokEt() { harita.remove(); },
  };
  if (secili) { const i = liste.findIndex((e) => e.id === secili); if (i >= 0) secimGoster(i); }
  return api;
}

export async function haritaGoster(eserler, secenek, { el, sahneyeKoy, seslendir, gorsel, cipler, yerBilgisi, dugme, turAdi }) {
  const gecerli = konumlu(eserler);
  const baslik = String(secenek.baslik || "Eser haritası");
  const rota = !!secenek.rota;

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

    harita = await haritaKur(kutu, { eserler: gecerli, rota, onSec: (eser) => bilgiKarti(eser) });
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
