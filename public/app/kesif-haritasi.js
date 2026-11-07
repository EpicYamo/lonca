// Keşfet haritası: konumu bilinen bütün vakıf eserleri haritada işaretli. İşarete dokununca altta kısa bir kart açılır:
// fotoğraf, tür · yüzyıl · ilçe, tarihçeden kısa not, "Ayrıntılar" (eser sayfası), eserin dalışı ve kapağında
// eserin olduğu modüller. Uygulamada Keşfet sekmesinin kendisi, web'de ana sayfada bir bölüm.
// Konum yalnızca "Yakınımdaki eserler"e basılınca sorulur.
import { leafletYukle, karoKatmani, PIN_RENGI } from "./harita.js";

const KISA_NOT = 230;
function kisaNot(metin) {
  const t = String(metin ?? "").replace(/\s+/g, " ").trim();
  if (t.length <= KISA_NOT) return t;
  const kes = t.slice(0, KISA_NOT);
  const nokta = kes.lastIndexOf(". ");
  return nokta > 120 ? kes.slice(0, nokta + 1) : `${kes.replace(/\s+\S*$/, "")}…`;
}

export function kesifHaritasiKur({ el, api, TUR_ADI, eserAc, modulAc, moduller, dalisModulu, bildir }) {
  const $ = (s) => document.querySelector(s);
  const kap = $("#kesif-haritasi");
  const kart = $("#kh-kart");
  let kuruldu = null, isaretler = new Map(), harita = null, L = null, eserler = [], dalislar = new Set(), konumIsareti = null, seciliIsaret = null;

  const koyuMu = () => document.documentElement.dataset.tema === "koyu" || document.documentElement.classList.contains("kontrast");
  const temaUygula = () => kap.classList.toggle("harita-koyu-tema", koyuMu());

  function isaret(e) {
    const renk = PIN_RENGI[e.tur] ?? "#0b7a66";
    const ikon = L.divIcon({ className: "kh-isaret-kap", html: `<span class="kh-isaret" style="--renk:${renk}"></span>`, iconSize: [26, 26], iconAnchor: [13, 13] });
    // İşaretler sık ve üst üste binebilir: dokunmayla seçilir, klavye ve ekran okuyucu için aynı eserler "Liste"de düğme olarak durur.
    const m = L.marker([e.konum.lat, e.konum.lng], { icon: ikon, keyboard: false, title: e.ad, riseOnHover: true });
    m.on("click", () => kartAc(e, m));
    m.on("add", () => m.getElement()?.setAttribute("aria-hidden", "true"));
    isaretler.set(e.id, m);
    return m;
  }

  function kartAc(e, m) {
    seciliIsaret?.getElement()?.classList.remove("secili");
    seciliIsaret = m;
    m?.getElement()?.classList.add("secili");
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
    kart.hidden = false;
    if (harita.getZoom() < 15) harita.setView([e.konum.lat, e.konum.lng], 15, { animate: false });
    else harita.panTo([e.konum.lat, e.konum.lng], { animate: !document.documentElement.classList.contains("hareket-az") });
  }
  function kartKapat() {
    const odakKartta = kart.contains(document.activeElement);
    kart.hidden = true;
    seciliIsaret?.getElement()?.classList.remove("secili");
    seciliIsaret = null;
    if (odakKartta) (sonListeDugmesi?.isConnected ? sonListeDugmesi : $("#kh-liste-dugme")).focus({ preventScroll: true });
  }
  $("#kh-kapat").addEventListener("click", kartKapat);

  // Liste: haritadaki eserlerin erişilebilir karşılığı (ada göre). Seçilen eserin kartı açılır.
  let sonListeDugmesi = null;
  const listeDugme = $("#kh-liste-dugme"), liste = $("#kh-liste");
  function listeAc(ac) {
    liste.hidden = !ac;
    listeDugme.setAttribute("aria-expanded", String(ac));
    if (!ac) return;
    if (!liste.childElementCount) {
      liste.append(...[...eserler].sort((a, b) => a.ad.localeCompare(b.ad, "tr")).map((e) => {
        const b = el("button", { type: "button" }, el("strong", { textContent: e.ad }), el("span", { textContent: [TUR_ADI[e.tur] ?? "Eser", e.ilce, e.il].filter(Boolean).join(" · ") }));
        b.addEventListener("click", () => { sonListeDugmesi = b; listeAc(false); kartAc(e, isaretler.get(e.id)); $("#kh-kapat").focus({ preventScroll: true }); });
        return el("li", {}, b);
      }));
    }
    liste.querySelector("button")?.focus({ preventScroll: true });
  }
  listeDugme.addEventListener("click", async () => { await hazirla(); listeAc(liste.hidden); });
  liste.addEventListener("keydown", (o) => { if (o.key === "Escape") { o.stopPropagation(); listeAc(false); listeDugme.focus(); } });
  kart.addEventListener("keydown", (o) => { if (o.key === "Escape") { o.stopPropagation(); kartKapat(); } });

  async function kur() {
    L = await leafletYukle();
    const [liste, d] = await Promise.all([
      api("/api/eserler").then((y) => y.json()),
      api("/api/dalislar?ozet=1").then((y) => y.json()).catch(() => []),
    ]);
    eserler = liste.filter((e) => Number.isFinite(Number(e?.konum?.lat)) && Number.isFinite(Number(e?.konum?.lng)));
    dalislar = new Set(d.map((x) => x.eser));
    harita = L.map(kap, { zoomControl: true, attributionControl: true, scrollWheelZoom: false, tap: true });
    (await karoKatmani(L)).addTo(harita);
    temaUygula();
    new MutationObserver(temaUygula).observe(document.documentElement, { attributes: true, attributeFilter: ["data-tema", "class"] });
    const katman = L.featureGroup(eserler.map(isaret)).addTo(harita);
    // Eserlerin çoğu Bursa'nın tarihî merkezinde: ilk görünüm orası; diğer iller için uzaklaştırmak yeter.
    const merkez = eserler.filter((e) => e.il === "Bursa" && ["Osmangazi", "Yıldırım"].includes(e.ilce));
    if (merkez.length > 5) harita.setView([40.1845, 29.065], 14);
    else harita.fitBounds(katman.getBounds(), { padding: [24, 24], maxZoom: 14 });
    harita.on("click", () => { if (!kart.hidden) kartKapat(); });
    $("#harita-sayi").textContent = `${eserler.length} eser haritada`;
  }
  const hazirla = () => (kuruldu ??= kur().catch((h) => { kuruldu = null; kap.replaceChildren(el("p", { className: "bos", textContent: `Harita açılamadı: ${h.message}` })); }));

  // Yakınımdaki eserler: konum yalnızca burada sorulur; en yakın 8 eser görünecek biçimde yakınlaşır.
  $("#kh-yakin").addEventListener("click", async () => {
    await hazirla();
    if (!harita || !navigator.geolocation) return bildir("Bu cihazda konum kullanılamıyor.");
    navigator.geolocation.getCurrentPosition(async (p) => {
      const k = [p.coords.latitude, p.coords.longitude];
      konumIsareti?.remove();
      konumIsareti = L.circleMarker(k, { radius: 8, color: "#fff", weight: 3, fillColor: "#1a73e8", fillOpacity: 1, interactive: false }).addTo(harita);
      try {
        const yakin = await (await api(`/api/eserler/yakin?lat=${k[0]}&lng=${k[1]}&limit=8`)).json();
        const sinir = L.latLngBounds([k, ...yakin.filter((e) => e.konum).map((e) => [e.konum.lat, e.konum.lng])]);
        harita.fitBounds(sinir, { padding: [40, 40], maxZoom: 16 });
        if (yakin[0]) bildir(`En yakın eser: ${yakin[0].ad}${yakin[0].mesafe_m != null ? ` (${Math.round(yakin[0].mesafe_m)} m)` : ""}`);
      } catch { harita.setView(k, 15); }
    }, () => bildir("Konum alınamadı. İzin vermediysen Ayarlar'dan açabilirsin."), { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 });
  });

  return {
    // Görünür olunca kurulur; sekme değişiminde boyutunu yeniden hesaplar (gizliyken Leaflet ölçemez).
    goster() { hazirla().then(() => setTimeout(() => harita?.invalidateSize(), 60)); },
    kartKapat,
  };
}
