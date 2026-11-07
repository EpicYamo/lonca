// Studio yerleşimi: tema, atölye görünüm seçici, boyutlanan paneller, önizleme ölçeği.
// Yalnızca arayüz düzenini yönetir; iş mantığı studio.js'tedir.
const $ = (s) => document.querySelector(s);
const oku = (a, v) => { try { return localStorage.getItem(a) ?? v; } catch { return v; } };
const yaz = (a, v) => { try { localStorage.setItem(a, v); } catch {} };

// ---------- Tema: açık (varsayılan) / koyu ----------
const TEMA = "lonca.studio.tema";
function temaUygula(t) {
  const koyu = t === "koyu";
  if (koyu) document.documentElement.dataset.tema = "koyu"; else delete document.documentElement.dataset.tema;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", koyu ? "#0a0a0b" : "#f4f5f7");
  const d = $("#tema-d");
  d.setAttribute("aria-label", koyu ? "Açık temaya geç" : "Koyu temaya geç");
  d.title = koyu ? "Açık tema" : "Koyu tema";
}
temaUygula(oku(TEMA, "acik"));
$("#tema-d").addEventListener("click", () => {
  const yeni = document.documentElement.dataset.tema === "koyu" ? "acik" : "koyu";
  yaz(TEMA, yeni);
  temaUygula(yeni);
});

// ---------- Bağlam (üst çubukta açık sayfa) ----------
const SAYFA_ADI = { atolye: "Atölye", moduller: "Modüller", icerik: "İçerik" };
new MutationObserver(() => {
  const s = document.querySelector(".sekme-d.secili")?.dataset.sayfa;
  if (s) $("#baglam-ad").textContent = SAYFA_ADI[s];
}).observe($(".sekmeler"), { subtree: true, attributes: true, attributeFilter: ["class"] });

// ---------- Atölye görünümü (tablet/telefon) ----------
const tezgah = $("#sayfa-atolye");
const sekmeler = [...document.querySelectorAll(".gorunum-sec [role=tab]")];
const telefonMu = matchMedia("(max-width: 767px)");
const tekSutunMu = matchMedia("(max-width: 1199px)");

function gorunumSec(g, { odak = false } = {}) {
  if (!telefonMu.matches && g === "kalfa") g = tezgah.dataset.gorunum === "onizleme" ? "onizleme" : "kod";
  tezgah.dataset.gorunum = g;
  for (const b of sekmeler) {
    const secili = b.dataset.gorunum === g;
    b.setAttribute("aria-selected", String(secili));
    b.tabIndex = secili ? 0 : -1;
    if (secili) { b.classList.remove("yeni"); if (odak) b.focus(); }
  }
  olcekle();
}
sekmeler.forEach((b) => b.addEventListener("click", () => gorunumSec(b.dataset.gorunum)));
$(".gorunum-sec").addEventListener("keydown", (e) => {
  if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
  const gorunen = sekmeler.filter((b) => getComputedStyle(b).display !== "none");
  const i = gorunen.findIndex((b) => b.getAttribute("aria-selected") === "true");
  const j = (i + (e.key === "ArrowRight" ? 1 : -1) + gorunen.length) % gorunen.length;
  gorunumSec(gorunen[j].dataset.gorunum, { odak: true });
});
const paneGorunur = (ad) => !tekSutunMu.matches || tezgah.dataset.gorunum === ad || (ad === "kalfa" && !telefonMu.matches);
function isaretle(ad) {
  if (paneGorunur(ad)) return;
  sekmeler.find((b) => b.dataset.gorunum === ad)?.classList.add("yeni");
}
// Kalfa kod yazınca Kod sekmesine, önizleme yenilenince Önizleme sekmesine işaret koy.
new MutationObserver(() => { if ($("#editor").classList.contains("yaziliyor")) isaretle("kod"); })
  .observe($("#editor"), { attributes: true, attributeFilter: ["class"] });
