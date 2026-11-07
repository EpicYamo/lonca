// Doğrulama işareti: Vakıf Katılım envanterine dayanan modül ve eserlerde ✓; dış kaynaklı (ör. Vikipedi)
// içerikte tik yoktur, yerine yalnızca kaynağın adı yazılır ("Kaynak: Vikipedi"). Alan yoksa (eski kayıtlar) doğrulanmış sayılır.
// Sunucu modül kaydına { dogrulama: { dogrulanmis, kaynaklar } }, eser kaydına { dogrulanmis: false, kaynakTuru } yazar.

export const modulDogrulandi = (m) => m?.dogrulama?.dogrulanmis !== false;
export const eserDogrulandi = (e) => e?.dogrulanmis !== false;
const kaynakAdi = (liste) => (liste?.length ? liste.join(", ") : "Vikipedi");
export const dogrulanmamisMetni = (kaynaklar) => `Kaynak: ${kaynakAdi(kaynaklar)}`;

// Modül kartında adın yanına konur: doğrulanmışsa ✓ rozeti, değilse kaynağı yazan küçük etiket.
export function modulRozeti(m) {
  const s = document.createElement("span");
  if (modulDogrulandi(m)) {
    s.className = "dogrulama-tik";
    s.textContent = "✓";
    s.title = "Doğrulanmış vakıf eseri içeriği (Vakıf Katılım envanteri)";
    s.setAttribute("aria-label", "Doğrulanmış vakıf eseri içeriği");
    s.setAttribute("role", "img");
  } else {
    s.className = "dogrulama-yok";
    s.textContent = dogrulanmamisMetni(m.dogrulama?.kaynaklar);
  }
  return s;
}

// Eserin kaynak satırı: doğrulanmışsa "✓ Doğrulanmış vakıf eseri", değilse "Kaynak: Vikipedi".
export function eserDogrulamaMetni(e) {
  return eserDogrulandi(e) ? "✓ Doğrulanmış vakıf eseri" : dogrulanmamisMetni(e?.kaynakTuru ? [e.kaynakTuru] : null);
}
export function eserRozeti(e) {
  const s = document.createElement("span");
  s.className = eserDogrulandi(e) ? "dogrulama-tik metinli" : "dogrulama-yok";
  s.textContent = eserDogrulamaMetni(e);
  return s;
}

// Kartlarda adın yanına konan kısa işaret: doğrulanmışsa yalnızca ✓, değilse kaynak etiketi.
export const eserKisaRozeti = (e) => modulRozeti({ dogrulama: { dogrulanmis: eserDogrulandi(e), kaynaklar: e?.kaynakTuru ? [e.kaynakTuru] : [] } });
