
export const hareketAzalt = () => matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("hareket-az");

const YILDIZ = "polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)";
const SEKIZ = "polygon(50% 0,62% 21%,85% 15%,79% 38%,100% 50%,79% 62%,85% 85%,62% 79%,50% 100%,38% 79%,15% 85%,21% 62%,0 50%,21% 38%,15% 15%,38% 21%)";
const RENKLER = ["#1f3a93", "#2bb3ad", "#c0352b", "#e6c477", "#b0832a"];

function katman() {
  let k = document.getElementById("animasyon-katmani");
  if (!k) {
    k = Object.assign(document.createElement("div"), { id: "animasyon-katmani", ariaHidden: "true" });
    k.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2000;overflow:hidden";
    document.body.append(k);
  }
  return k;
}

function parcacik(boyut, renk, sekil) {
  const p = document.createElement("span");
  p.style.cssText = `position:absolute;width:${boyut}px;height:${boyut}px;background:${renk};clip-path:${sekil};will-change:transform,opacity`;
  return p;
}

export function yildizSac(oge, adet = 16) {
  if (hareketAzalt() || !oge?.getBoundingClientRect) return;
  const r = oge.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const k = katman();
  for (let i = 0; i < adet; i++) {
    const boyut = 8 + Math.random() * 10;
    const p = parcacik(boyut, RENKLER[i % RENKLER.length], i % 2 ? YILDIZ : SEKIZ);
    p.style.left = `${cx - boyut / 2}px`;
    p.style.top = `${cy - boyut / 2}px`;
    k.append(p);
    const aci = (Math.PI * 2 * i) / adet + Math.random() * 0.4;
    const mesafe = 60 + Math.random() * 90;
    p.animate([
      { transform: "translate(0,0) scale(.3) rotate(0deg)", opacity: 1 },
      { transform: `translate(${Math.cos(aci) * mesafe}px, ${Math.sin(aci) * mesafe}px) scale(1) rotate(${180 + Math.random() * 180}deg)`, opacity: 0 },
    ], { duration: 700 + Math.random() * 300, easing: "cubic-bezier(.15,.7,.3,1)" }).finished.then(() => p.remove());
  }
}

export function konfeti(adet = 70) {
  if (hareketAzalt()) return;
  const k = katman();
  const genislik = innerWidth;
  for (let i = 0; i < adet; i++) {
    const boyut = 9 + Math.random() * 12;
    const p = parcacik(boyut, RENKLER[i % RENKLER.length], i % 3 ? SEKIZ : YILDIZ);
    p.style.left = `${Math.random() * genislik}px`;
    p.style.top = `${-30 - Math.random() * 120}px`;
    k.append(p);
    const kayma = (Math.random() - 0.5) * 160;
    p.animate([
      { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
      { transform: `translate(${kayma}px, ${innerHeight + 200}px) rotate(${360 + Math.random() * 540}deg)`, opacity: 0.9 },
    ], { duration: 2200 + Math.random() * 1400, delay: Math.random() * 500, easing: "cubic-bezier(.3,.1,.5,1)" }).finished.then(() => p.remove());
  }
}

export function ciz(svg, { sure = 900, aralik = 70, gecikme = 0 } = {}) {
  if (hareketAzalt() || !svg) return;
  const parcalar = svg.querySelectorAll("path, circle, rect, polygon, line");
  parcalar.forEach((p, i) => {
    if (typeof p.getTotalLength !== "function") return;
    let uzunluk;
    try { uzunluk = p.getTotalLength(); } catch { return; }
    if (!uzunluk) return;
    const dolgu = p.getAttribute("fill");
    p.style.strokeDasharray = `${uzunluk}`;
    p.animate([
      { strokeDashoffset: uzunluk, fillOpacity: dolgu && dolgu !== "none" ? 0 : 1 },
      { strokeDashoffset: 0, fillOpacity: 1 },
    ], { duration: sure, delay: gecikme + i * aralik, easing: "ease-in-out", fill: "both" })
      .finished.then(() => { p.style.strokeDasharray = ""; }).catch(() => {});
  });
}

export function say(oge, hedef, sure = 1200) {
  if (hareketAzalt() || !hedef) { oge.textContent = String(hedef); return; }
  const bas = performance.now();
  const adim = (t) => {
    const o = Math.min(1, (t - bas) / sure);
    oge.textContent = String(Math.round(hedef * (1 - Math.pow(1 - o, 3))));
    if (o < 1) requestAnimationFrame(adim);
  };
  requestAnimationFrame(adim);
}

export function baglaninca(oge) {
  return new Promise((coz) => {
    const bak = () => (oge.isConnected ? requestAnimationFrame(() => coz()) : requestAnimationFrame(bak));
    bak();
  });
}

export function gecis(degistir, tur) {
  if (hareketAzalt() || !document.startViewTransition) { degistir(); return null; }
  if (tur) document.documentElement.dataset.gecis = tur;
  const g = document.startViewTransition(degistir);
  // Art arda geçişte önceki geçiş atlanır ("Transition was skipped"): bu beklenen bir durumdur, hata olarak düşmesin.
  g.ready.catch(() => {});
  g.finished.catch(() => {}).finally(() => { delete document.documentElement.dataset.gecis; });
  return g;
}
