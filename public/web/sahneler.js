// Web sitesinin modül vitrini: her modül kendi sahnesiyle tanıtılır (renk, düzen ve görsel dil modüle özgü).
// Bilinen modüllere elle tasarlanmış sahne, Kalfa ile sonradan eklenenlere modülün renginden ve çinisinden üretilen sahne.
// Görseller oranı bozulmadan kullanılır: çerçeveler sabit oranlıdır, fotoğraf object-fit: cover ile kırpılır, uzatılmaz.
import { RENKLER, renkSec, ciniArkaPlan } from "/ortak/cini.js";

export const el = (etiket, ozellik = {}, ...cocuklar) => {
  const o = document.createElement(etiket);
  for (const [k, v] of Object.entries(ozellik)) {
    if (v == null || v === false) continue;
    if (k === "sinif") o.className = v;
    else if (k === "stil") o.style.cssText = v;
    else if (k === "metin") o.textContent = v;
    else if (k === "html") o.innerHTML = v;
    else if (k.startsWith("on")) o.addEventListener(k.slice(2), v);
    else o.setAttribute(k, v === true ? "" : v);
  }
  for (const c of cocuklar.flat()) if (c != null && c !== false) o.append(c);
  return o;
};

const svg = (icerik, ozellik = "") => {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.innerHTML = icerik;
  for (const [k, v] of ozellik ? Object.entries(ozellik) : []) s.setAttribute(k, v);
  return s;
};

// Fotoğraf çerçevesi: oran CSS'te (--oran), görsel kırpılır ama esnetilmez.
export const foto = (src, alt = "", oran = "4 / 3", sinif = "") =>
  el("figure", { sinif: `cerceve ${sinif}`, stil: `--oran:${oran}` },
    el("img", { src, alt, loading: "lazy", decoding: "async", onload: (e) => e.target.closest("figure")?.classList.add("yuklendi") }));

// Modül temaları: açık ve koyu temada zemin/yazı/vurgu. Modül kartları da aynı renkleri kullanır.
export const TEMALAR = {
  "bursa-pusulasi": { zemin: "#efe2c4", metin: "#2a1f0c", vurgu: "#8a6420", koyuZemin: "#221a0d", koyuMetin: "#f5e8cb", koyuVurgu: "#e6c477" },
  "payitaht-atlasi": { zemin: "#0e1a3a", metin: "#f3efe4", vurgu: "#e6c477", koyuZemin: "#0a1430", koyuMetin: "#f3efe4", koyuVurgu: "#e6c477" },
  "sisli-vakif-haritasi": { zemin: "#0a1817", metin: "#e6f2f0", vurgu: "#4fd1c5", koyuZemin: "#071211", koyuMetin: "#e6f2f0", koyuVurgu: "#4fd1c5" },
  "vakif-dalislari": { zemin: "#07080b", metin: "#f4f1ea", vurgu: "#e6c477", koyuZemin: "#050608", koyuMetin: "#f4f1ea", koyuVurgu: "#e6c477" },
  "eser-kesfi": { zemin: "#dcecea", metin: "#0c3332", vurgu: "#157f7d", koyuZemin: "#0d2423", koyuMetin: "#dcf0ee", koyuVurgu: "#4fd1c5" },
};
export function temaAl(m) {
  if (TEMALAR[m.id]) return TEMALAR[m.id];
  const r = RENKLER[renkSec(m.id, m.renk)];
  return { zemin: r.zemin, metin: "#fbf8f1", vurgu: r.vurgu, koyuZemin: r.zemin, koyuMetin: "#fbf8f1", koyuVurgu: r.vurgu, cini: true };
}

const KATEGORI = { rehber: "Rehber", gezi: "Gezi", oyun: "Oyun", harita: "Harita", egitim: "Eğitim" };
export const kategoriAdi = (k) => KATEGORI[k] ?? "Modül";

// Fotoğraflı eserlerden belirli bir sırayla seçim (aynı modül hep aynı fotoğrafları gösterir).
function sec(eserler, adet, tohum = 0, suz = () => true) {
  const havuz = eserler.filter((e) => e.fotograflar?.length && suz(e));
  const sonuc = [];
  for (let i = 0; i < havuz.length && sonuc.length < adet; i++) {
    const e = havuz[(tohum * 7 + i * 11) % havuz.length];
    if (!sonuc.includes(e)) sonuc.push(e);
  }
  return sonuc;
}

