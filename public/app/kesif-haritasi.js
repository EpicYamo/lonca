// Keşfet haritası: konumu bilinen bütün vakıf eserleri haritada işaretli. İşarete dokununca altta eser kartı açılır:
// fotoğraf, tür · yüzyıl · ilçe, tarihçeden kısa not, "Ayrıntılar" (eser sayfası), eserin dalışı ve kapağında
// eserin olduğu modüller. Uygulamada Keşfet sekmesinin kendisi, web'de ana sayfada bir bölüm.
// Konum yalnızca "Yakınımdaki eserler"e basılınca sorulur.
//
// Harita uygulamanın ortak haritasıdır (harita.js haritaAc: MapLibre GL + OpenFreeMap, 3B binalı): tek parmakla
// kaydırma, iki parmakla yakınlaştırma, döndürme ve eğme. Açık temada "liberty", koyu temada "dark" stili.
import { haritaAc, PIN_RENGI } from "./harita.js";

const KISA_NOT = 230;
function kisaNot(metin) {
  const t = String(metin ?? "").replace(/\s+/g, " ").trim();
  if (t.length <= KISA_NOT) return t;
  const kes = t.slice(0, KISA_NOT);
  const nokta = kes.lastIndexOf(". ");
  return nokta > 120 ? kes.slice(0, nokta + 1) : `${kes.replace(/\s+\S*$/, "")}…`;
}

const hareketAz = () => document.documentElement.classList.contains("hareket-az") || matchMedia("(prefers-reduced-motion: reduce)").matches;

// Sürücü: işaret, odak, sığdırma ve konum işlemleri ortak haritanın (harita.js haritaAc) üstünde.
async function haritaSurucusu(kap, { onBosTik }) {
  const harita = await haritaAc(kap, { gomulu: false, merkez: [29.065, 40.1845], zoom: 14.2, pitch: 50, bearing: -12 });
  const ml = window.maplibregl;
  harita.on("click", (o) => { if (!o.originalEvent?.target?.closest?.(".kh-isaret-kap")) onBosTik(); });
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
    // Harita gelene kadar boş alan değil, yükleniyor yazısı görünür.
    const yukleniyor = el("p", { className: "kh-yukleniyor", textContent: "Harita yükleniyor…" });
    kap.parentElement.append(yukleniyor);
    surucu = await haritaSurucusu(kap, secenek);
    kap.dataset.surucu = surucu.tur;
    yukleniyor.remove();
    for (const e of eserler) isaretOlustur(e);
    ilSeciciKur();
    // Eserlerin çoğu Bursa'nın tarihî merkezinde: ilk görünüm orası; başka bir il seçilince oraya sığdırılır.
    const merkez = eserler.filter((e) => e.il === "Bursa" && ["Osmangazi", "Yıldırım"].includes(e.ilce));
    if (merkez.length > 5) surucu.merkezeGit(); else surucu.sigdir(eserler);
    $("#harita-sayi").textContent = `${eserler.length} eser haritada`;
  }
  const hazirla = () => (kuruldu ??= kur().catch((h) => { kuruldu = null; document.querySelector(".kh-yukleniyor")?.remove(); kap.replaceChildren(el("p", { className: "bos", textContent: `Harita açılamadı: ${h.message}` })); }));

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
