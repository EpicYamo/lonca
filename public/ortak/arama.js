// Ortak arama ve sürüm yardımcıları. Hem sunucu (server/uygulama.js) hem tarayıcı (çevrimdışı API: public/mobil/yerel-api.js)
// aynı dosyayı kullanır; DOM'a ve ağa dokunmaz.

export const TUR_ADLARI = {
  cami: "Cami", mescit: "Mescit", medrese: "Medrese", han: "Han", hamam: "Hamam", cesme: "Çeşme", turbe: "Türbe",
  kulliye: "Külliye", imaret: "İmaret", kopru: "Köprü", tekke: "Tekke", hazire: "Hazire", carsi: "Çarşı",
  kutuphane: "Kütüphane", sivil: "Sivil yapı", diger: "Yapı",
};

const HARF = { ç: "c", ğ: "g", ı: "i", i: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };
// "Çekirge", "çekirge", "cekirge" aynı sayılsın; noktalama boşluğa döner.
export function sadelestir(metin) {
  return String(metin ?? "").toLocaleLowerCase("tr").replace(/[çğıöşüâîû]/g, (h) => HARF[h] ?? h)
    .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

const ozet = (e) => ({ id: e.id, ad: e.ad, ad_en: e.ad_en ?? null, tur: e.tur, il: e.il ?? null, ilce: e.ilce ?? null, yuzyil: e.yuzyil ?? null,
  foto: Array.isArray(e.fotograflar) ? e.fotograflar[0] ?? null : null });

// Ad, İngilizce ad, il, ilçe ve tür adında arar. Her sözcük bir yerde geçmeli; adda geçenler öne çıkar.
export function eserAra(eserler, sorgu, { limit = 30 } = {}) {
  const sozcukler = sadelestir(sorgu).split(" ").filter(Boolean);
  if (!sozcukler.length) return [];
  const sonuc = [];
  for (const e of eserler) {
    const ad = sadelestir(`${e.ad} ${e.ad_en ?? ""}`);
    const yer = sadelestir(`${e.il ?? ""} ${e.ilce ?? ""}`);
    const tur = sadelestir(`${TUR_ADLARI[e.tur] ?? ""} ${e.tur ?? ""}`);
    const hepsi = `${ad} ${yer} ${tur}`;
    if (!sozcukler.every((s) => hepsi.includes(s))) continue;
    let puan = 0;
    for (const s of sozcukler) {
      if (ad.startsWith(s)) puan += 6;
      else if (` ${ad}`.includes(` ${s}`)) puan += 4;
      else if (ad.includes(s)) puan += 2;
      else if (` ${yer} `.includes(` ${s} `)) puan += 2;
      else puan += 1;
    }
    if (e.fotograflar?.length) puan += 0.5;
    sonuc.push([puan, e]);
  }
  return sonuc.sort((a, b) => b[0] - a[0] || String(a[1].ad).localeCompare(String(b[1].ad), "tr"))
    .slice(0, Math.min(Math.max(Number(limit) || 30, 1), 50)).map(([, e]) => ozet(e));
}

// Yayındaki modül listesinin kısa imzası: liste değişince (yeni onay, güncelleme, kaldırma) değişir.
export function modulSurumu(moduller) {
  const imza = moduller.map((m) => `${m.id}:${m.guncelleme ?? ""}:${m.yayin ?? ""}`).sort().join("|");
  let h = 2166136261;
  for (let i = 0; i < imza.length; i++) { h ^= imza.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return `${moduller.length}-${h.toString(36)}`;
}
