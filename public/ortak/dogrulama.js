// Doğrulama işareti: Vakıf Katılım envanterine dayanan modül ve eserlerde "Vakıf Katılım eseri" mührü; dış kaynaklı (ör. Vikipedi)
// içerikte tik yoktur, yerine "Kaynak doğrulanmamış: <kaynak>" yazılır. Alan yoksa (eski kayıtlar) doğrulanmış sayılır.
// Sunucu modül kaydına { dogrulama: { dogrulanmis, kaynaklar } }, eser kaydına { dogrulanmis: false, kaynakTuru } yazar.

export const modulDogrulandi = (m) => m?.dogrulama?.dogrulanmis !== false;
export const eserDogrulandi = (e) => e?.dogrulanmis !== false;
const kaynakAdi = (liste) => (liste?.length ? liste.join(", ") : "Vikipedi");
export const dogrulanmamisMetni = (kaynaklar) => `Kaynak doğrulanmamış: ${kaynakAdi(kaynaklar)}`;

// ---------- Vakıf Katılım eseri mührü ----------
// Doğrulanmış içerik düz bir ✓ yerine pasaport mührü gibi damgalanır. İki biçim birlikte üretilir, hangisinin
// görüneceğine CSS karar verir (tasarim.css): kartların fotoğrafı üstünde yuvarlak mühür (.vm-yuvarlak), satır içinde
// ve listelerde okunaklı dikdörtgen damga (.vm-damga). Ortadaki amblem tek yerde (AMBLEM): Vakıf Katılım'ın resmî
// logosu gelince yalnızca burası değişir.
const AMBLEM = '<path d="M36 53a14 14 0 0 1 28 0M50 39v-4.5M33 53h34v10H33zM46 63v-4.5a4 4 0 0 1 8 0V63M29 63h42" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/><circle cx="50" cy="33" r="1.6" fill="currentColor"/>';
const ETIKET = "VAKIF KATILIM ESERİ";
const ACIKLAMA = "Vakıf Katılım eseri: kaynağı doğrulanmış";
let muhurNo = 0;

function yuvarlakMuhur() {
  const n = ++muhurNo;
  // Mürekkep izi: kenarlar hafif titrek (yer değiştirme) ve yer yer basılmamış benekler (maske) gerçek damga hissi verir.
  return `<svg class="vm-yuvarlak" viewBox="0 0 100 100" aria-hidden="true" translate="no">
<defs>
<filter id="vm-titrek-${n}" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="${n % 7}"/><feDisplacementMap in="SourceGraphic" scale="1.1"/></filter>
<filter id="vm-benek-${n}"><feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="1" seed="${(n * 3) % 11}"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 -3.2 2.45"/></filter>
<mask id="vm-maske-${n}"><rect width="100" height="100" filter="url(#vm-benek-${n})"/></mask>
<path id="vm-ust-${n}" d="M19 50a31 31 0 0 1 62 0"/><path id="vm-alt-${n}" d="M12 50a38 38 0 0 0 76 0"/>
</defs>
<circle class="vm-kagit" cx="50" cy="50" r="49"/>
<g class="vm-murekkep" mask="url(#vm-maske-${n})" filter="url(#vm-titrek-${n})">
<circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="2.8"/>
<circle cx="50" cy="50" r="40.5" fill="none" stroke="currentColor" stroke-width="1"/>
<circle cx="50" cy="50" r="27" fill="none" stroke="currentColor" stroke-width="1.3"/>
<text font-size="10.4" font-weight="800" letter-spacing=".9" fill="currentColor"><textPath href="#vm-ust-${n}" startOffset="50%" text-anchor="middle">VAKIF KATILIM</textPath></text>
<text font-size="10.4" font-weight="800" letter-spacing="2.6" fill="currentColor"><textPath href="#vm-alt-${n}" startOffset="50%" text-anchor="middle">ESERİ</textPath></text>
<path d="M14.5 46.5l1.6 3.5 1.6-3.5-1.6-3.5zM82.3 46.5l1.6 3.5 1.6-3.5-1.6-3.5z" transform="translate(0 3.5)" fill="currentColor"/>
<g transform="translate(0 -2)">${AMBLEM}</g>
<text x="50" y="72" font-size="6.4" font-weight="800" letter-spacing="1.4" text-anchor="middle" fill="currentColor">ONAYLI</text>
</g>
</svg>`;
}

const kucukAmblem = () => `<svg class="vm-amblem" viewBox="24 26 52 42" aria-hidden="true">${AMBLEM}</svg>`;

export function vakifMuhru() {
  const s = document.createElement("span");
  s.className = "vakif-muhur";
  s.setAttribute("role", "img");
  s.setAttribute("aria-label", ACIKLAMA);
  s.title = ACIKLAMA;
  s.innerHTML = `${yuvarlakMuhur()}<span class="vm-damga" aria-hidden="true">${kucukAmblem()}<span class="vm-yazi">${ETIKET}</span></span>`;
  return s;
}

// Modül kartında adın yanına konur: doğrulanmışsa mühür, değilse kaynağı yazan küçük etiket.
export function modulRozeti(m) {
  if (modulDogrulandi(m)) return vakifMuhru();
  const s = document.createElement("span");
  s.className = "dogrulama-yok";
  s.textContent = dogrulanmamisMetni(m.dogrulama?.kaynaklar);
  return s;
}

// Eserin kaynak satırı: doğrulanmışsa "✓ Doğrulanmış vakıf eseri", değilse "Kaynak doğrulanmamış: Vikipedi".
export function eserDogrulamaMetni(e) {
  return eserDogrulandi(e) ? "✓ Doğrulanmış vakıf eseri" : dogrulanmamisMetni(e?.kaynakTuru ? [e.kaynakTuru] : null);
}
export function eserRozeti(e) {
  if (eserDogrulandi(e)) return vakifMuhru();
  const s = document.createElement("span");
  s.className = "dogrulama-yok";
  s.textContent = eserDogrulamaMetni(e);
  return s;
}

// Listelerde adın yanına konan kısa işaret: doğrulanmışsa mühür (satır içinde damga), değilse kaynak etiketi.
export const eserKisaRozeti = (e) => modulRozeti({ dogrulama: { dogrulanmis: eserDogrulandi(e), kaynaklar: e?.kaynakTuru ? [e.kaynakTuru] : [] } });
