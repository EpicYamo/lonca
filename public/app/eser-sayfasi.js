// Eser sayfası (#eser-penceresi): fotoğraflar + tam ekran galeri, TR/EN metin, mini harita ve "yaklaşık konum" notu,
// kaynaklı tarihsel bağlar ve yakındaki eserler, "Dalışı var" rozeti, paylaş.
import { TUR_ADI } from "./ekranlar.js";
import { leafletYukle, karoKatmani, bagTuruAdi } from "./harita.js";
import { ciniArkaPlan } from "/ortak/cini.js";
import { dilAl } from "/ortak/dil.js";

const $ = (s) => document.querySelector(s);
const yuzyilYazi = (y) => (y ? `${y}. yüzyıl` : null);
const ENG_YUZYIL = (y) => (y ? `${y}${[null, "st", "nd", "rd"][y % 10 > 3 || Math.floor(y / 10) === 1 ? 0 : y % 10] ?? "th"} century` : null);

export function eserSayfasiKur({ el, api, seslendir, bildir, katkiAc, hataYazisi, dalisModulu, modulAc }) {
  const d = $("#eser-penceresi");
  let eser = null, dil = "tr", harita = null, istekNo = 0;

  // ---------- Dalış rozeti için hangi eserlerin dalışı var (bir kez çekilir) ----------
  let dalislar = null;
  const dalisVarMi = async (id) => {
    dalislar ??= api("/api/dalislar?ozet=1").then((y) => y.json()).then((l) => new Set(l.map((x) => x.eser))).catch(() => new Set());
    return (await dalislar).has(id);
  };

  // ---------- Tam ekran galeri ----------
  const g = $("#galeri"), gIzgara = $("#galeri-seridi");
  let gIndeks = 0;
  const gSayac = () => {
    const n = gIzgara.children.length;
    $("#galeri-sayac").textContent = n ? `${gIndeks + 1} / ${n}` : "";
    $("#galeri-onceki").disabled = gIndeks <= 0;
    $("#galeri-sonraki").disabled = gIndeks >= n - 1;
  };
  const gGit = (i, yumusak = true) => {
    const n = gIzgara.children.length;
    gIndeks = Math.max(0, Math.min(n - 1, i));
    gIzgara.scrollTo({ left: gIndeks * gIzgara.clientWidth, behavior: yumusak && !document.documentElement.classList.contains("hareket-az") ? "smooth" : "auto" });
    gSayac();
  };
  function galeriAc(i) {
    const fotolar = eser?.fotograflar ?? [];
    if (!fotolar.length) return;
    gIzgara.replaceChildren(...fotolar.map((f, j) => el("figure", {}, el("img", { src: f, alt: `${eser.ad}, fotoğraf ${j + 1}`, loading: j === i ? "eager" : "lazy" }))));
    $("#galeri-baslik").textContent = eser.ad;
    g.showModal();
    requestAnimationFrame(() => gGit(i, false));
  }
  let kaydirZaman = null;
  gIzgara.addEventListener("scroll", () => {
    clearTimeout(kaydirZaman);
    kaydirZaman = setTimeout(() => { gIndeks = Math.round(gIzgara.scrollLeft / Math.max(1, gIzgara.clientWidth)); gSayac(); }, 80);
  });
  $("#galeri-onceki").addEventListener("click", () => gGit(gIndeks - 1));
  $("#galeri-sonraki").addEventListener("click", () => gGit(gIndeks + 1));
  $("#galeri-kapat").addEventListener("click", () => g.close());
  g.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); gGit(gIndeks - 1); }
    if (e.key === "ArrowRight") { e.preventDefault(); gGit(gIndeks + 1); }
  });
  g.addEventListener("close", () => { gIzgara.replaceChildren(); $(".ep-foto-dugme")?.focus?.(); });

  // ---------- Metin dili ----------
  function metniCiz() {
    if (!eser) return;
    const en = dil === "en" && eser.tarihce?.en;
    $("#ep-ad").textContent = en ? eser.ad_en || eser.ad : eser.ad;
    const govde = $("#ep-tarihce");
    govde.lang = en ? "en" : "tr";
    govde.replaceChildren(...String((en ? eser.tarihce.en : eser.tarihce?.tr) ?? "").split(/\n+/).filter(Boolean).map((p) => el("p", { textContent: p })));
    $("#ep-ust").textContent = en
      ? [TUR_ADI[eser.tur] ?? "Eser", ENG_YUZYIL(eser.yuzyil), [eser.ilce, eser.il].filter(Boolean).join(", ")].filter(Boolean).join(" · ")
      : [TUR_ADI[eser.tur] ?? "Eser", yuzyilYazi(eser.yuzyil), [eser.ilce, eser.il].filter(Boolean).join(", ")].filter(Boolean).join(" · ");
    for (const b of document.querySelectorAll("#ep-dil button")) b.setAttribute("aria-pressed", String(b.dataset.dil === (en ? "en" : "tr")));
  }
  for (const b of document.querySelectorAll("#ep-dil button")) b.addEventListener("click", () => { dil = b.dataset.dil; metniCiz(); });

  // ---------- Mini harita ----------
  async function haritaCiz(e, bu) {
    harita?.remove(); harita = null;
    const bolum = $("#ep-konum"), kutu = $("#ep-harita");
    const k = e.konum;
    const var_ = k && Number.isFinite(Number(k.lat)) && Number.isFinite(Number(k.lng));
    bolum.hidden = !var_ && !e.adres;
    $("#ep-adres").textContent = e.adres ?? "";
    $("#ep-adres").hidden = !e.adres;
    $("#ep-konum-notu").hidden = !k?.yaklasik;
    kutu.hidden = !var_;
    $("#ep-yol").hidden = !var_;
    if (!var_) return;
    $("#ep-yol").href = `https://www.google.com/maps/search/?api=1&query=${Number(k.lat)},${Number(k.lng)}`;
    try {
      const L = await leafletYukle();
      if (bu !== istekNo || !d.open) return;
      kutu.replaceChildren();
      const h = L.map(kutu, { zoomControl: false, scrollWheelZoom: false, attributionControl: true, zoomAnimation: false });
      harita = h;
      const karo = await karoKatmani(L);
      if (harita !== h) return;
      kutu.classList.toggle("harita-koyu-tema", !!karo._koyu && document.documentElement.dataset.tema === "koyu");
      karo.addTo(h);
      const nokta = [Number(k.lat), Number(k.lng)];
      h.setView(nokta, k.yaklasik ? 15 : 17);
      if (k.yaklasik) L.circle(nokta, { radius: 180, color: "#0b7a66", weight: 2, dashArray: "6 6", fillOpacity: 0.08 }).addTo(h);
      L.circleMarker(nokta, { radius: 8, color: "#fff", weight: 3, fillColor: "#0b7a66", fillOpacity: 1 }).addTo(h);
      requestAnimationFrame(() => h.invalidateSize());
    } catch { kutu.hidden = true; }
  }

  // ---------- İlişkili eserler ----------
  function iliskiKarti(x, etiket) {
    const foto = el("span", { className: "ep-ilgili-foto", ariaHidden: "true" });
    foto.style.backgroundImage = x.fotograflar?.[0] ? `url("${x.fotograflar[0]}")` : ciniArkaPlan(x.id, "firuze");
    const b = el("button", { type: "button", className: "ep-ilgili-kart" }, foto,
      el("span", { className: "ep-ilgili-metin" }, el("span", { className: "ep-ilgili-etiket", textContent: etiket }), el("strong", { textContent: x.ad })));
    b.addEventListener("click", () => ac(x.id));
    return el("li", {}, b);
  }
  async function ilgilileriCiz(e, bu) {
    const ul = $("#ep-ilgili"), bolum = $("#ep-ilgili-bolum");
    ul.replaceChildren(); bolum.hidden = true;
    const [baglar, yakin] = await Promise.all([
      api(`/api/eser-iliskileri?eser=${encodeURIComponent(e.id)}`).then((y) => y.json()).catch(() => []),
      e.konum ? api(`/api/eserler/yakin?lat=${e.konum.lat}&lng=${e.konum.lng}&limit=5`).then((y) => y.json()).catch(() => []) : [],
    ]);
    if (bu !== istekNo) return;
    const gorulen = new Set([e.id]), kartlar = [];
    for (const b of baglar) {
      if (!b.diger || gorulen.has(b.diger.id)) continue;
      gorulen.add(b.diger.id);
      kartlar.push(iliskiKarti(b.diger, b.baslik || bagTuruAdi(b.tur)));
    }
    for (const y of yakin) {
      if (gorulen.has(y.id) || kartlar.length >= 8) continue;
      gorulen.add(y.id);
      kartlar.push(iliskiKarti(y, y.mesafe_m < 1000 ? `${Math.round(y.mesafe_m / 10) * 10} m yakında` : `${(y.mesafe_m / 1000).toFixed(1).replace(".", ",")} km yakında`));
    }
    ul.replaceChildren(...kartlar);
    bolum.hidden = !kartlar.length;
  }

  // ---------- Paylaş ----------
  $("#ep-paylas").addEventListener("click", async () => {
    if (!eser) return;
    const ilk = String(eser.tarihce?.tr ?? "").split(/\n+/).find((p) => p.length > 40) ?? "";
    const ozet = ilk.length > 300 ? `${ilk.slice(0, 300).replace(/\s+\S*$/, "")}…` : ilk;
    const native = window.Capacitor?.isNativePlatform?.() && window.Capacitor.Plugins?.Share;
    const url = native ? undefined : `${location.origin}/app/?eser=${encodeURIComponent(eser.id)}`;
    const metin = [eser.ad, $("#ep-ust").textContent, ozet, "Lonca ile keşfet: vakıf eserleri."].filter(Boolean).join("\n\n");
    try {
      if (native) return await window.Capacitor.Plugins.Share.share({ title: eser.ad, text: metin, dialogTitle: "Eseri paylaş" });
      if (navigator.share) return await navigator.share({ title: eser.ad, text: metin, url });
      await navigator.clipboard.writeText(`${eser.ad}\n${url}`);
      bildir("Bağlantı panoya kopyalandı.");
    } catch (h) { if (h?.name !== "AbortError") bildir("Paylaşılamadı; bağlantıyı adres çubuğundan kopyalayabilirsin."); }
  });

  // ---------- Aç ----------
  async function ac(id) {
    const bu = ++istekNo;
    let e;
    try { e = await (await api(`/api/eserler/${encodeURIComponent(id)}`)).json(); } catch { bildir("Eser açılamadı."); return; }
    if (bu !== istekNo) return;
    eser = e;
    const fotolar = e.fotograflar ?? [];
    $("#ep-fotolar").replaceChildren(...fotolar.map((f, i) => {
      const b = el("button", { type: "button", className: "ep-foto-dugme", ariaLabel: `${e.ad}, fotoğraf ${i + 1}. Tam ekran aç` },
        el("img", { src: f, alt: "", loading: i ? "lazy" : "eager" }));
      b.addEventListener("click", () => galeriAc(i));
      return b;
    }));
    $("#ep-fotolar").hidden = !fotolar.length;
    $("#ep-foto-sayi").hidden = fotolar.length < 1;
    $("#ep-foto-sayi").textContent = `${fotolar.length} fotoğraf · tam ekran`;
    $("#ep-dil").hidden = !e.tarihce?.en;
    // Arayüz İngilizceyse eserin İngilizce metni (varsa) öne gelir.
    dil = e.tarihce?.en && dilAl() === "en" ? "en" : "tr";
    metniCiz();
    $("#ep-kaynak").textContent = `Kaynak: ${e.kaynak}`;
    if (hataYazisi) $("#ep-hata").textContent = hataYazisi;
    $("#ep-hata").onclick = () => { d.close(); katkiAc(e); };

    const rozetler = $("#ep-rozetler");
    rozetler.replaceChildren();
    d.scrollTop = 0;
    if (!d.open) d.showModal();
    seslendir(`${e.ad}. ${$("#ep-ust").textContent}`);
    haritaCiz(e, bu);
    ilgilileriCiz(e, bu);
    if (await dalisVarMi(e.id) && bu === istekNo) {
      const m = dalisModulu();
      const rozet = el("span", { className: "ep-rozet dalis", textContent: "Dalışı var" });
      rozetler.append(rozet);
      if (m) {
        const git = el("button", { type: "button", className: "ep-rozet-dugme", textContent: `${m.ad} ile içine gir →` });
        git.addEventListener("click", () => { d.close(); modulAc(m); });
        rozetler.append(git);
      }
    }
  }

  for (const s of ["#ep-kapat", "#ep-x"]) $(s).addEventListener("click", () => d.close());
  d.addEventListener("click", (e) => { if (e.target === e.currentTarget) d.close(); });
  d.addEventListener("close", () => { istekNo++; harita?.remove(); harita = null; eser = null; });

  return { ac };
}
