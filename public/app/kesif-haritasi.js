// Keşfet haritası: konumu bilinen bütün vakıf eserleri haritada işaretli. İşarete dokununca altta eser kartı açılır:
// fotoğraf, tür · yüzyıl · ilçe, tarihçeden kısa not, "Ayrıntılar" (eser sayfası), eserin dalışı ve kapağında
// eserin olduğu modüller. Uygulamada Keşfet sekmesinin kendisi, web'de ana sayfada bir bölüm.
// Konum yalnızca "Yakınımdaki eserler"e basılınca sorulur.
//
// Harita iki sürücüyle çalışır, ikisi de aynı işaretleri, listeyi, il seçimini ve kartı kullanır:
//  - 3B vektör harita (MapLibre GL + OpenFreeMap, anahtar gerekmez): binalar yükseklikleriyle görünür; tek parmakla
//    kaydırma, iki parmakla yakınlaştırma, döndürme ve eğme. Açık temada "liberty", koyu temada "dark" stili.
//  - WebGL yoksa ya da kütüphane yüklenemezse Leaflet (Esri altlığı); harita hiçbir durumda boş kalmaz.
import { leafletYukle, karoKatmani, PIN_RENGI, koyuTemaMi } from "./harita.js";

const KISA_NOT = 230;
function kisaNot(metin) {
  const t = String(metin ?? "").replace(/\s+/g, " ").trim();
  if (t.length <= KISA_NOT) return t;
  const kes = t.slice(0, KISA_NOT);
  const nokta = kes.lastIndexOf(". ");
  return nokta > 120 ? kes.slice(0, nokta + 1) : `${kes.replace(/\s+\S*$/, "")}…`;
}

const hareketAz = () => document.documentElement.classList.contains("hareket-az") || matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- MapLibre yükleme ----------
const STIL = { acik: "https://tiles.openfreemap.org/styles/liberty", koyu: "https://tiles.openfreemap.org/styles/dark" };
let maplibreYukleniyor = null;
function maplibreYukle() {
  maplibreYukleniyor ??= new Promise((coz, reddet) => {
    const css = Object.assign(document.createElement("link"), { rel: "stylesheet", href: "/vendor/maplibre/maplibre-gl.css" });
    const js = Object.assign(document.createElement("script"), { src: "/vendor/maplibre/maplibre-gl.js" });
    js.onload = () => (window.maplibregl ? coz(window.maplibregl) : reddet(new Error("MapLibre yüklenmedi")));
    js.onerror = () => { maplibreYukleniyor = null; reddet(new Error("3B harita kütüphanesi yüklenemedi")); };
    document.head.append(css, js);
  });
  return maplibreYukleniyor;
}
function webglVar() {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; }
}

