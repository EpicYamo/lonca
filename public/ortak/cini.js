
export const RENKLER = {
  kobalt: { zemin: "#1f3a93", ikinci: "#2bb3ad", cizgi: "#f3f6f8", vurgu: "#e6c477" },
  firuze: { zemin: "#157f7d", ikinci: "#1f3a93", cizgi: "#f3f6f8", vurgu: "#e6c477" },
  mercan: { zemin: "#c0352b", ikinci: "#1f3a93", cizgi: "#f7efe4", vurgu: "#2bb3ad" },
  altin:  { zemin: "#8a6420", ikinci: "#1f3a93", cizgi: "#fbf3df", vurgu: "#2bb3ad" },
  zumrut: { zemin: "#2e7d4f", ikinci: "#c0352b", cizgi: "#f3f6f8", vurgu: "#e6c477" },
  murdum: { zemin: "#5b2a6e", ikinci: "#2bb3ad", cizgi: "#f3f6f8", vurgu: "#e6c477" },
};
const RENK_ADLARI = Object.keys(RENKLER);

function ozet(metin) {
  let h = 2166136261;
  for (const c of String(metin)) h = Math.imul(h ^ c.codePointAt(0), 16777619);
  return h >>> 0;
}

function yildiz(cx, cy, uc, dis, ic, aci = 0) {
  const n = uc * 2;
  const noktalar = [];
  for (let i = 0; i < n; i++) {
    const a = aci + (Math.PI * i) / uc;
    const r = i % 2 ? ic : dis;
    noktalar.push(`${(cx + r * Math.sin(a)).toFixed(2)},${(cy - r * Math.cos(a)).toFixed(2)}`);
  }
  return noktalar.join(" ");
}

export const renkSec = (kimlik, tercih) => (RENKLER[tercih] ? tercih : RENK_ADLARI[ozet(kimlik) % RENK_ADLARI.length]);

export function ciniSvg(kimlik, tercihRenk) {
  const h = ozet(kimlik);
  const r = RENKLER[renkSec(kimlik, tercihRenk)];
  const t = 80;                                  // karo boyu
  const uc = [8, 8, 6, 12, 10][h % 5];           
  const oran = [0.42, 0.5, 0.58][(h >>> 3) % 3];   
  const ici = (h >>> 5) % 2 === 0;                
  const dis = t * 0.34, ic = dis * oran;

  const merkezler = [[t / 2, t / 2], [0, 0], [t, 0], [0, t], [t, t]];
  const sekiller = merkezler.map(([x, y], i) => {
    const anaRenk = i === 0 ? r.ikinci : r.cizgi;
    const parca = [`<polygon points="${yildiz(x, y, uc, dis, ic)}" fill="${anaRenk}" fill-opacity="${i === 0 ? 1 : 0.9}"/>`];
    if (ici) parca.push(`<polygon points="${yildiz(x, y, uc, dis * 0.5, ic * 0.5, Math.PI / uc)}" fill="${i === 0 ? r.vurgu : r.zemin}"/>`);
    else parca.push(`<circle cx="${x}" cy="${y}" r="${(ic * 0.45).toFixed(2)}" fill="${i === 0 ? r.vurgu : r.ikinci}"/>`);
    return parca.join("");
  });
  const baklava = [[t / 2, 0], [0, t / 2], [t, t / 2], [t / 2, t]]
    .map(([x, y]) => `<polygon points="${x},${y - 6} ${x + 6},${y} ${x},${y + 6} ${x - 6},${y}" fill="${r.vurgu}" fill-opacity=".85"/>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${t}" height="${t}" viewBox="0 0 ${t} ${t}"><rect width="${t}" height="${t}" fill="${r.zemin}"/>${sekiller.join("")}${baklava.join("")}</svg>`;
}

export const ciniArkaPlan = (kimlik, renk) => `url("data:image/svg+xml,${encodeURIComponent(ciniSvg(kimlik, renk))}")`;