const etiketli = (e, oran, sinif) => {
  const f = foto(e.fotograflar[0], e.ad, oran, sinif);
  f.append(el("figcaption", { metin: e.ad }));
  return f;
};

// ---------- Bursa Pusulası: kum rengi zemin, dönen pusula gülü, dört yönde eserler ----------
function pusula({ eserler }) {
  const gul = svg(`
    <circle cx="200" cy="200" r="188" fill="none" stroke="currentColor" stroke-opacity=".25"/>
    <circle cx="200" cy="200" r="150" fill="none" stroke="currentColor" stroke-opacity=".35" stroke-dasharray="2 6"/>
    <circle cx="200" cy="200" r="96" fill="none" stroke="currentColor" stroke-opacity=".3"/>
    ${Array.from({ length: 72 }, (_, i) => `<line x1="200" y1="${i % 6 ? 16 : 8}" x2="200" y2="26" stroke="currentColor" stroke-opacity=".45" transform="rotate(${i * 5} 200 200)"/>`).join("")}
    <polygon points="200,40 216,200 200,360 184,200" fill="currentColor" fill-opacity=".18"/>
    <polygon points="40,200 200,184 360,200 200,216" fill="currentColor" fill-opacity=".12"/>
    <polygon points="200,40 216,200 200,200" fill="var(--s-vurgu)"/>
    <polygon points="200,40 184,200 200,200" fill="var(--s-vurgu)" fill-opacity=".7"/>
    <circle cx="200" cy="200" r="7" fill="var(--s-vurgu)"/>
    <text x="200" y="66" text-anchor="middle" font-size="18" fill="currentColor" font-family="Young Serif, serif">K</text>`,
  { viewBox: "0 0 400 400", class: "pusula-gul", "aria-hidden": "true" });
  const [a, b, c] = sec(eserler, 3, 2, (e) => ["cami", "turbe", "han", "kulliye"].includes(e.tur));
  return el("div", { sinif: "sahne-gorsel sg-pusula" }, gul,
    a && etiketli(a, "4 / 3", "p-k"), b && etiketli(b, "1 / 1", "p-d"), c && etiketli(c, "3 / 4", "p-gb"));
}

// ---------- Payitaht Atlası: lacivert zemin, kuşbakışı eğik atlas düzlemi ----------
function atlas({ eserler }) {
  const secilen = sec(eserler, 9, 5);
  const duzlem = el("div", { sinif: "atlas-duzlem" }, secilen.map((e) => foto(e.fotograflar[0], "", "1 / 1")));
  return el("div", { sinif: "sahne-gorsel sg-atlas", "aria-hidden": "true" },
    el("div", { sinif: "atlas-ufuk" }, duzlem),
    el("span", { sinif: "atlas-iz" }));
}

