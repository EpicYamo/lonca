
const sar = (icerik) =>
  `<svg viewBox="0 0 160 100" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icerik}<path d="M8 92h144"/></svg>`;

const kemer = (x, y, g, y2) => `M${x} ${y2}V${y + g * 0.55}Q${x} ${y} ${x + g / 2} ${y - g * 0.25}Q${x + g} ${y} ${x + g} ${y + g * 0.55}V${y2}`;

export const CIZIMLER = {
  cami: sar(`
    <path d="M40 92V58h72v34"/>
    <path d="M52 58a24 24 0 0 1 48 0"/><path d="M76 34v-6"/><circle cx="76" cy="25" r="2"/>
    <path d="M40 66a10 10 0 0 1 12-8M112 66a10 10 0 0 0-12-8"/>
    <path d="M${68} 92V78a8 8 0 0 1 16 0v14"/>
    <path d="M124 92V36M132 92V36"/><path d="M122 46h12M122 62h12"/><path d="M124 36l4-18 4 18"/>`),
  han: sar(`
    <path d="M22 92V40h116v52"/><path d="M22 40l58-10 58 10"/><path d="M22 64h116"/>
    ${[30, 50, 98, 118].map((x) => `<path d="${kemer(x, 72, 12, 92)}"/><path d="${kemer(x, 46, 12, 64)}"/>`).join("")}
    <path d="${kemer(68, 66, 24, 92)}"/>`),
  hamam: sar(`
    <path d="M24 92V62h112v30"/>
    <path d="M36 62a20 20 0 0 1 40 0"/><path d="M84 62a20 20 0 0 1 40 0"/><path d="M60 46a16 16 0 0 1 32 0" transform="translate(4 -6)"/>
    ${[48, 56, 64, 96, 104, 112, 76, 84].map((x, i) => `<circle cx="${x}" cy="${i < 6 ? 54 : 38}" r="1.4" fill="currentColor"/>`).join("")}
    <path d="${kemer(70, 74, 20, 92)}"/>`),
  medrese: sar(`
    <path d="M18 92V52h124v40"/><path d="M60 52a20 20 0 0 1 40 0"/>
    ${[26, 42, 104, 120].map((x) => `<path d="${kemer(x, 66, 12, 92)}"/>`).join("")}
    <path d="M64 92V64h32v28"/><path d="${kemer(70, 72, 20, 92)}"/>`),
  cesme: sar(`
    <path d="M44 92V30h72v62"/><path d="M40 30h80"/><path d="M50 30l30-12 30 12"/>
    <path d="${kemer(58, 46, 44, 80)}"/><path d="M80 62v6"/><path d="M74 68h12"/>
    <path d="M50 80h60v12"/>`),
  turbe: sar(`
    <path d="M52 92V54h56v38"/><path d="M52 54l6-6h44l6 6"/><path d="M58 48a22 22 0 0 1 44 0"/>
    <path d="M80 26v-6"/><path d="M68 92V74a12 12 0 0 1 24 0v18"/><path d="M60 62h8M92 62h8"/>`),
  kopru: sar(`
    <path d="M10 60h140"/><path d="M10 66h140"/>
    <path d="M18 92V66M142 92V66"/><path d="M34 92V80a24 24 0 0 1 46 0v12"/><path d="M80 92V80a24 24 0 0 1 46 0v12"/>
    <path d="M40 60V44h18v16M102 60V44h18v16"/><path d="M38 44h22M100 44h22"/>`),
  genel: sar(`<path d="M36 92V50h88v42"/><path d="${kemer(60, 58, 40, 92)}"/><path d="M30 50l50-22 50 22"/>`),
};
const BENZER = { mescit: "cami", kulliye: "cami", imaret: "medrese", kutuphane: "medrese", tekke: "turbe", hazire: "turbe", carsi: "han" };

export const cizim = (tur) => CIZIMLER[tur] ?? CIZIMLER[BENZER[tur]] ?? CIZIMLER.genel;
