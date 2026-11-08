// Lonca sunumu: sayfa sayfa ilerleyen, her sayfası kendi GSAP zaman çizelgesiyle oynayan sunum motoru.
// Gezinme: → / ← / PageDown / PageUp / boşluk / dokunup kaydırma / ekrandaki düğmeler. F tam ekran, R sayfayı yeniden oynat.
// Sayfa açılınca animasyonu kendiliğinden baştan sona oynar; sayfadan çıkınca gsap.context ile her şey geri alınır.
import { loncaLogo } from "/ortak/logo.js";
import { OZET, NOKTALAR } from "/sunum/veri.js";
import { SAHNELER } from "/sunum/sahneler.js";
import * as uc from "/sunum/uc.js";

const { gsap } = window;
gsap.registerPlugin(window.Flip, window.SplitText, window.MotionPathPlugin, window.DrawSVGPlugin, window.CustomEase);
window.CustomEase.create("sinema", "0.7,0,0.2,1");

const sahne = document.getElementById("sahne");
const sayfalar = [...sahne.querySelectorAll(".sayfa")];
const hareketAz = matchMedia("(prefers-reduced-motion: reduce)").matches;
let sira = -1;
let baglam = null; // etkin sayfanın gsap.context'i
let gecis = null;

// Logo ve QR yerleştir.
for (const yer of document.querySelectorAll("[data-logo]")) yer.innerHTML = loncaLogo({ boyut: Number(yer.dataset.logo) });

// 1920×1080 tuvali ekrana sığdır.
function olcekle() {
  const k = Math.min(innerWidth / 1920, innerHeight / 1080);
  document.documentElement.style.setProperty("--olcek", k);
  uc.boyutla();
}
addEventListener("resize", olcekle);
olcekle();

// Her sayfanın ortak girişi: üst etiket ve başlık kelime kelime yükselir.
function ortakGiris(el, tl) {
  const etiket = el.querySelector(".ust-etiket");
  const baslik = el.querySelector(".baslik");
  if (etiket) tl.from(etiket, { y: 20, opacity: 0, duration: 0.5, ease: "power3.out" }, 0);
  if (baslik) {
    const bol = new window.SplitText(baslik, { type: "words", wordsClass: "kelime" });
    tl.from(bol.words, { yPercent: 110, opacity: 0, rotateX: -50, transformOrigin: "50% 100%", stagger: 0.06, duration: 0.8, ease: "power4.out" }, 0.1);
  }
}

function ac(yeni, yon = 1) {
  yeni = Math.max(0, Math.min(sayfalar.length - 1, yeni));
  if (yeni === sira) return;
  gecis?.progress(1); // önceki geçiş yarım kaldıysa önce bitsin
  const eski = sayfalar[sira];
  const gelen = sayfalar[yeni];
  const eskiBaglam = baglam;
  sira = yeni;
  history.replaceState(null, "", `#${sira + 1}`);
  document.getElementById("gz-sayi").textContent = `${sira + 1} / ${sayfalar.length}`;
  document.getElementById("ilerleme").style.width = `${((sira + 1) / sayfalar.length) * 100}%`;

  gecis = gsap.timeline({ defaults: { ease: "sinema" } });
  if (eski && !hareketAz) {
    gecis.to(eski, { opacity: 0, scale: 0.96, xPercent: -4 * yon, filter: "blur(10px)", duration: 0.55 }, 0);
  }
  gecis.add(() => {
    if (eski) { eski.classList.remove("etkin"); gsap.set(eski, { clearProps: "opacity,transform,filter" }); }
    eskiBaglam?.revert();
    gelen.classList.add("etkin");
    uc.sec(gelen.dataset.uc ?? null, gelen);
    baglam = gsap.context((self) => {
      const tl = gsap.timeline();
      // Zaman çizelgesindeki geri çağrıların oluşturduğu animasyonlar da bu sayfanın bağlamına kaydolsun:
      // sayfadan çıkınca onlar da geri alınır, arka planda oynamaya devam etmez.
      const asilEkle = tl.add.bind(tl);
      tl.add = (oge, konum) => asilEkle(typeof oge === "function" ? () => self.add(oge) : oge, konum);
      ortakGiris(gelen, tl);
      SAHNELER[sira]?.(gelen, tl, { OZET, NOKTALAR, uc });
      if (hareketAz) tl.progress(1);
    }, gelen);
  }, eski && !hareketAz ? 0.45 : 0);
  if (!hareketAz) gecis.fromTo(gelen, { opacity: 0, scale: 1.04, xPercent: 3 * yon }, { opacity: 1, scale: 1, xPercent: 0, duration: 0.75, clearProps: "opacity,transform" }, eski ? 0.45 : 0);
}

const ileri = () => ac(sira + 1, 1);
const geri = () => ac(sira - 1, -1);
function yenidenOynat() { const s = sira; sira = -1; baglam?.revert(); baglam = null; sayfalar[s].classList.remove("etkin"); ac(s, 1); }

addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.key;
  if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"].includes(t)) { e.preventDefault(); ileri(); }
  else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(t)) { e.preventDefault(); geri(); }
  else if (t === "Home") ac(0, -1);
  else if (t === "End") ac(sayfalar.length - 1, 1);
  else if (t === "f" || t === "F") tamEkran();
  else if (t === "r" || t === "R") yenidenOynat();
  gizleIpucu();
});
document.getElementById("ileri").addEventListener("click", ileri);
document.getElementById("geri").addEventListener("click", geri);

// Dokunmatik: yatay ya da dikey kaydırma hareketi sayfa değiştirir (sayfa kendisi kaymaz).
let dokunus = null;
addEventListener("touchstart", (e) => { dokunus = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }, { passive: true });
addEventListener("touchend", (e) => {
  if (!dokunus) return;
  const dx = e.changedTouches[0].clientX - dokunus.x, dy = e.changedTouches[0].clientY - dokunus.y;
  const d = Math.abs(dx) > Math.abs(dy) ? dx : dy;
  if (Math.abs(d) > 50) (d < 0 ? ileri : geri)();
  dokunus = null;
});
// Tekerlek: bir hareket bir sayfa (kaydırma motoru yok).
let tekerKilit = 0;
addEventListener("wheel", (e) => {
  const simdi = Date.now();
  if (simdi < tekerKilit || Math.abs(e.deltaY) < 30) return;
  tekerKilit = simdi + 900;
  (e.deltaY > 0 ? ileri : geri)();
}, { passive: true });

function tamEkran() {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().catch(() => {});
}
document.addEventListener("fullscreenchange", () => document.body.classList.toggle("tam-ekran", !!document.fullscreenElement));
let ipucuZamani = setTimeout(gizleIpucu, 6000);
function gizleIpucu() { clearTimeout(ipucuZamani); document.getElementById("ipucu").classList.add("gizle"); }

addEventListener("hashchange", () => { const n = Number(location.hash.slice(1)) - 1; if (Number.isInteger(n) && n !== sira) ac(n, n > sira ? 1 : -1); });
const bas = Number(location.hash.slice(1)) - 1;
document.fonts.ready.then(() => ac(Number.isInteger(bas) && bas >= 0 ? bas : 0, 1));