// Koyu stilde 3B bina katmanı yok: aynı bina verisinden ekleriz. Açık stilde (liberty) var; rengini sıcaklaştırırız.
function binalariKur(harita) {
  const koyu = koyuTemaMi();
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

// ---------- Sürücüler: aynı arayüz (isaretEkle, gorunur, odakla, sigdir, konum, boyutla) ----------
async function maplibreSurucusu(kap, { onBosTik }) {
  const ml = await maplibreYukle();
  const harita = new ml.Map({
    container: kap, style: koyuTemaMi() ? STIL.koyu : STIL.acik,
    center: [29.065, 40.1845], zoom: 14.2, pitch: 50, bearing: -12, maxPitch: 70,
    attributionControl: { compact: true }, cooperativeGestures: false, dragRotate: true, touchPitch: true,
    fadeDuration: hareketAz() ? 0 : 250,
  });
  harita.addControl(new ml.NavigationControl({ showZoom: false, visualizePitch: true }), "bottom-right");
  harita.on("style.load", () => binalariKur(harita));
  harita.on("click", (o) => { if (!o.originalEvent?.target?.closest?.(".kh-isaret-kap")) onBosTik(); });
  // Tema değişince stil yerinde değişir; işaretler DOM'da olduğu için korunur.
  let koyu = koyuTemaMi();
  new MutationObserver(() => {
    if (koyuTemaMi() === koyu) return;
    koyu = koyuTemaMi();
    harita.setStyle(koyu ? STIL.koyu : STIL.acik);
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-tema", "class"] });
  await new Promise((coz, reddet) => {
    const zaman = setTimeout(() => reddet(new Error("3B harita zamanında açılamadı")), 15000);
    harita.once("load", () => { clearTimeout(zaman); coz(); });
    // Tek bir karonun gelmemesi haritayı düşürmez; yalnızca stilin kendisi yüklenemezse düz haritaya geçilir.
    const hata = (o) => { if (!o.sourceId && !o.tile && !harita.isStyleLoaded()) { clearTimeout(zaman); harita.off("error", hata); reddet(o.error ?? new Error("3B harita açılamadı")); } };
    harita.on("error", hata);
  });
  const sure = () => (hareketAz() ? 0 : 900);
  let konumIsareti = null;
  return {
    tur: "3b",
    isaretEkle(e, oge) { return new ml.Marker({ element: oge, anchor: "center" }).setLngLat([e.konum.lng, e.konum.lat]).addTo(harita); },
    gorunur(m, acik) { if (acik) m.addTo(harita); else m.remove(); },
    odakla(e, kartBoyu = 0) {
      const hedef = { center: [e.konum.lng, e.konum.lat], zoom: Math.max(harita.getZoom(), 16.2), pitch: 55 };
      // Alttan açılan kart haritayı örttüğü için eser kartın üstündeki boş alanın ortasında durur.
      const alt = Math.min(Math.round(kartBoyu), Math.round(kap.clientHeight * 0.72));
      harita.easeTo({ ...hedef, padding: { top: 0, bottom: alt, left: 0, right: 0 }, duration: sure() });
    },
    sigdir(liste, ust = 72) {
      if (!liste.length) return;
      const s = new ml.LngLatBounds();
      for (const e of liste) s.extend([e.konum.lng, e.konum.lat]);
      harita.fitBounds(s, { padding: { top: ust, bottom: 48, left: 32, right: 32 }, maxZoom: 15.5, pitch: 45, duration: sure() });
    },
    merkezeGit() { harita.jumpTo({ center: [29.065, 40.1845], zoom: 14.2, pitch: 50, bearing: -12 }); },
    konum(k) {
      konumIsareti?.remove();
      const nokta = document.createElement("span");
      nokta.className = "kh-konum";
      nokta.setAttribute("aria-hidden", "true");
      konumIsareti = new ml.Marker({ element: nokta }).setLngLat([k[1], k[0]]).addTo(harita);
    },
    boyutla() { harita.resize(); },
  };
}

async function leafletSurucusu(kap, { onBosTik }) {
  const L = await leafletYukle();
  const harita = L.map(kap, { zoomControl: true, attributionControl: true, scrollWheelZoom: false, tap: true });
  (await karoKatmani(L)).addTo(harita);
  harita.on("click", onBosTik);
  let konumIsareti = null;
  return {
    tur: "2b",
    isaretEkle(e, oge) {
      const ikon = L.divIcon({ className: "", html: oge, iconSize: [26, 26], iconAnchor: [13, 13] });
      return L.marker([e.konum.lat, e.konum.lng], { icon: ikon, keyboard: false, title: e.ad, riseOnHover: true }).addTo(harita);
    },
    gorunur(m, acik) { if (acik) m.addTo(harita); else m.remove(); },
    odakla(e) {
      if (harita.getZoom() < 15) harita.setView([e.konum.lat, e.konum.lng], 15, { animate: false });
      else harita.panTo([e.konum.lat, e.konum.lng], { animate: !hareketAz() });
    },
    sigdir(liste) { if (liste.length) harita.fitBounds(L.latLngBounds(liste.map((e) => [e.konum.lat, e.konum.lng])), { padding: [32, 32], maxZoom: 15 }); },
    merkezeGit() { harita.setView([40.1845, 29.065], 14); },
    konum(k) {
      konumIsareti?.remove();
      konumIsareti = L.circleMarker(k, { radius: 8, color: "#fff", weight: 3, fillColor: "#1a73e8", fillOpacity: 1, interactive: false }).addTo(harita);
    },
    boyutla() { harita.invalidateSize(); },
  };
}

export function kesifHaritasiKur({ el, api, TUR_ADI, eserAc, modulAc, moduller, dalisModulu, bildir }) {
  const $ = (s) => document.querySelector(s);
  const kap = $("#kesif-haritasi");
  const kart = $("#kh-kart");
  let kuruldu = null, surucu = null, seciliIl = "", eserler = [], dalislar = new Set(), seciliOge = null;
  const isaretler = new Map(); // id → { m (sürücünün işareti), oge (DOM) }

  function isaretOlustur(e) {
    const renk = PIN_RENGI[e.tur] ?? "#0b7a66";
    const oge = el("div", { className: "kh-isaret-kap", title: e.ad });
    oge.innerHTML = `<span class="kh-isaret" style="--renk:${renk}"></span>`;
    // İşaretler sık ve üst üste binebilir: dokunmayla seçilir, klavye ve ekran okuyucu için aynı eserler "Liste"de düğme olarak durur.
    oge.setAttribute("aria-hidden", "true");
    oge.addEventListener("click", (o) => { o.stopPropagation(); kartAc(e); });
    isaretler.set(e.id, { m: surucu.isaretEkle(e, oge), oge });
  }

  function kartAc(e) {
    seciliOge?.classList.remove("secili");
    seciliOge = isaretler.get(e.id)?.oge ?? null;
    seciliOge?.classList.add("secili");
    const foto = $("#kh-foto");
    foto.style.backgroundImage = e.fotograflar?.[0] ? `url("${e.fotograflar[0]}")` : "";
    foto.classList.toggle("bos", !e.fotograflar?.[0]);
    $("#kh-tur").textContent = [TUR_ADI[e.tur] ?? "Eser", e.yuzyil ? `${e.yuzyil}. yüzyıl` : null, e.ilce].filter(Boolean).join(" · ");
    $("#kh-ad").textContent = e.ad;
    const not = kisaNot(e.tarihce?.tr);
    $("#kh-not").textContent = (not || "Bu eser için henüz kısa not yok.") + (e.konum?.yaklasik ? " Konum yaklaşıktır." : "");
    const eylemler = [];
    const ayrinti = el("button", { type: "button", className: "dugme kucuk", textContent: "Ayrıntılar" });
    ayrinti.addEventListener("click", () => eserAc(e.id));
    eylemler.push(ayrinti);
    const dalis = dalislar.has(e.id) ? dalisModulu() : null;
    if (dalis) {
      const b = el("button", { type: "button", className: "dugme ikincil kucuk", textContent: "İçine dal" });
      b.addEventListener("click", () => modulAc(dalis));
      eylemler.push(b);
    }
    for (const mod of moduller().filter((x) => x.kapakEser === e.id && x !== dalis).slice(0, 2)) {
      const b = el("button", { type: "button", className: "dugme ikincil kucuk", textContent: mod.ad });
      b.setAttribute("aria-label", `${mod.ad} modülünü aç`);
      b.addEventListener("click", () => modulAc(mod));
      eylemler.push(b);
    }
    $("#kh-eylemler").replaceChildren(...eylemler);
    kart.style.transform = "";
    kart.scrollTop = 0;
    kart.hidden = false;
    surucu.odakla(e, kart.offsetHeight);
  }
  function kartKapat() {
    const odakKartta = kart.contains(document.activeElement);
    kart.hidden = true;
    seciliOge?.classList.remove("secili");
    seciliOge = null;
    if (odakKartta) (sonListeDugmesi?.isConnected ? sonListeDugmesi : $("#kh-liste-dugme")).focus({ preventScroll: true });
  }
  $("#kh-kapat").addEventListener("click", kartKapat);

  // Liste: haritadaki eserlerin erişilebilir karşılığı (ada göre). Seçilen eserin kartı açılır.
  let sonListeDugmesi = null;
  const listeDugme = $("#kh-liste-dugme"), liste = $("#kh-liste");
  // Masaüstü web'de (≥1100px, Android kabuğu değil) liste haritanın solunda kalıcı paneldir.
  const kaliciPanel = () => document.documentElement.classList.contains("web-sekmeli") && !document.documentElement.classList.contains("kabuk") && matchMedia("(min-width: 1100px)").matches;
  const gorunenEserler = () => eserler.filter((e) => !seciliIl || e.il === seciliIl);
  function listeAc(ac, { odakla = true } = {}) {
    if (!ac && kaliciPanel()) return;
    liste.hidden = !ac;
    listeDugme.setAttribute("aria-expanded", String(ac));
    if (!ac) return;
    if (!liste.childElementCount) {
      liste.append(...gorunenEserler().sort((a, b) => a.ad.localeCompare(b.ad, "tr")).map((e) => {
        const b = el("button", { type: "button" }, el("strong", { textContent: e.ad }), el("span", { textContent: [TUR_ADI[e.tur] ?? "Eser", e.ilce, e.il].filter(Boolean).join(" · ") }));
        b.addEventListener("click", () => { sonListeDugmesi = b; listeAc(false); kartAc(e); $("#kh-kapat").focus({ preventScroll: true }); });
        return el("li", {}, b);
      }));
    }
    if (odakla) liste.querySelector("button")?.focus({ preventScroll: true });
  }
  listeDugme.addEventListener("click", async () => { await hazirla(); listeAc(liste.hidden); });
  liste.addEventListener("keydown", (o) => { if (o.key === "Escape") { o.stopPropagation(); listeAc(false); listeDugme.focus(); } });
  kart.addEventListener("keydown", (o) => { if (o.key === "Escape") { o.stopPropagation(); kartKapat(); } });

  // İl seçimi: işaretler, liste ve görünüm yalnızca o ilin eserlerine iner. Veride tek il varsa da seçici görünür;
  // yeni iller eklendikçe kendiliğinden dolar.
  function ilSeciciKur() {
    const iller = [...new Set(eserler.map((e) => e.il).filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr"));
    if (!iller.length || $("#kh-il")) return;
    const sec = el("select", { id: "kh-il" }, el("option", { value: "", textContent: "Tüm iller" }), ...iller.map((il) => el("option", { value: il, textContent: il })));
    sec.setAttribute("aria-label", "İl seç");
    const kutu = el("label", { className: "kh-arac kh-il" }, sec);
    kutu.insertAdjacentHTML("afterbegin", '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5 9 4.5l6 2 5-2v13l-5 2-6-2-5 2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>');
    sec.addEventListener("change", () => {
      seciliIl = sec.value;
      kartKapat();
      liste.replaceChildren();
      for (const e of eserler) surucu.gorunur(isaretler.get(e.id).m, !seciliIl || e.il === seciliIl);
      surucu.sigdir(gorunenEserler());
      $("#harita-sayi").textContent = `${gorunenEserler().length} eser haritada`;
    });
    $(".kh-araclar")?.prepend(kutu);
  }

  async function kur() {
    const [tum, d] = await Promise.all([
      api("/api/eserler").then((y) => y.json()),
      api("/api/dalislar?ozet=1").then((y) => y.json()).catch(() => []),
    ]);
    eserler = tum.filter((e) => Number.isFinite(Number(e?.konum?.lat)) && Number.isFinite(Number(e?.konum?.lng)));
    dalislar = new Set(d.map((x) => x.eser));
    const secenek = { onBosTik: () => { if (!kart.hidden) kartKapat(); } };
    if (webglVar()) {
      try { surucu = await maplibreSurucusu(kap, secenek); } catch (h) {
        console.warn("3B harita açılamadı, düz haritaya geçiliyor:", h.message);
        kap.replaceChildren();
        for (const ad of [...kap.classList]) if (ad.startsWith("maplibregl")) kap.classList.remove(ad);
      }
    }
    surucu ??= await leafletSurucusu(kap, secenek);
    kap.dataset.surucu = surucu.tur;
    for (const e of eserler) isaretOlustur(e);
    ilSeciciKur();
    // Eserlerin çoğu Bursa'nın tarihî merkezinde: ilk görünüm orası; başka bir il seçilince oraya sığdırılır.
    const merkez = eserler.filter((e) => e.il === "Bursa" && ["Osmangazi", "Yıldırım"].includes(e.ilce));
    if (merkez.length > 5) surucu.merkezeGit(); else surucu.sigdir(eserler);
    $("#harita-sayi").textContent = `${eserler.length} eser haritada`;
  }
  const hazirla = () => (kuruldu ??= kur().catch((h) => { kuruldu = null; kap.replaceChildren(el("p", { className: "bos", textContent: `Harita açılamadı: ${h.message}` })); }));

  // Yakınımdaki eserler: konum yalnızca burada sorulur; en yakın 8 eser görünecek biçimde yakınlaşır.
  $("#kh-yakin").addEventListener("click", async () => {
    await hazirla();
    if (!surucu || !navigator.geolocation) return bildir("Bu cihazda konum kullanılamıyor.");
    navigator.geolocation.getCurrentPosition(async (p) => {
      const k = [p.coords.latitude, p.coords.longitude];
      surucu.konum(k);
      try {
        const yakin = await (await api(`/api/eserler/yakin?lat=${k[0]}&lng=${k[1]}&limit=8`)).json();
        surucu.sigdir([{ konum: { lat: k[0], lng: k[1] } }, ...yakin.filter((e) => e.konum)]);
        if (yakin[0]) bildir(`En yakın eser: ${yakin[0].ad}${yakin[0].mesafe_m != null ? ` (${Math.round(yakin[0].mesafe_m)} m)` : ""}`);
      } catch { surucu.sigdir([{ konum: { lat: k[0], lng: k[1] } }]); }
    }, () => bildir("Konum alınamadı. İzin vermediysen Ayarlar'dan açabilirsin."), { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 });
  });

  return {
    // Görünür olunca kurulur; sekme değişiminde boyutunu yeniden hesaplar (gizliyken harita ölçemez).
    goster() {
      hazirla().then(() => {
        if (kaliciPanel()) listeAc(true, { odakla: false });
        setTimeout(() => surucu?.boyutla(), 60);
      });
    },
    kartKapat,
  };
}
