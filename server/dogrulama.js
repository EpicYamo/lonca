
export const ESER_TURLERI = ["cami", "mescit", "medrese", "han", "hamam", "cesme", "turbe", "kulliye", "imaret",
  "kopru", "tekke", "hazire", "carsi", "kutuphane", "sivil", "diger"];

const metinMi = (x) => typeof x === "string";
// eslint-disable-next-line no-control-regex -- NUL karakteri bilerek temizlenir
const kirp = (x, n) => (metinMi(x) ? x.replace(/\u0000/g, "").trim().slice(0, n) : "");

export function kimlikUret(ad) {
  const harf = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };
  return String(ad).toLocaleLowerCase("tr").replace(/[çğıöşüâîû]/g, (h) => harf[h])
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 56) || "eser";
}

export function eserDogrula(veri, { kismi = false } = {}) {
  const hatalar = [], eser = {};
  if (!veri || typeof veri !== "object" || Array.isArray(veri)) return { hatalar: ["eser verisi bir nesne olmalı"], eser };
  const var_ = (k) => !kismi || Object.hasOwn(veri, k);

  if (var_("ad")) {
    eser.ad = kirp(veri.ad, 120);
    if (eser.ad.length < 2) hatalar.push("ad en az 2 karakter olmalı");
  }
  if (var_("ad_en")) eser.ad_en = kirp(veri.ad_en, 120) || null;
  if (var_("il")) { eser.il = kirp(veri.il, 40) || "Bursa"; }
  if (var_("ilce")) eser.ilce = kirp(veri.ilce, 40) || null;
  if (var_("tur")) {
    eser.tur = veri.tur;
    if (!ESER_TURLERI.includes(veri.tur)) hatalar.push(`tür şunlardan biri olmalı: ${ESER_TURLERI.join(", ")}`);
  }
  if (var_("yuzyil")) {
    const y = veri.yuzyil === "" || veri.yuzyil == null ? null : Number(veri.yuzyil);
    if (y !== null && !(Number.isInteger(y) && y >= 1 && y <= 21)) hatalar.push("yüzyıl 1–21 arası bir tam sayı ya da boş olmalı");
    eser.yuzyil = y;
  }
  if (var_("konum")) {
    const k = veri.konum;
    if (k == null || k === "") eser.konum = null;
    else {
      const lat = Number(k.lat), lng = Number(k.lng);
      if (!(lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180)) hatalar.push("konum: geçerli enlem/boylam gerekli");
      else eser.konum = { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6, ...(k.yaklasik ? { yaklasik: true } : {}) };
    }
  }
  if (var_("adres")) eser.adres = kirp(veri.adres, 240) || null;
  if (var_("tarihce")) {
    const tr = kirp(veri.tarihce?.tr, 8000), en = kirp(veri.tarihce?.en, 8000);
    if (tr.length < 20) hatalar.push("Türkçe tarihçe en az 20 karakter olmalı");
    eser.tarihce = { tr, en: en || null };
  }
  if (var_("kaynak")) {
    eser.kaynak = kirp(veri.kaynak, 240);
    if (eser.kaynak.length < 3) hatalar.push("kaynak zorunlu (ör. kitap, cilt, sayfa ya da kurum)");
  }
  if (var_("fotograflar")) {
    const liste = Array.isArray(veri.fotograflar) ? veri.fotograflar : [];
    eser.fotograflar = liste.filter(metinMi).map((f) => f.trim()).filter(Boolean).slice(0, 12);
    for (const f of eser.fotograflar) {
      if (!/^\/medya\/[a-z0-9/_.-]+\.(jpe?g|png|webp)$/i.test(f) && !/^https:\/\/[^\s"'<>]+$/i.test(f)) hatalar.push(`geçersiz fotoğraf adresi: ${f.slice(0, 80)}`);
    }
  }
  if (var_("sergi")) eser.sergi = kirp(veri.sergi, 200) || null;
  return { hatalar, eser };
}

/**
 * Uzman düzenleme önerisinin ek alanları. Düzenleme önerisi en az bir alanı değiştirmeli ve
 * eklenen bilginin kaynağını (kitap, cilt, sayfa, kitabe, kurum…) taşımalı; öneren adı isteğe bağlı.
 * @returns {{ hatalar: string[], kaynak: string | null, oneren: string | null }}
 */
export function oneriEkiDogrula(tur, govde = {}, temizVeri = null) {
  const hatalar = [];
  const kaynak = kirp(govde.kaynak, 240) || null, oneren = kirp(govde.oneren, 80) || null;
  if (tur === "duzenle") {
    if (!temizVeri || !Object.keys(temizVeri).length) hatalar.push("düzenleme önerisinde en az bir alan değişmeli");
    if (!kaynak || kaynak.length < 3) hatalar.push("eklenen bilginin kaynağı zorunlu (ör. kitap, cilt, sayfa ya da kitabe)");
  }
  return { hatalar, kaynak, oneren };
}

export const TEMEL_ALANLAR = ["ad", "tur", "il", "ilce", "yuzyil", "konum", "adres", "tarihce"];
export const EK_ALANLAR = ["fotograf", "ad_en", "tarihce_en"];
const dolu = (x) => typeof x === "string" ? x.trim().length > 0 : x != null;
const ALAN_VAR = {
  ad: (e) => dolu(e.ad), tur: (e) => dolu(e.tur), il: (e) => dolu(e.il), ilce: (e) => dolu(e.ilce),
  yuzyil: (e) => Number.isInteger(e.yuzyil),
  konum: (e) => Number.isFinite(e.konum?.lat) && Number.isFinite(e.konum?.lng),
  adres: (e) => dolu(e.adres), tarihce: (e) => dolu(e.tarihce?.tr),
  fotograf: (e) => Array.isArray(e.fotograflar) && e.fotograflar.length > 0,
  ad_en: (e) => dolu(e.ad_en), tarihce_en: (e) => dolu(e.tarihce?.en),
};
export const TUM_ALANLAR = [...TEMEL_ALANLAR, ...EK_ALANLAR];

/** @returns {{ eksikler: string[], tam: boolean, oran: number }} eksikler: eksik temel alanlar */
export function tamlik(e) {
  const eksikler = TEMEL_ALANLAR.filter((a) => !ALAN_VAR[a](e));
  return { eksikler, tam: eksikler.length === 0, oran: (TEMEL_ALANLAR.length - eksikler.length) / TEMEL_ALANLAR.length };
}
export const alanVar = (e, alan) => !!ALAN_VAR[alan]?.(e);

/**
 */
export function tamlikSuzgeci({ tam, eksik, gerekli, olmayan } = {}) {
  const liste = (x) => String(x ?? "").split(",").map((s) => s.trim()).filter((s) => ALAN_VAR[s]);
  const g = liste(gerekli), o = liste(olmayan);
  return (e) => {
    const t = tamlik(e);
    if (tam === "1" || tam === true) { if (!t.tam) return false; }
    if (eksik && ALAN_VAR[eksik]) {
      if (TEMEL_ALANLAR.includes(eksik)) { if (t.eksikler.length !== 1 || t.eksikler[0] !== eksik) return false; }
      else if (!t.tam || alanVar(e, eksik)) return false;
    }
    return g.every((a) => alanVar(e, a)) && o.every((a) => !alanVar(e, a));
  };
}