new MutationObserver(() => { if ($(".telefon").classList.contains("parla")) isaretle("onizleme"); })
  .observe($(".telefon"), { attributes: true, attributeFilter: ["class"] });
new MutationObserver(() => isaretle("kalfa")).observe($("#mesajlar"), { childList: true });
telefonMu.addEventListener("change", () => gorunumSec(tezgah.dataset.gorunum));
gorunumSec(telefonMu.matches ? "kalfa" : "kod");
if (telefonMu.matches) $("#bilgi-kutu").open = false;

// ---------- Boyutlanan paneller (masaüstü) ----------
const SINIR = { sol: [280, 640], sag: [320, 640] };
const BOYUT = "lonca.studio.paneller";
let boyut = {};
try { boyut = JSON.parse(oku(BOYUT, "{}")) ?? {}; } catch {}
const boyutUygula = () => {
  for (const [ad, px] of Object.entries(boyut)) tezgah.style.setProperty(`--${ad}`, `${px}px`);
  olcekle();
};
boyutUygula();
for (const a of document.querySelectorAll(".ayirici")) {
  const ad = a.dataset.ayir;
  const sayi = () => (ad === "sol" ? $(".sohbet") : $(".onizleme")).getBoundingClientRect().width;
  const ayarla = (px) => {
    const [en, ust] = SINIR[ad];
    boyut[ad] = Math.round(Math.min(ust, Math.max(en, px)));
    a.setAttribute("aria-valuenow", String(boyut[ad]));
    boyutUygula();
  };
  a.setAttribute("aria-valuemin", String(SINIR[ad][0]));
  a.setAttribute("aria-valuemax", String(SINIR[ad][1]));
  a.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    a.setPointerCapture(e.pointerId);
    const x0 = e.clientX, w0 = sayi();
    a.classList.add("suruklen"); document.body.classList.add("surukleniyor");
    const hareket = (h) => ayarla(w0 + (ad === "sol" ? h.clientX - x0 : x0 - h.clientX));
    const bitir = () => {
      a.removeEventListener("pointermove", hareket);
      a.classList.remove("suruklen"); document.body.classList.remove("surukleniyor");
      yaz(BOYUT, JSON.stringify(boyut));
    };
    a.addEventListener("pointermove", hareket);
    a.addEventListener("pointerup", bitir, { once: true });
    a.addEventListener("pointercancel", bitir, { once: true });
  });
  a.addEventListener("dblclick", () => { delete boyut[ad]; tezgah.style.removeProperty(`--${ad}`); yaz(BOYUT, JSON.stringify(boyut)); olcekle(); });
  a.addEventListener("keydown", (e) => {
    if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
    e.preventDefault();
    const yon = (e.key === "ArrowRight" ? 1 : -1) * (ad === "sol" ? 1 : -1);
    ayarla(sayi() + yon * (e.shiftKey ? 64 : 16));
    yaz(BOYUT, JSON.stringify(boyut));
  });
}

// ---------- Önizleme telefonu panele sığsın ----------
function olcekle() {
  const sahne = $("#sahne"), tel = $(".telefon");
  if (telefonMu.matches) { tel.style.removeProperty("--olcek"); return; }
  const { width, height } = sahne.getBoundingClientRect();
  if (!width || !height) return;
  const olcek = Math.min(1, (width - 24) / tel.offsetWidth, (height - 28) / tel.offsetHeight);
  tel.style.setProperty("--olcek", String(Math.max(.4, olcek)));
}
new ResizeObserver(olcekle).observe($("#sahne"));
$("#onizleme-yenile").addEventListener("click", () => $("#onizle").click());

// ---------- İçerik: dar ekranda seçilen eserin formuna kaydır ----------
new MutationObserver(() => {
  const f = $("#eser-formu");
  if (!f.hidden && matchMedia("(max-width: 960px)").matches) f.scrollIntoView({ behavior: "smooth", block: "start" });
}).observe($("#eser-formu"), { attributes: true, attributeFilter: ["hidden"] });