// ---------- Sisli Vakıf Atlası: karanlık zemin, gerçek koordinatlardan takımyıldız, kaynaklı bağlar çizgi ----------
function sisli({ eserler, iliskiler }) {
  // Bursa merkezi (ortanca nokta çevresi) çerçevelenir; uzak ilçeler (İznik, İnegöl…) dışarıda kalır.
  const tum = eserler.filter((e) => e.konum?.lat && e.konum?.lng);
  const ortanca = (d) => d.sort((x, y) => x - y)[Math.floor(d.length / 2)] ?? 0;
  const [mLa, mLo] = [ortanca(tum.map((e) => e.konum.lat)), ortanca(tum.map((e) => e.konum.lng))];
  const konumlu = tum.filter((e) => Math.abs(e.konum.lat - mLa) < 0.045 && Math.abs(e.konum.lng - mLo) < 0.075);
  const enler = konumlu.map((e) => e.konum.lat), boylar = konumlu.map((e) => e.konum.lng);
  const [la0, la1, lo0, lo1] = [Math.min(...enler), Math.max(...enler), Math.min(...boylar), Math.max(...boylar)];
  const G = 600, Y = 440;
  const xy = (k) => [40 + ((k.lng - lo0) / (lo1 - lo0 || 1)) * (G - 80), 30 + (1 - (k.lat - la0) / (la1 - la0 || 1)) * (Y - 60)];
  const ici = (p) => p[0] > 0 && p[0] < G && p[1] > 0 && p[1] < Y;
  const yer = new Map(konumlu.map((e) => [e.id, xy(e.konum)]));
  const cizgiler = (iliskiler ?? []).map((i) => [yer.get(i.a), yer.get(i.b)]).filter(([p, q]) => p && q && ici(p) && ici(q))
    .map(([p, q]) => `<line x1="${p[0].toFixed(1)}" y1="${p[1].toFixed(1)}" x2="${q[0].toFixed(1)}" y2="${q[1].toFixed(1)}"/>`).join("");
  const noktalar = [...yer.values()].filter(ici).map(([x, y], i) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${i % 5 ? 2.2 : 3.6}" style="--g:${(i % 9) * 0.35}s"/>`).join("");
  return el("div", { sinif: "sahne-gorsel sg-sisli", "aria-hidden": "true" },
    svg(`<defs><radialGradient id="sis" cx="50%" cy="50%" r="60%"><stop offset="0" stop-color="#4fd1c5" stop-opacity=".22"/><stop offset="1" stop-color="#4fd1c5" stop-opacity="0"/></radialGradient></defs>
      <rect width="${G}" height="${Y}" fill="url(#sis)"/>
      <g class="sis-cizgi" stroke="#4fd1c5" stroke-opacity=".45" stroke-width="1">${cizgiler}</g>
      <g class="sis-nokta" fill="#e6f2f0">${noktalar}</g>`, { viewBox: `0 0 ${G} ${Y}`, preserveAspectRatio: "xMidYMid meet" }),
    el("span", { sinif: "sis-katman s1" }), el("span", { sinif: "sis-katman s2" }));
}

// ---------- Vakıf Dalışları: uydudan içeriye dört kare, derinlik tüneli ----------
function dalis({ dalislar }) {
  const d = dalislar?.[0];
  if (!d) return varsayilan(...arguments);
  const kareler = d.kareler ?? [];
  const sec4 = ["u6", "u12", "u18"].map((g) => kareler.find((k) => k.g === g)).concat(kareler.find((k) => k.k?.length)).filter(Boolean);
  const derinlik = ["Uydu", "Şehir", "Çatı", "İçeride"];
  return el("div", { sinif: "sahne-gorsel sg-dalis", "aria-hidden": "true" },
    sec4.map((k, i) => {
      const f = foto(`/medya/dalis/${d.eser}/${k.g}.jpg`, "", "2 / 3", `d${i}`);
      f.append(el("figcaption", { metin: derinlik[i] }));
      return f;
    }));
}

// ---------- Eser Keşfi: açık firuze zemin, tür etiketli bento ızgara ----------
function kesif({ eserler }) {
  const turler = ["cami", "turbe", "hamam", "han", "medrese"];
  const secilen = turler.map((t, i) => sec(eserler, 1, i + 3, (e) => e.tur === t)[0]).filter(Boolean);
  const ADLAR = { cami: "Cami", turbe: "Türbe", hamam: "Hamam", han: "Han", medrese: "Medrese" };
  return el("div", { sinif: "sahne-gorsel sg-kesif", "aria-hidden": "true" },
    secilen.map((e, i) => {
      const f = foto(e.fotograflar[0], "", "auto", `b${i}`);
      f.append(el("figcaption", { metin: ADLAR[e.tur] }));
      return f;
    }));
}

// ---------- Kalfa ile eklenen modüller: modülün çinisi + kapak fotoğrafı ----------
function varsayilan({ modul, kapak }) {
  return el("div", { sinif: "sahne-gorsel sg-cini" },
    el("div", { sinif: "cini cini-pano", stil: `background-image:${ciniArkaPlan(modul.id, modul.renk)}`, "aria-hidden": "true" }),
    kapak?.foto ? foto(kapak.foto, kapak.eser ?? "", "4 / 3", "cini-foto") : null);
}

const SAHNELER = { "bursa-pusulasi": pusula, "payitaht-atlasi": atlas, "sisli-vakif-haritasi": sisli, "vakif-dalislari": dalis, "eser-kesfi": kesif };

export function sahneGorseli(modul, veri) {
  const ciz = SAHNELER[modul.id] ?? varsayilan;
  try { return ciz({ ...veri, modul, kapak: veri.vitrin?.kapaklar?.[modul.id] }); } catch { return varsayilan({ modul, kapak: veri.vitrin?.kapaklar?.[modul.id] }); }
}

export function temaStili(m) {
  const t = temaAl(m);
  return `--s-zemin:${t.zemin};--s-metin:${t.metin};--s-vurgu:${t.vurgu};--s-koyu-zemin:${t.koyuZemin};--s-koyu-metin:${t.koyuMetin};--s-koyu-vurgu:${t.koyuVurgu}`;
}
